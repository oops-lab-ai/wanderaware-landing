# Data Model

Core backend concepts:

- `Profile`: authenticated user profile.
- `Organization`: customer account, owner, plan tier, and max device capacity.
- `Membership`: user role within an organization.
- `Building`: organization-owned care site or facility.
- `Device`: RFID door reader assigned to a building.
- `RfidTag`: passive tag UID and assignment state.
- `Participant`: operational participant record. Avoid medical diagnosis details in v1.
- `Alert`: wandering/proximity event placeholder for future ingestion.
- `PromoCode` and `OrgGrantAudit`: admin grants and plan/device-capacity exceptions.
- `DeviceActivation`: existing web/client capacity activation mechanism inherited from the baseline app.

## Role Model

- `owner`: billing, buildings, devices, team, settings.
- `admin`: buildings, devices, alerts, participants.
- `viewer`: read-only dashboard access.
