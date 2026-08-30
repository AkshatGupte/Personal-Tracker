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

- Users can **create their own goals/tracks** (Track → Topic → Task
  hierarchy) rather than being limited to hardcoded subjects
- Progress is measured by **tasks completed**, with **strict, non-forgiving
  streaks** to enforce consistency
- A **smart coverage engine** compares logged progress against a subject's
  expected curriculum and flags gaps or imbalance
- An **LLM-powered insight layer** generates intelligent, non-generic remarks
  (gaps, pace, imbalance, milestones) based on the user's actual data
- **Weekly/monthly rollups** deliver a Duolingo-style dopamine hit,
  reinforcing the habit loop

## System Classification

Standard web app + one-shot LLM calls. **Not agentic** — no autonomous
multi-step decision-making, no background agents, no model-initiated actions.

## MVP Feature List

### Phase 1 — Core Tracking
- Create/edit/delete Tracks
- Add Topics under a Track (manual or LLM-suggested curriculum)
- Add Tasks under a Topic
- Mark tasks as complete
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
  Track → Topic → Task showing what has been learned, what remains, and the
  progression through it. The form — tree, dependency graph, mind map,
  progression path, radial, terrain-based or otherwise — is deliberately left
  open until the real learning experience and data model have been evaluated.
  Prerequisite/dependency relations follow that decision, if needed at all.

## Explicit Non-Goals

- Multi-user support / accounts / auth
- Autonomous or agentic AI (no self-adjusting study plans, no background
  decision-making)
- Mobile app
- Social/leaderboard features (not requested — revisit only if asked)

## Success Criteria (MVP)

- User can create a track, add topics/tasks, and mark completions without
  friction
- Streaks correctly reset on missed days
- Weekly/monthly views accurately reflect logged data
- Coverage gap detection correctly flags untouched topics against the
  LLM-suggested curriculum
- Insight remarks are specific to the user's actual data, not generic
  filler text
