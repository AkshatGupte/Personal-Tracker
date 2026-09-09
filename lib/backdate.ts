/**
 * Which day an activity may be recorded on, as pure functions.
 *
 * Nothing here touches the database or React. The same rules run in the day
 * chips the interface offers, in the server action before a write, and in the
 * test suite with no browser at all — which is the point: a rendered page
 * describes a window that may have rolled over since, so the chips are a
 * courtesy and the server check is the rule.
 *
 * **The wire format is a `yyyy-mm-dd` day key, never a `Date`.** A key is what
 * `dayKey` already produces, it is what every activity figure in the app is
 * grouped by, and it carries no instant for a timezone to reinterpret on the
 * way across the server boundary. A `Date` sent from the browser would arrive
 * as a moment that then has to be re-resolved to a day, which is exactly the
 * step that made `toISOString().slice(0, 10)` a day early east of Greenwich.
 */

import { addDays, dayKey, daysBetween, parseDayKey, startOfDay } from "@/lib/day";
import { BACKDATE_DAYS } from "@/lib/windows";

/** Spelled out rather than taken from `toLocaleDateString`, so a label is the
 *  same string in a test, on the server and in the browser. The app is English
 *  and single-user; a locale lookup here would only add a way to disagree. */
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type DayChoice = {
  /** `yyyy-mm-dd`. What crosses the wire. */
  key: string;
  /** 0 for today, 1 for yesterday, up to `BACKDATE_DAYS - 1`. */
  offset: number;
  /** The chip: "Today", "Yesterday", "Sat 5". */
  label: string;
  /** The band: "Sunday 6 September". */
  full: string;
  /**
   * The chip's accessible name.
   *
   * Not the same string as either of the others, and deliberately. "Sat 5" is
   * ambiguous read aloud with no column header to sit under, so the visible
   * label is `aria-hidden` and this is announced instead — but announcing only
   * the date would throw away the relative word, which is the more useful half
   * for the two days that have one. So both, where both exist.
   */
  spoken: string;
};

/** "Sunday 6 September" — a day said the way a sentence would say it. */
export function longDay(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/**
 * The days activity may be recorded on, most recent first.
 *
 * Today is the first entry and is one of the seven — see `BACKDATE_DAYS`. The
 * order is deliberate: the default is at the start, where a chip strip is read
 * from, and going further back is going further right.
 */
export function backdateWindow(now: Date = new Date()): DayChoice[] {
  const today = startOfDay(now);
  return Array.from({ length: BACKDATE_DAYS }, (_, offset) => {
    const date = addDays(today, -offset);
    const full = longDay(date);
    const relative = offset === 0 ? "Today" : offset === 1 ? "Yesterday" : null;
    return {
      key: dayKey(date),
      offset,
      label: relative ?? `${WEEKDAYS[date.getDay()].slice(0, 3)} ${date.getDate()}`,
      full,
      spoken: relative ? `${relative}, ${full}` : full,
    };
  });
}

export type DayCheck =
  | { ok: true; date: Date; key: string; offset: number }
  | { ok: false; reason: string };

/**
 * May activity be recorded on this day?
 *
 * Three separate refusals, reported separately, because they are three
 * different mistakes: a key that is not a day at all, a day that has not
 * happened, and a day that has fallen out of the window. A single "invalid
 * date" would leave the reader guessing which.
 *
 * The round-trip through `dayKey` is what rejects `2026-02-31`: `parseDayKey`
 * builds a local `Date`, which rolls a day the month does not have into the
 * next month, so the key it formats back to no longer matches the one given.
 */
export function canLogOn(key: string, now: Date = new Date()): DayCheck {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    return { ok: false, reason: "That is not a date." };
  }
  const date = parseDayKey(key);
  if (Number.isNaN(date.getTime()) || dayKey(date) !== key) {
    return { ok: false, reason: "That is not a date." };
  }

  const offset = daysBetween(date, now);
  if (offset < 0) {
    return { ok: false, reason: "That day has not happened yet." };
  }
  if (offset > BACKDATE_DAYS - 1) {
    return {
      ok: false,
      reason: `Activity can only be recorded for the last ${BACKDATE_DAYS} days.`,
    };
  }
  return { ok: true, date, key, offset };
}

/**
 * What a backdated write did to the streak, in words, or nothing.
 *
 * Backdating retroactively changes streaks because streaks are derived, and
 * that is correct — the streak describes what happened, not what was typed in
 * when. It is stated rather than hidden: filling in yesterday can revive a run
 * that read as broken, and a number that silently jumps is a number nobody
 * trusts.
 *
 * **Both directions, one function.** A backdated undo can break a run just as a
 * backdated record can revive one, and the two have to be told the same way —
 * two functions would be two places for the wording to drift.
 *
 * **A description, never a celebration.** The streak is a consistency signal
 * and consistency is described in this app, never scored — no shatter, no
 * banner, no XP, in either direction. `null` when nothing moved, so the caller
 * shows nothing at all rather than "no change", which is noise.
 */
export function describeStreakChange(before: number, after: number): string | null {
  if (after === before) return null;
  const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
  if (after > before) {
    return before === 0 ? `Streak restored — ${days(after)}.` : `Streak now ${days(after)}.`;
  }
  return after === 0 ? `Streak lost — was ${days(before)}.` : `Streak now ${days(after)}.`;
}
