# Data Model

Core backend concepts:

- `Profile`: authenticated user profile.
- `Organization`: internal name for the billable building account: owner, plan tier, and max device capacity.
- `Membership`: user role within a building account.
- `Device`: RFID door reader assigned to the selected building account.
- `RfidTag`: passive tag UID and assignment state.
- `Participant`: operational participant record. Avoid medical diagnosis details in v1.
- `Alert`: wandering/proximity event placeholder for future ingestion.
- `PromoCode` and `OrgGrantAudit`: admin grants and plan/device-capacity exceptions.
- `DeviceActivation`: existing web/client capacity activation mechanism inherited from the baseline app.

## Role Model

- `owner`: billing, devices, team, settings, and building account management.
- `admin`: devices, alerts, participants, and team operations.
- `viewer`: read-only dashboard access.
