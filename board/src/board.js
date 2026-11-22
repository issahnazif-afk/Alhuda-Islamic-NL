import { boardDay, nextEvent } from './engine.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

async function load(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return res.json();
}

function showError(err) {
  $('error').textContent = `Masjid Board: ${err.message}`;
  $('error').hidden = false;
}

async function start() {
  const cfg = await load('config.json');
  const lang = params.get('lang') ?? cfg.language ?? 'en';
  const t = await load(`i18n/${lang}.json`);
  const theme = params.get('theme') ?? cfg.theme ?? 'teal';
  if (!/^[\w-]+$/.test(theme)) throw new Error(`Bad theme name "${theme}"`);
  $('theme').href = `themes/${theme}.css`;

  document.documentElement.lang = lang;
  document.documentElement.dir = t.dir ?? 'ltr';
  document.title = cfg.masjid?.name ?? 'Masjid Board';
  $('name').textContent = cfg.masjid?.name ?? '';
  $('h-adhan').textContent = t.adhan;
  $('h-iqamah').textContent = t.iqamah;
  // no iqamah or Jumu'ah times set yet: show the adhan times alone, without an empty column
  const hasIqamah = Object.values(cfg.iqamah ?? {}).some(Boolean) || (cfg.jumuah ?? []).length > 0;
  if (!hasIqamah) document.documentElement.classList.add('no-iqamah');

  const locale = t.locale ?? lang;
  const hour12 = cfg.clock !== '24h';
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12 });
  const hm = (d) => timeFmt.formatToParts(d).filter((p) => p.type !== 'dayPeriod').map((p) => p.value).join('').trim();
  const num = (n) => n.toLocaleString(locale, { minimumIntegerDigits: 2, useGrouping: false });
  const gregFmt = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const hijriFmt = new Intl.DateTimeFormat(`${locale}-u-ca-islamic-umalqura`, { day: 'numeric', month: 'long', year: 'numeric' });
  const hijriOffset = cfg.hijriOffsetDays ?? 0;

  let shownKey = '';
  function tick() {
    const now = new Date();
    $('clock').textContent = hm(now);
    $('secs').textContent = num(now.getSeconds());

    const day = boardDay(now, cfg);
    const next = nextEvent(now, cfg, day);
    const key = `${day.date.toDateString()}|${next.key}|${next.type}|${next.at.getTime()}`;
    if (key !== shownKey) {
      shownKey = key;
      $('greg').textContent = gregFmt.format(day.date);
      const h = new Date(day.date);
      h.setDate(h.getDate() + hijriOffset);
      $('hijri').textContent = hijriFmt.format(h);
      $('rows').replaceChildren(...day.rows.map((r) => {
        const tr = document.createElement('tr');
        tr.className = [r.key === 'sunrise' && 'muted', r.key === next.key && day.date.toDateString() === next.at.toDateString() && 'is-next'].filter(Boolean).join(' ');
        const iq = document.createElement('td');
        for (const q of r.iqamah) iq.append(Object.assign(document.createElement('span'), { className: r.iqamah.length > 1 ? 'many' : '', textContent: hm(q) }));
        tr.append(Object.assign(document.createElement('td'), { textContent: t[r.key] }),
          Object.assign(document.createElement('td'), { textContent: hm(r.adhan) }), iq);
        return tr;
      }));
      $('next-label').textContent = next.type === 'sunrise' ? t.sunrise : `${t[next.key]} · ${t[next.type]}`;
    }

    const s = Math.max(0, Math.floor((next.at - now) / 1000));
    $('next-count').textContent = `${Math.floor(s / 3600).toLocaleString(locale)}:${num(Math.floor(s / 60) % 60)}:${num(s % 60)}`;
  }

  tick();
  setInterval(tick, 1000);

  const news = cfg.announcements ?? [];
  let i = 0;
  const showNews = () => { $('news').textContent = news[i++ % news.length] ?? ''; $('news').classList.remove('fade'); };
  showNews();
  if (news.length > 1) setInterval(() => { $('news').classList.add('fade'); setTimeout(showNews, 600); }, 12000);

  // Keep TVs and sticks from sleeping where the browser allows it.
  const wake = () => navigator.wakeLock?.request('screen').catch(() => {});
  wake();
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && wake());
}

start().catch(showError);
