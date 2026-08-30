---
name: llm-call-conventions
description: Use when writing or modifying any code that calls the Anthropic API (curriculum suggestions, insight remarks, coverage analysis).
---

# LLM Call Conventions

- All calls are ONE-SHOT and STATELESS — no conversation loops, no
  autonomous multi-step tool use, no background/scheduled agents
- Use `claude-haiku-4-5` unless there's a specific documented reason to
  use a larger model
- Always request structured JSON output for anything the UI needs to
  render programmatically
- Gap/coverage comparison logic (comparing logged topics vs. expected
  curriculum) happens in plain application code — the LLM is only used for
  generating the curriculum list and the final insight text, not for the
  comparison itself
- Keep prompts short and specific — pass in only the data needed for that call
- This is not an agentic system — do not add planning loops, tool-calling
  by the model, or autonomous decision-making without explicit discussion
  first (see CLAUDE.md "Explicit Non-Goals")
