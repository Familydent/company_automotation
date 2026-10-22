# Dataset and weekly analysis guide

## Accepted record shape

Use `call_id`, `date`, `administrator`, `patient_id` or anonymized ID, `duration`, `source`, `transcript`, `outcome`, `appointment_date`, `treatment` or `service`, `lead_status`, and optional revenue. Preserve extra columns when they clarify attribution or data quality.

Normalize dates and durations only when unambiguous. Keep raw values available for auditability. If a transcript is absent, do not score transcript-dependent behavior; if audio cannot be analyzed, request or use a transcript rather than pretending to hear it.

## Aggregation rules

- State the usable-record count and denominator beside every rate or percentage.
- Booking rate requires a defined booking outcome and a denominator of records with usable outcome data.
- Error frequency requires a defined event or red-flag field; otherwise count only audited records where the issue was assessed.
- Average score requires comparable completed scorecards; do not average missing categories as zero.
- Associate behaviors with successful bookings descriptively. Avoid causal claims unless the design supports them.
- For weekly comparison, use equivalent date windows and definitions. Show `Previous week`, `Current week`, `Change`, and `Interpretation`.

## Attribution categories

Use one primary supported cause when possible: administrator behavior, patient behavior, clinic availability, price, doctor availability, unclear information, technical issue, other, or insufficient evidence. Add a secondary factor only when the records support it. Do not force attribution.

## Required weekly sections

Executive summary; calls analyzed; average administrator score; score by category; administrator comparison without ranking; most frequent mistakes; conversion-related failures; successful patterns; training priorities; recommended scripts; management recommendations by training/process/pricing/availability/CRM or follow-up/lead quality; and a 3–7 item next-week action plan.
