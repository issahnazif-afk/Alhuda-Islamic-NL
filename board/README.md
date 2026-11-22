# Prayer-times board

A full-screen prayer-times screen for a TV, based on [Masjid Board](https://github.com/NotYousha/masjid-board) (MIT licence, see `LICENSE`; prayer times by adhan-js, see `vendor/ADHAN-LICENSE`).

- Open `board/` on any TV or laptop browser and make it full screen.
- Times are calculated on the device for St. John's with the ISNA method and Shafi'i Asr, the same as the main website.
- Edit `config.json` to add iqamah times (`"fajr": "+20"` for minutes after adhan, or `"dhuhr": "13:30"` for a fixed time), Jumu'ah times (`"jumuah": ["13:30"]`) and announcements. The iqamah column appears once an iqamah time is set.
- The screen uses the device's own clock and time zone (Newfoundland time), so set those correctly on the TV.
