// ─────────────────────────────────────────────────────────────────────────────
// dateUtils.js — single source of truth for date/time formatting.
//
// The business runs on Dubai (Asia/Dubai, UTC+4) time. Coupons can be sold
// from devices anywhere, and the app is viewed from browsers set to all sorts
// of timezones — so every date/time shown in the UI is explicitly converted
// to Asia/Dubai here, instead of trusting the viewer's device clock/timezone.
//
// IMPORTANT — about the "+00" you see in raw SQL:
//   The DB columns (sold_at, timestamp, created_at, etc.) are Postgres
//   `timestamptz`. That type ALWAYS stores/represents the value internally
//   as UTC and shows it with a "+00" suffix when queried with a plain
//   client session — that is expected, correct, and NOT a bug. The instant
//   stored is exactly right; it just needs converting to Dubai time for a
//   human to read it, which is what the formatters below do.
//
//   Example: `2026-07-31 22:09:46+00` in the DB is the SAME MOMENT as
//   `2026-08-01 02:09:46` in Dubai (UTC+4). Both are correct — one is the
//   raw stored instant, the other is the human-readable Dubai time.
//
// Every page must import its date helpers from here. Don't re-declare local
// toDateStr / formatDubaiDateTime / etc. copies in individual files — that's
// how the inconsistency happened in the first place.
//
// `dubaiNowISOString()` is what client-side code should use whenever it
// needs to stamp "now" before sending it to the database — it returns a
// real UTC instant (via `new Date().toISOString()`), which Postgres will
// correctly normalize on insert. Do NOT try to bake a "+04:00" offset into
// this value or strip timezone info — `timestamptz` columns need a real,
// unambiguous instant, and Postgres/JS both handle the UTC conversion for
// you automatically and correctly.
// ─────────────────────────────────────────────────────────────────────────────

export const DUBAI_TZ = 'Asia/Dubai';

// "YYYY-MM-DD" for a given moment, as that date is in Dubai — not UTC, not
// the viewer's local device timezone. Used for "today" comparisons/filters.
export const dubaiDateStr = (dateInput) => {
  if (!dateInput) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: DUBAI_TZ }).format(new Date(dateInput));
};

// Today's date string, in Dubai time.
export const todayDubaiStr = () => dubaiDateStr(new Date());

// "YYYY-MM" for a given moment, in Dubai time — used to bucket sales/charts
// by month without drifting near month boundaries depending on viewer tz.
export const dubaiMonthKey = (dateInput) => dubaiDateStr(dateInput).slice(0, 7);

// Date-only display, e.g. "23 Jul 2026" — always Dubai's calendar date.
export const formatDubaiDate = (dateInput) => {
  if (!dateInput) return '—';
  return new Date(dateInput).toLocaleDateString('en-GB', {
    timeZone: DUBAI_TZ, day: '2-digit', month: 'short', year: 'numeric',
  });
};

// Time-only display, e.g. "01:09 am" — always Dubai time.
export const formatDubaiTime = (dateInput) => {
  if (!dateInput) return '—';
  return new Date(dateInput).toLocaleTimeString('en-GB', {
    timeZone: DUBAI_TZ, hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

// Date + time display, e.g. "01 Aug 2026, 01:09 am" — always Dubai time.
export const formatDubaiDateTime = (dateInput) => {
  if (!dateInput) return '—';
  return new Date(dateInput).toLocaleString('en-GB', {
    timeZone: DUBAI_TZ, day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

// Start-of-day / end-of-day for a "YYYY-MM-DD" string, anchored to Dubai's
// midnight (not UTC midnight). Useful for date-range filters against
// timestamptz columns.
export const dubaiStartOfDay = (dateStr) => new Date(`${dateStr}T00:00:00.000+04:00`);
export const dubaiEndOfDay = (dateStr) => new Date(`${dateStr}T23:59:59.999+04:00`);

// The current instant, as an ISO-8601 string, for stamping "created at /
// sold at / collected at" fields before saving. Storing this in a
// `timestamptz` column is always correct — Postgres keeps it as UTC
// internally and every formatter above converts it back to Dubai time on
// display, so nothing needs manual timezone math before it's saved.
export const dubaiNowISOString = () => new Date().toISOString();