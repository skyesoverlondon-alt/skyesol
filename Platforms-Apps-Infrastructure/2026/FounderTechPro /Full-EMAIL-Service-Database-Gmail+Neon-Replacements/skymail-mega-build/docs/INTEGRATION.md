# Integration Notes

## The important DSN split

Use:
- `DATABASE_URL` or Hyperdrive inside the control plane worker for the SkyeDB metadata database
- `SKYMAIL_DATABASE_URL` inside the customer-facing mail app for the dedicated SkyMail app database

## Why this split matters

It keeps:
- the control plane metadata isolated
- the customer-facing mail app data isolated
- the migration path clean when you later add more products on top of the same control plane
