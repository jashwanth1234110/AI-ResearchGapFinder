"""Extracts the literal prompt text from the engine source into
prompts_appendix.md, so the appendix cannot drift from the code."""
import re, pathlib
SRC = pathlib.Path("engine/engine")
out = ["# Prompt Appendix — ResearchGap AI",
       "",
       "Extracted verbatim from source by `paper_eval/dump_prompts.py`.",
       "Every prompt below is a *user* message unless marked SYSTEM.",
       ""]
def block(title, path, start, end, note=""):
    lines = (SRC/path).read_text().splitlines()[start-1:end]
    out.extend([f"## {title}", "", f"Source: `engine/engine/{path}` lines {start}–{end}", ""])
    if note: out.extend([note, ""])
    out.extend(["```python", *lines, "```", ""])
block("1. Agentic validation — query generation (Stage 5)", "agent.py", 42, 59,
      "Model: `AGENT_MODEL` (default `claude-haiku-4-5-20251001`). "
      "**temperature=0, max_tokens=200.** This is the ONLY LLM call in the validation stage — "
      "the LLM writes search queries; it does NOT judge the candidate.")
block("2. Report synthesis (Stage 6)", "synth.py", 36, 66,
      "Model: `SYNTH_MODEL` (default `claude-sonnet-4-6`). "
      "**max_tokens=2000, temperature NOT SET (SDK default).** Single user message, no system prompt.")
block("3. Report-grounded chat — SYSTEM prompt", "chat.py", 28, 52,
      "Model: `CHAT_MODEL` (default `claude-haiku-4-5-20251001`). **max_tokens=1000, temperature NOT SET.** "
      "Passed as the `system=` parameter; conversation history is replayed as messages.")
pathlib.Path("paper_eval/prompts_appendix.md").write_text("\n".join(out)+"\n")
print("wrote paper_eval/prompts_appendix.md")
