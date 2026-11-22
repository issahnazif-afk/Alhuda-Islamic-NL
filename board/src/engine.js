// Pure schedule logic: no DOM, so it runs the same in the browser and in `node --test`.
import { Coordinates, CalculationMethod, PrayerTimes, Madhab, HighLatitudeRule } from '../vendor/adhan.esm.min.js';

export const PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
const MINUTE = 60000;

export function adhanTimes(date, cfg) {
  const c = cfg.calculation ?? {};
  const method = CalculationMethod[c.method ?? 'NorthAmerica'];
  if (!method) throw new Error(`Unknown calculation.method "${c.method}"`);
  const params = method();
  params.madhab = c.madhab === 'Hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  if (c.highLatitudeRule) {
    const rule = HighLatitudeRule[c.highLatitudeRule];
    if (!rule || typeof rule === 'function') throw new Error(`Unknown calculation.highLatitudeRule "${c.highLatitudeRule}"`);
    params.highLatitudeRule = rule;
  }
  Object.assign(params.adjustments, c.adjustments);
  const { latitude, longitude } = cfg.location ?? {};
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('location.latitude and location.longitude must be numbers');
  const pt = new PrayerTimes(new Coordinates(latitude, longitude), date, params);
  return Object.fromEntries(PRAYERS.map((p) => [p, pt[p]]));
}

// rule is "+15" (minutes after adhan) or "13:30" (fixed clock time, never earlier than adhan).
export function iqamahTime(adhan, rule, roundTo = 1) {
  if (rule == null || rule === '') return null;
  const offset = /^\+(\d{1,3})$/.exec(rule);
  if (offset) {
    const step = roundTo * MINUTE;
    return new Date(Math.ceil((adhan.getTime() + Number(offset[1]) * MINUTE) / step) * step);
  }
  const fixed = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(rule);
  if (!fixed) throw new Error(`Bad iqamah rule "${rule}": use "+15" or "13:30"`);
  const t = new Date(adhan);
  t.setHours(Number(fixed[1]), Number(fixed[2]), 0, 0);
  return t < adhan ? new Date(adhan) : t;
}

export function daySchedule(date, cfg) {
  const a = adhanTimes(date, cfg);
  const round = cfg.iqamahRoundMinutes ?? 1;
  const jumuah = date.getDay() === 5 && cfg.jumuah?.length > 0;
  return PRAYERS.map((p) => {
    if (p === 'sunrise') return { key: p, adhan: a[p], iqamah: [] };
    if (p === 'dhuhr' && jumuah) return { key: 'jumuah', adhan: a[p], iqamah: cfg.jumuah.map((r) => iqamahTime(a[p], r)) };
    return { key: p, adhan: a[p], iqamah: [iqamahTime(a[p], cfg.iqamah?.[p], round)].filter(Boolean) };
  });
}

// Noon avoids landing on a skipped or repeated hour at a DST change.
export const nextDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12);

// The board keeps showing today until a while after the last Isha iqamah, then flips to tomorrow.
export function boardDay(now, cfg) {
  const rows = daySchedule(now, cfg);
  const isha = rows.at(-1);
  const end = (isha.iqamah.at(-1) ?? isha.adhan).getTime() + (cfg.rolloverAfterIshaMinutes ?? 60) * MINUTE;
  if (now.getTime() < end) return { date: now, rows };
  const date = nextDay(now);
  return { date, rows: daySchedule(date, cfg) };
}

export function nextEvent(now, cfg, day = boardDay(now, cfg)) {
  const events = day.rows.flatMap((r) => [
    { key: r.key, type: r.key === 'sunrise' ? 'sunrise' : 'adhan', at: r.adhan },
    ...r.iqamah.map((at) => ({ key: r.key, type: 'iqamah', at })),
  ]);
  const next = events.find((e) => e.at > now);
  if (next) return next;
  const fajr = daySchedule(nextDay(day.date), cfg)[0];
  return { key: 'fajr', type: 'adhan', at: fajr.adhan };
}
