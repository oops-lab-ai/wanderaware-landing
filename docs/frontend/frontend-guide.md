# Frontend Guide

The frontend uses Astro for public/static pages and React for the authenticated dashboard.

## Public Routes

- `/`: WanderAware marketing page with PostHog tracking, waitlist, reservation, and outreach attribution.

## Dashboard Routes

- `/dashboard`
- `/dashboard/buildings`
- `/dashboard/devices`
- `/dashboard/tags`
- `/dashboard/participants`
- `/dashboard/alerts`
- `/dashboard/team`
- `/dashboard/billing`
- `/dashboard/settings`
- `/dashboard/admin/orgs`
- `/dashboard/admin/grants`
- `/dashboard/admin/users`

## Theme

Default dashboard styling should use the WanderAware light palette:

- primary teal `#176E68`
- accent orange `#F97316`
- pale teal `#E6F4F2`
- light neutral backgrounds

Dark mode can exist as an option, but the default product experience is light.
