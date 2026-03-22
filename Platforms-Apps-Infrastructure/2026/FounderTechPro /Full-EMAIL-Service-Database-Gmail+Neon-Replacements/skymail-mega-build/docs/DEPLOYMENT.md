# Deployment Order

1. Hetzner
   - bring up `infra/hetzner/`
   - run the runner service
   - apply `database/control-schema.sql`

2. Cloudflare
   - deploy `workers/control-plane/`
   - set worker vars + secrets

3. Netlify (operator)
   - deploy `apps/platform-admin/`
   - optionally deploy `apps/platform-public/`

4. Stalwart
   - create the mail authority
   - verify hosted domains
   - turn on MX / SPF / DKIM / DMARC

5. Netlify (product)
   - deploy `apps/skymail-web/`
   - set `SKYMAIL_DATABASE_URL`
   - set all Stalwart and app secrets

6. Product bootstrap
   - run `node tools/bootstrap-skymail-db.js` from `apps/skymail-web/`
   - test signup
   - test send / receive / drafts / spam / trash / contacts / settings
