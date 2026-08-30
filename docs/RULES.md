# RULES.md — Development Reporting

This file defines a standing rule for every Claude Code session on this
project: **keep `docs/DEV_REPORT.md` up to date as you build.**

## When to update the report

Update `docs/DEV_REPORT.md` any time you:
- Finish building a feature or a meaningful chunk of one
- Make a non-trivial architecture or design decision
- Set up a new piece of infrastructure (database, API route, LLM call, etc.)
- Complete a roadmap item from `docs/ROADMAP.md`

Do this **as part of the work**, not as an afterthought — append a new entry
before ending the session/task, not just when explicitly asked.

## Who this report is for

The user is following along but is **not necessarily deep into technical
jargon**. Write every entry so a smart non-engineer could read it and
actually understand what was built and why. This means:

- Use simple, everyday words. Avoid unexplained jargon.
- If you must use a technical term (e.g. "ORM", "API route", "streak
  reset logic"), briefly explain it in plain words the first time it's used
  in an entry — one short clause is enough, don't over-explain.
- Prefer concrete language over abstract language ("this saves the task to
  the database when you click the checkbox" instead of "this persists task
  state via mutation").

## Required structure per entry

Each entry in `docs/DEV_REPORT.md` must cover three things, in this order:

1. **What was built** — plain-language summary of the feature/change,
   1-3 sentences. What can the user now do that they couldn't before?

2. **System architecture & flow** — how the pieces connect for this
   feature. Describe it as a simple step-by-step flow, e.g.:
   > "When you click 'Mark Complete' on a task → the app sends that update
   > to the database → the database updates the task's status and today's
   > completion count → the streak calculator checks if today already has
   > activity logged → the UI refreshes to show the updated streak."

   Use a simple arrow-flow or numbered list, not a formal diagram, unless
   the user asks for one.

3. **Technical concepts used** — a short bullet list naming what was used
   and, in one line each, why. e.g.:
   - "Prisma (a tool that lets code talk to the database without writing
     raw SQL) — used to create/update Task and CompletionLog records"
   - "Claude Haiku API call — used to generate the suggested topic list
     when a new Track is created"

## Entry format template

```markdown
## [Date] — [Feature/Change Name]

**What was built:**
...

**How it works (flow):**
1. ...
2. ...
3. ...

**Technical concepts used:**
- ...
- ...

**Roadmap status:** links to the relevant Phase/item in docs/ROADMAP.md,
and marks it [x] complete there if finished.
```

## Handoff files (on request)

When the user asks to create a **handoff file** (e.g. "make a handoff file",
"prep this for a new session/chat"), create a new file at
`docs/handoffs/HANDOFF_[date].md` containing everything a completely fresh
Claude Code session — with no memory of this conversation — would need to
pick up work seamlessly. Do not assume the new session will re-read the
whole conversation history; write as if it only has this one file plus the
existing project docs.

Include:

- **Where things stand right now** — which roadmap phase/item is in
  progress, what's done, what's half-done, what's explicitly not started
- **What was just being worked on** — the specific task at the moment of
  handoff, including any in-progress code, open decisions, or blockers
- **Anything decided but not yet written into DECISIONS.md** — capture it
  here AND add it to DECISIONS.md before finishing the handoff
- **Known issues / things to watch out for** — bugs noticed but not fixed,
  workarounds in place, anything fragile
- **Immediate next step** — the single clearest next action the new session
  should take, stated plainly
- **Pointers, not duplication** — reference CLAUDE.md/PRD.md/SCHEMA.md/
  ROADMAP.md/DEV_REPORT.md for anything already documented there rather
  than repeating it; the handoff file should only contain what's new,
  in-progress, or otherwise not yet captured elsewhere

Keep it plain-language, same as DEV_REPORT.md entries — the goal is that a
new session (or the user, skimming it) understands the current state in
under a minute.

## Additional rules

- Append new entries at the **top** of `docs/DEV_REPORT.md` (most recent
  first), so the user sees the latest work without scrolling.
- Never delete or rewrite past entries — this is a running log, not a
  living summary. If something built earlier gets replaced/refactored
  later, add a new entry noting the change; don't erase history.
- If a session touches multiple features, write one entry per feature,
  not one giant combined entry.
- Keep each entry tight — this is a progress report, not documentation.
  Long technical deep-dives belong in code comments or a separate doc if
  ever needed, not here.
- Also tick off the matching checkbox in `docs/ROADMAP.md` when a roadmap
  item is completed, so the two files stay in sync.
