/**
 * Date-key helpers must produce the calendar day the USER is in, not the UTC
 * day. The previous implementation used toISOString(), which shifted every
 * key one day early anywhere east of UTC — cycle predictions landed a day
 * early and a mood logged before 05:30 IST was stamped to the previous day.
 */
import { toDateKey, fromDateKey, addDays, getDaysInRange, toMonthKey, daysAgoKey, todayKey } from '../lib/date';

describe('toDateKey / fromDateKey', () => {
  it('formats a local date without shifting to UTC', () => {
    // Local midnight on 1 Sep — the failure case for UTC+ timezones.
    expect(toDateKey(new Date(2026, 8, 1, 0, 0, 0))).toBe('2026-09-01');
    // Late evening local — the failure case for UTC- timezones.
    expect(toDateKey(new Date(2026, 8, 1, 23, 59, 59))).toBe('2026-09-01');
    // Early morning, which used to roll back a day in IST.
    expect(toDateKey(new Date(2026, 8, 2, 2, 0, 0))).toBe('2026-09-02');
  });

  it('zero-pads months and days', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('round-trips through fromDateKey', () => {
    expect(toDateKey(fromDateKey('2026-09-01'))).toBe('2026-09-01');
    expect(fromDateKey('2026-09-01').getHours()).toBe(0);
  });
});

describe('addDays', () => {
  it('is identity for zero', () => {
    expect(addDays('2026-09-01', 0)).toBe('2026-09-01');
  });

  it('advances a typical cycle length', () => {
    expect(addDays('2026-09-01', 28)).toBe('2026-09-29');
  });

  it('handles negative offsets', () => {
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
  });

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('getDaysInRange', () => {
  it('is inclusive of both ends', () => {
    expect(getDaysInRange('2026-09-01', '2026-09-05')).toEqual([
      '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05',
    ]);
  });

  it('returns a single day when start equals end', () => {
    expect(getDaysInRange('2026-09-01', '2026-09-01')).toEqual(['2026-09-01']);
  });

  it('returns empty when end precedes start', () => {
    expect(getDaysInRange('2026-09-05', '2026-09-01')).toEqual([]);
  });

  it('crosses a month boundary', () => {
    expect(getDaysInRange('2026-08-30', '2026-09-02')).toEqual([
      '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02',
    ]);
  });
});

describe('todayKey / toMonthKey / daysAgoKey', () => {
  it('agree with each other and with local time', () => {
    const now = new Date();
    expect(todayKey()).toBe(toDateKey(now));
    expect(toMonthKey()).toBe(toDateKey(now).substring(0, 7));
    expect(daysAgoKey(0)).toBe(todayKey());
  });

  it('daysAgoKey(6) spans a 7-day inclusive window', () => {
    expect(getDaysInRange(daysAgoKey(6), todayKey())).toHaveLength(7);
  });

  it('produces keys that sort chronologically as strings', () => {
    // Firestore ordering and the app's date comparisons rely on this.
    expect(daysAgoKey(6) <= todayKey()).toBe(true);
    expect(addDays('2026-09-09', 0) > addDays('2026-09-08', 0)).toBe(true);
  });
});
