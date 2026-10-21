---
name: family-dent-marketing-audit
description: Analyze Family Dent's weekly marketing presence and efficiency from a configured local folder of aggregate Excel/Word data plus public web and social sources, then produce a Russian Excel report with history, competitor comparison, reviews, trends, and recommendations. Use for recurring weekly marketing audits; do not use for publishing content, replying to reviews, changing campaigns, or handling patient-level data.
---

# Family Dent Marketing Audit

Use this skill for the weekly Monday audit of Family Dent's marketing performance and public media presence in Dushanbe.

## Operating boundary

- Read source files only from the configured local input folder. Accept `.xlsx`, `.xls`, `.csv`, `.docx`, and `.doc` when readable. Never search unrelated personal folders.
- Use only aggregate business metrics. Do not copy, infer, retain, or export patient names, phone numbers, IDs, contact details, medical details, appointment notes, or other personal data.
- Public-source monitoring is read-only. Do not publish, reply, edit listings, start campaigns, spend money, or contact patients.
- Save the final `.xlsx` report in the configured local output folder, normally the same folder unless the user specifies another folder. Preserve source files.
- If the input folder, output folder, reporting period, or required data is unavailable, stop and report the exact missing dependency instead of guessing.

## Weekly workflow

1. Resolve the local input and output folders. Prefer an explicit path in the request or automation configuration. If none is available, ask for it once; do not assume a broad user directory.
2. Inventory files and determine the newest complete reporting period. Read Excel/Word files without modifying them. Record source filename, period, extraction date, and any missing or conflicting fields.
3. Normalize the internal metrics to the schema in [input-schema.md](references/input-schema.md). Keep original values and provenance visible in the workbook. Required business inputs are budget, leads, booked patients, arrived patients, revenue, and the period in which the appointment was booked/attended.
4. Collect public evidence for Family Dent from the configured canonical pages and these platforms: 2GIS, Yandex Maps, Google Maps, Instagram, Facebook, TikTok, and Telegram. Capture only publicly visible aggregate or review-level information needed for analysis. Use the source list and collection rules in [sources-and-method.md](references/sources-and-method.md).
5. Compare Family Dent with Eurodent, Smile Clinic, and one additional leading Dushanbe dental clinic selected using transparent public visibility/rating criteria. If the third competitor cannot be selected reliably, label the comparison incomplete.
6. Calculate marketing efficiency and the presence index using [metrics-and-scoring.md](references/metrics-and-scoring.md). Never convert missing values to zero. Mark unavailable or non-comparable metrics as `нет данных` and reduce confidence in conclusions.
7. Build a Russian Excel report with a primary summary, period detail, public reviews/mentions, competitor comparison, recommendations, sources, and data-quality notes. Keep calculations traceable to raw inputs and preserve weekly history so monthly trends can be summarized.
8. Recalculate and validate the workbook. Check formulas, missing-input flags, duplicate periods, denominator validity, source dates, and visual readability. Render/review all output sheets before export when the workbook is created or materially changed.
9. Save one final `.xlsx` file only. Give the user a short Russian summary of key findings, limitations, and the output path.

## Required report content

- Reporting week, month-to-date context, and data freshness.
- Budget, leads, booked patients, arrived patients, revenue, cost per lead, cost per arrived patient, lead-to-booking and booking-to-arrival rates where denominators exist.
- New arrived patients as the primary operational outcome, with week-over-week and month-over-month movement.
- Public presence: mentions, views/reach when visible, review count and rating by platform, rating change, search visibility, and controlled test-query results.
- Review/mention register with platform, date, rating or sentiment, link, short neutral summary, and whether it is new since the prior run. Do not include personal identifiers beyond what is necessary to cite the public item; anonymize names in the report.
- Competitor comparison and a prioritized list of platforms/opportunities where Family Dent can strengthen presence. Recommendations must be evidence-based and limited to analysis; do not draft posts or execute actions.
- A concise month-end trend summary when enough history exists.

## ChatGPT and search visibility

Do not claim to know how often all users ask ChatGPT about Family Dent. Treat this as a proxy measurement: run a stable set of controlled queries, record date, model/search engine, query, whether Family Dent appears, position/context, and limitations. Separate observed results from inferred market demand.

## Guardrails and stopping conditions

- Do not fabricate reach, views, review counts, search volume, ROI, or competitor results. Distinguish observed, user-provided, estimated, and unavailable values.
- Do not calculate ROI/ROAS unless the revenue attribution basis is explicit. Otherwise report revenue alongside spend without claiming causal return.
- Do not compare ratings without recording platform, scale, review count, and observation date.
- Do not treat all booked patients as new patients unless the source says so.
- Stop if data is materially incomplete, contradictory, inaccessible, or appears to contain patient-level personal data. Explain what must be corrected and do not export sensitive rows.
- Public web access may be unavailable or blocked. Preserve the last known history, mark the current observation unavailable, and do not silently reuse stale values as current.

## Language and localization

Write internal instructions and supporting resources in English for stable execution. Write the workbook, summaries, labels, recommendations, and user-facing explanations in Russian. Keep technical identifiers, filenames, formulas, URLs, platform names, and tool names unchanged.

