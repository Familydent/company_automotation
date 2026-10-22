---
name: administrator-call-auditor
description: Audit dental clinic administrator-patient calls from transcripts or call datasets for observable communication quality, conversion behavior, patient experience, and actionable training priorities. Use for individual calls, batches, weekly reports, or week-over-week analysis; do not use to judge personality or make medical decisions.
metadata:
  short-description: Audit Family Dent calls and improve conversion
---

# Administrator Call Auditor

Use this skill for Family Dent, Dushanbe call-quality audits. The goal is to improve the system, patient experience, and measurable conversion while treating administrators fairly and constructively.

## Operating rules

- Accept one transcript, multiple transcripts, or CSV/XLSX/JSON call records. Use the fields available; state what is missing.
- Treat patient data as confidential. Prefer anonymized patient identifiers and omit unnecessary personal information.
- Separate observed facts, interpretations, and missing evidence. Never invent a quote, event, outcome, tone, or reason for a failed booking.
- Judge observable behaviors and adherence to call-handling standards, not personality. Do not infer emotion from text alone. Flag sighs, irritation, or fatigue only when explicit audio analysis or transcript metadata supports them.
- Do not treat a missed booking as administrator fault automatically. Attribute the likely cause only when evidence supports it; otherwise use insufficient evidence. Distinguish administrator behavior, patient behavior, clinic availability, price, doctor availability, unclear information, technical issue, and other causes.
- Never recommend hiding prices, deception, pressure, or medical treatment decisions.
- Do not rank or shame employees. Compare patterns, categories, and development priorities.

Read [references/scoring-rubric.md](references/scoring-rubric.md) before scoring. For datasets, also read [references/dataset-and-weekly-analysis.md](references/dataset-and-weekly-analysis.md). Use the templates in `templates/` for consistent outputs.

## Choose the output mode

- “Analyze this call”: produce one individual audit and scorecard.
- “Analyze these calls”: produce per-call audits plus an aggregate batch summary when enough records exist.
- “Prepare weekly report”: produce the weekly report for the relevant date range.
- “How are administrators performing?”: summarize evidence by category and administrator without ranking people.
- “What should we train?”: identify the highest-frequency, highest-impact recurring behaviors and convert them into training modules.

## Individual call workflow

1. Normalize available metadata without filling gaps. Record call ID, date, administrator, duration, source, anonymized patient ID, request, outcome, and any data-quality limitation.
2. Build an event timeline: inquiry received; need identified; service identified; price requested/provided; consultation offered; appointment time proposed; appointment booked; objection raised/handled; patient declined or said they would think; follow-up proposed/missing; and clear next step or no next step.
3. Score all eight categories for 100 points: greeting/opening (10), needs discovery (20), active listening/communication (15), consultation and booking conversion (20), price handling (10), objection handling (10), closing/follow-up (10), and patient experience/professionalism (5). Do not penalize a category for evidence the recording cannot establish.
4. Verify the arithmetic total and attach evidence to every material criticism. Use the pattern “Observation / Why it matters / Better approach.”
5. Report strengths, missed opportunities, critical errors, better phrases, and exactly one next training priority. Include only critical errors that materially affect experience or conversion.

## Batch and weekly workflow

Aggregate only from usable records and state the denominator for each percentage. Calculate booking rate only when outcome fields support it. Report total calls, calls per administrator, average duration, average score, category scores, comparison by administrator, frequent mistakes, conversion breakdowns, successful patterns, training priorities, management recommendations, and 3–7 next-week actions.

Separate recommendations into administrator training, process, pricing, availability, CRM/follow-up, and marketing lead quality. Describe successful patterns as associations unless the data supports a stronger conclusion. For week-over-week comparison show previous week, current week, change, and evidence-based interpretation; do not claim improvement without comparable data.

Recurring errors should become training modules with: problem, why it matters, correct behavior, three example phrases, role-play scenario, practice exercise, and evaluation criteria. If the user requests files, use the output names `individual_call_audit.md`, `administrator_scorecard.csv`, `weekly_call_center_report.md`, `training_recommendations.md`, and `recurring_errors.csv` as applicable. Use structured tables for spreadsheet outputs.

## Quality gate

Before delivering, check: every score is evidence-based; total is mathematically correct; quotes are exact or clearly paraphrased; missing information is labeled; lack of evidence is not scored as failure; tone claims have support; no employee ranking or blame appears; recommendations are actionable; and privacy is preserved.
