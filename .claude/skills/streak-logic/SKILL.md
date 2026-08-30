---
name: streak-logic
description: Use when writing, reviewing, or debugging any code related to streak calculation, CompletionLog, or task-completion tracking.
---

# Streak Logic Rules

- Streaks are STRICT — a missed day resets `currentStreak` to 0. No grace
  periods, no streak freezes, no forgiveness logic of any kind
- Streak scope is per-Track, not global — completing a task in one track
  does not protect another track's streak
- On any task completion: upsert today's `CompletionLog` row for that
  track (one row per track per day)
- Streak reset check: compare `lastActivityDate` to today's date — if more
  than 1 day has elapsed with no CompletionLog entry, reset
  `currentStreak` to 0 before displaying it
- Always update `longestStreak` if `currentStreak` surpasses it
- Reference `docs/SCHEMA.md` "Key Logic Notes" section before changing
  this logic — do not reinvent the rules
