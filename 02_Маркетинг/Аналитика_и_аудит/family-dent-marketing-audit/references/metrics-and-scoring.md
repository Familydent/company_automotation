# Metrics and scoring

## Efficiency

- Cost per lead = budget / leads when leads > 0.
- Cost per booked patient = budget / booked patients when booked patients > 0.
- Cost per arrived patient = budget / arrived patients when arrived patients > 0.
- Lead-to-booking rate = booked patients / leads when leads > 0.
- Booking-to-arrival rate = arrived patients / booked patients when booked patients > 0.
- Revenue per arrived patient = revenue / arrived patients when arrived patients > 0.

Do not infer attribution or profit. Report ROI/ROAS only when the source explicitly defines attributed revenue and the user has approved that definition.

## Presence index

Use a transparent normalized index only when enough components are observed. Suggested components are:

- public mentions and recommendations;
- visible reach/views/engagement;
- review volume and average rating by platform;
- rating movement;
- search visibility for a stable query set;
- controlled ChatGPT/search test-query appearance.

Show component values, observation dates, missing components, and the formula/weights in the workbook. Do not present the index as an industry-standard score. If weighting is not specified by the user, use equal weights among available components and label the result as an internal monitoring index.

