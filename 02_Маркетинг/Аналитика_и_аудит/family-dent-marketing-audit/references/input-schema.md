# Input schema

Map source files into these canonical fields without overwriting the original source values:

| Field | Meaning | Required |
|---|---|---|
| `period_start`, `period_end` | Reporting interval | Yes |
| `budget` | Marketing spend for the same interval | Yes |
| `leads` | Leads attributed under the source's definition | Yes |
| `booked_patients` | Patients who booked an appointment | Yes |
| `arrived_patients` | Patients who arrived | Yes |
| `revenue` | Revenue associated with the stated interval | Yes |
| `booking_period` | Period when the appointment was booked | Preferred |
| `arrival_period` | Period when the patient arrived | Preferred |
| `new_arrived_patients` | Arrived patients identified as new | Critical if available |
| `channel` | Marketing channel/campaign when supplied | Optional |

Rules:

- Preserve currency and units exactly as supplied; state the currency in the workbook.
- Keep dates as typed dates in the workbook, not localized text.
- If the same metric appears with conflicting values, show both source records and flag reconciliation instead of choosing silently.
- Treat blanks as missing. Treat an explicit zero as zero.
- Aggregate only after aligning the reporting interval and metric definition.

