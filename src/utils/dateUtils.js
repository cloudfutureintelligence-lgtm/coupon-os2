// ─────────────────────────────────────────────────────────────────────────────
// dateUtils.js — single source of truth for date/time handling.
//
// The business runs on Dubai (Asia/Dubai, UTC+4) time.
//
// STRATEGY (changed):
//   - When we SAVE "now" (dubaiNowISOString), we compute the actual current
//     Dubai wall-clock time and bake it into the string as
//     "YYYY-MM-DDTHH:mm:ss.000+04:00". That string IS the real Dubai date/time
//     at the moment it was saved — no ambiguity, no relying on the DB column
//     or the viewer's clock.
//   - When we DISPLAY a stored date, we do NOT run it back through a
//     timezone-converting formatter (no `toLocaleString(..., { timeZone })`,
//     no `Intl.DateTimeFormat` re-interpretation). We just read the literal
//     Y/M/D/H/M characters straight out of the stored string and print them.
//     Whatever date/time is sitting in the DB is what gets shown, full stop.
//
// This avoids the double-conversion bug where a value already correct for
// Dubai gets silently shifted again depending on the viewer's device
// timezone or the JS engine's Date parsing quirks.
//
// Every page must import its date helpers from here. Don't re-declare local
// toDateStr / formatDubaiDateTime / etc. copies in individual files — that's
// how the inconsistency happened in the first place.
// ─────────────────────────────────────────────────────────────────────────────

export const DUBAI_TZ = 'Asia/Dubai';
const DUBAI_OFFSET = '+04:00';

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Pull the literal Y/M/D/H/M/S characters out of a stored date string,
// WITHOUT letting the JS engine reinterpret them through any timezone.
// Works for "YYYY-MM-DDTHH:mm:ss(.sss)?(Z|+04:00|...)?" style strings.
// Falls back to reading from a Date object (using UTC getters, which just
// read the raw fields) if the input isn't already a recognizable string.
const extractParts = (dateInput) => {
  if (!dateInput) return null;

  if (typeof dateInput === 'string') {
    const m = dateInput.match(
      /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/
    );
    if (m) {
      return {
        year: m[1],
        month: m[2],
        day: m[3],
        hour: m[4],
        minute: m[5],
        second: m[6] || '00',
      };
    }
  }

  // Fallback: treat whatever we were given as already representing the
  // moment we want to show, and read its fields without conversion.
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return {
    year: String(d.getUTCFullYear()),
    month: String(d.getUTCMonth() + 1).padStart(2, '0'),
    day: String(d.getUTCDate()).padStart(2, '0'),
    hour: String(d.getUTCHours()).padStart(2, '0'),
    minute: String(d.getUTCMinutes()).padStart(2, '0'),
    second: String(d.getUTCSeconds()).padStart(2, '0'),
  };
};

// "YYYY-MM-DD" — the literal date portion of the stored value, unconverted.
export const dubaiDateStr = (dateInput) => {
  const p = extractParts(dateInput);
  if (!p) return '';
  return `${p.year}-${p.month}-${p.day}`;
};

// Today's date string, in real current Dubai time (used only for "today"
// comparisons — this one intentionally reads the live clock, not a stored value).
export const todayDubaiStr = () => dubaiDateStr(dubaiNowISOString());

// "YYYY-MM" — used to bucket sales/charts by month, straight from the stored value.
export const dubaiMonthKey = (dateInput) => dubaiDateStr(dateInput).slice(0, 7);

// Date-only display, e.g. "23 Jul 2026" — literal characters from the stored value.
export const formatDubaiDate = (dateInput) => {
  const p = extractParts(dateInput);
  if (!p) return '—';
  const monthName = MONTH_ABBR[parseInt(p.month, 10) - 1];
  return `${p.day} ${monthName} ${p.year}`;
};

// Time-only display, e.g. "01:09 am" — literal characters from the stored value.
export const formatDubaiTime = (dateInput) => {
  const p = extractParts(dateInput);
  if (!p) return '—';
  let h = parseInt(p.hour, 10);
  const suffix = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, '0')}:${p.minute} ${suffix}`;
};

// Date + time display, e.g. "01 Aug 2026, 01:09 am" — literal, unconverted.
export const formatDubaiDateTime = (dateInput) => {
  const p = extractParts(dateInput);
  if (!p) return '—';
  return `${formatDubaiDate(dateInput)}, ${formatDubaiTime(dateInput)}`;
};

// Start-of-day / end-of-day for a "YYYY-MM-DD" string, anchored to Dubai's
// midnight. Useful for date-range filters against timestamptz columns.
export const dubaiStartOfDay = (dateStr) => new Date(`${dateStr}T00:00:00.000${DUBAI_OFFSET}`);
export const dubaiEndOfDay = (dateStr) => new Date(`${dateStr}T23:59:59.999${DUBAI_OFFSET}`);

// The current instant, captured as the ACTUAL current Dubai wall-clock time
// and baked into the string with an explicit +04:00 offset — e.g.
// "2026-08-01T14:32:07.000+04:00". This is what every "created at / sold at /
// collected at" field should be stamped with before saving. Because the
// Dubai time is embedded directly in the string, no later conversion is
// needed (or wanted) when displaying it — the formatters above just read it back.
export const dubaiNowISOString = () => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DUBAI_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const map = {};
  parts.forEach(({ type, value }) => { map[type] = value; });
  // Intl can give "24" for midnight hour in some environments — normalize.
  if (map.hour === '24') map.hour = '00';

  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}.000${DUBAI_OFFSET}`;
};
