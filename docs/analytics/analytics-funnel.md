# Analytics and Funnel Guide

WanderAware uses PostHog on the public landing page.

## Current Funnel Events

- `landing_page_view`
- `site_click`
- `waitlist_cta_click`
- `waitlist_form_start`
- `waitlist_form_submit_attempt`
- `waitlist_form_submit_success`
- `reserve_cta_click`
- `reserve_form_view`
- `reserve_form_start`
- `reserve_form_submit_attempt`
- `reserve_form_submit_success`
- `faq_open`
- `email_cta_click`

## Outreach Links

Use UTM parameters for campaign analysis and non-PII identifiers for lead attribution. Prefer hashed or CRM IDs over raw email addresses in URLs.

Example:

```text
https://wanderaware.com/?utm_source=email&utm_medium=outreach&utm_campaign=adult_daycare_batch_01&utm_content=owner_operator_v1&outreach_id=batch_01&audience=adult_daycare&persona=owner_operator&variant=pain_point_a&lead_id=crm_123
```
