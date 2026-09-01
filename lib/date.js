// lib/date.js
//
// Date-key helpers.
//
// Firestore document ids and the `date` field use a calendar day in the USER'S
// timezone (e.g. "2026-09-02"). Deriving those with
// `new Date().toISOString().split('T')[0]` is wrong: toISOString converts to
// UTC first, so anywhere east of UTC the key is off by one.
//
// In Asia/Kolkata (UTC+5:30):
//   new Date('2026-09-01T00:00:00').toISOString() -> '2026-08-31T18:30:00Z'
// which yielded '2026-08-31' for what the user calls 1 September, shifting
// every cycle prediction a day early and stamping moods logged before 05:30
// onto the previous day.
//
// These helpers format from local calendar fields instead, so a "day" always
// means the day the user is actually living in.
//
// Note: instants (the `timestamp` fields) still use toISOString(), which is
// correct - those are points in time, not calendar days.

/**
 * Formats a Date as a local calendar day key, "YYYY-MM-DD".
 * @param {Date} date
 * @returns {string}
 */
export const toDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Today's local calendar day key. */
export const todayKey = () => toDateKey(new Date());

/** Local month key, "YYYY-MM". */
export const toMonthKey = (date = new Date()) => toDateKey(date).substring(0, 7);

/**
 * Parses a "YYYY-MM-DD" key into a Date at local midnight.
 * Avoids Date's UTC interpretation of bare date strings.
 * @param {string} dateStr
 * @returns {Date}
 */
export const fromDateKey = (dateStr) => {
  const [year, month, day] = String(dateStr).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

/**
 * Shifts a date key by a number of days, staying in local time.
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {number} days - may be negative
 * @returns {string}
 */
export const addDays = (dateStr, days) => {
  const date = fromDateKey(dateStr);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

/**
 * Inclusive list of day keys between two keys.
 * @param {string} startStr
 * @param {string} endStr
 * @returns {string[]}
 */
export const getDaysInRange = (startStr, endStr) => {
  const dates = [];
  const current = fromDateKey(startStr);
  const end = fromDateKey(endStr);
  while (current <= end) {
    dates.push(toDateKey(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

/**
 * Day key `n` days before today, in local time.
 * @param {number} n
 * @returns {string}
 */
export const daysAgoKey = (n) => {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return toDateKey(date);
};
