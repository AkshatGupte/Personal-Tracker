# Product Requirements Document (PRD)

## Problem Statement

Self-directed learners working across multiple parallel tracks (e.g. DSA,
languages, skills) lack a system that shows tangible, real-time progress and
understands whether their learning is actually well-rounded. Without visible
feedback or intelligent insight into coverage gaps, effort feels invisible
day-to-day — leading to inconsistency, imbalance (over-focusing on
comfortable topics), and abandoned goals.

## Objective

Build a multi-track, user-defined learning tracker where:

- Users can **create their own goals/tracks** (a Track holding a recursive tree
  of Topics, at most 5 levels deep) rather than being limited to hardcoded
  subjects
- **A leaf Topic is a persistent recurring activity, not a one-time item.** It is
  an ongoing learning activity — "Practice array problems", "Read about binary
  trees" — that stays available indefinitely and is never permanently completed.
  A Topic with children is a parent and is not worked directly.
- **Working a leaf is counted, not ticked.** Each click records one activity for
  that node today; several clicks in a day are allowed and the most recent can be
  undone. This replaced an earlier once-per-day check-in model.
- Progress is measured by **daily activity and coverage**, with **strict,
  non-forgiving streaks** to enforce consistency
- A **smart coverage engine** compares logged progress against a subject's
  expected curriculum and flags gaps or imbalance
- An **LLM-powered insight layer** generates intelligent, non-generic remarks
  (gaps, pace, imbalance, milestones) based on the user's actual data
- **The daily check-in is the core loop and must feel rewarding**: do the
  activity → check in → immediate feedback → visible progress → streak held →
  reason to return tomorrow. Weekly/monthly rollups reinforce the same loop
  over a longer window. Duolingo-style in *pattern*, not in appearance —
  adapted to Rendred's identity, and without XP, levels, badges or points
  (see Explicit Non-Goals)

## System Classification

Standard web app + one-shot LLM calls. **Not agentic** — no autonomous
multi-step decision-making, no background agents, no model-initiated actions.

## MVP Feature List

### Phase 1 — Core Tracking
- Create/edit/delete Tracks
- Add Topics under a Track (manual or LLM-suggested curriculum)
- Nest Topics under Topics, to a hard limit of 5 levels; move and reorder them
- **Work a leaf Topic — as often as you like, every day, on the same node.** Each
  click records an activity for that day and leaves the node available tomorrow;
  undo takes the most recent one back
- A leaf shows **today's** intensity; a parent shows how many of its direct
  children were worked today. Both reset with the day rather than persisting
- Strict daily streak per Track (resets to 0 on a missed day)

### Phase 2 — Progress Visibility
- Weekly progress summary (tasks completed, streak status, per-track
  breakdown)
- Monthly progress summary (same, longer window)
- Visual progress bars per Track/Topic
- Milestone markers (e.g. "50 tasks completed")

### Phase 3 — Smart Coverage & Insights
- On Track creation, LLM suggests a standard topic curriculum for that
  subject
- Coverage comparison: logged topics vs. expected curriculum (plain code,
  not LLM)
- LLM-generated short insight remarks based on progress data:
  - Coverage gaps ("Graphs and DP are untouched")
  - Pace comparison (this week vs. last week)
  - Imbalance warnings (over-indexing on one topic/difficulty)
  - Milestone-based encouragement

### Phase 4 — Personalization (future, out of MVP scope)
- User stores preferences/interests (favorite games, shows, etc.)
- Preferences injected into LLM prompt context to shape tone/framing of
  insight remarks
- No structural changes needed to ship this later — it's a prompt-layer
  addition on top of the existing insight engine

## Post-MVP Capabilities (in scope, form not yet decided)

Recorded here so they are not mistaken for out-of-scope. Both are real
product capabilities; neither has its representation chosen, and neither
should be built ahead of its phase. See `docs/ROADMAP.md`.

- **Learning trajectory / consistency over time** (Phase 2, last item):
  a representation of whether the user is consistent, whether momentum is
  improving or declining, and whether progress is sustained or bursty. Goes
  beyond the streak counter and completion percentage — those, along with the
  heatmap and terrain elevation, are inputs to it rather than the answer.
- **Track structure exploration** (Phase 5): a richer representation of
  Track → nested Topics showing what has been learned, what remains, and the
  progression through it. The form — tree, dependency graph, mind map,
  progression path, radial, terrain-based or otherwise — is deliberately left
  open until the real learning experience and data model have been evaluated.
  Prerequisite/dependency relations follow that decision, if needed at all.

## Explicit Non-Goals

- **Deployment.** Rendred runs locally on a single laptop and is not hosted
  anywhere. Everything below follows from that rather than being an
  independent choice.
- Multi-user support / accounts / auth
- Autonomous or agentic AI (no self-adjusting study plans, no background
  decision-making)
- Mobile app
- Social/leaderboard features (not requested — revisit only if asked)

## Success Criteria (MVP)

- User can create a track, build a topic tree, and record activity without friction
- **The same leaf can be worked on many different days**, and each day is
  recorded separately — and more than once within a day
- A leaf worked yesterday is available, and visibly at zero, today
- Recording activity gives immediate, legible feedback that it counted
- Streaks correctly reset on missed days
- Weekly/monthly views accurately reflect logged data
- Coverage gap detection correctly flags untouched topics against the
  LLM-suggested curriculum
- Insight remarks are specific to the user's actual data, not generic
  filler text
