# Functions Temporarily Disabled for Deploy Stability

This directory is intentionally empty.

`netlify.toml` currently points `[functions].directory` here as a temporary workaround because Netlify function uploads are failing with:

- `Your environment variables exceed the 4KB limit...`

Once environment variables are reduced in Netlify Site Settings, switch `netlify.toml` back to:

```toml
[functions]
  directory = "netlify/functions"
```
