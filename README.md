# Verifsage form proxy (Cloudflare Worker)

This small serverless function does two things, server-side, so no secret keys
ever touch the browser:

1. Verifies the visitor's Cloudflare Turnstile token using your **secret key**.
2. If (and only if) that verification succeeds, forwards the submission on to
   your HubSpot form.

Turnstile replaces Google reCAPTCHA. It runs silently in the background: most
visitors never see anything, and only traffic Cloudflare finds suspicious is
shown a single checkbox.

## One-time setup

You'll need a free [Cloudflare account](https://dash.cloudflare.com/sign-up)
and Node.js installed locally.

### 1. Create the Turnstile widget

1. In the Cloudflare dashboard, open **Turnstile** and choose **Add widget**.
2. Name it (e.g. "Verifsage website") and add your hostnames, e.g.
   `verifsage.com` and `www.verifsage.com`. Add `localhost` too if you want to
   test locally.
3. Widget mode: choose **Managed** (recommended). The site already renders the
   widget with `appearance: 'interaction-only'`, so it stays hidden unless a
   visitor needs to click. Choose **Invisible** if you never want anything shown.
4. Copy the **Site key** and the **Secret key**.

### 2. Add the site key to the website

In `index.html`, find `TURNSTILE_SITE_KEY` near the top of the main `<script>`
block and paste in the site key.

### 3. Deploy the Worker

```bash
# Install the Cloudflare CLI (one-time)
npm install -g wrangler

# Log in
wrangler login

# From inside this folder, store the Turnstile SECRET key as a Worker secret
wrangler secret put TURNSTILE_SECRET_KEY
# (paste the secret key when prompted)

# Optional: remove the old reCAPTCHA secret, which is no longer used
wrangler secret delete RECAPTCHA_SECRET_KEY

# Edit wrangler.toml and set ALLOWED_ORIGIN to your real site's URL,
# e.g. "https://verifsage.com" (use "*" only while testing)

# Deploy
wrangler deploy
```

Wrangler prints a URL like:

```
https://verifsage-form-proxy.<your-subdomain>.workers.dev
```

Make sure that URL is in the `WORKER_URL` constant in `index.html`.

## Testing locally

Cloudflare provides test keys that need no account setup:

| Purpose | Key |
| --- | --- |
| Site key, always passes (visible) | `1x00000000000000000000AA` |
| Site key, always passes (invisible) | `1x00000000000000000000BB` |
| Site key, forces an interactive challenge | `3x00000000000000000000FF` |
| Secret key, always passes | `1x0000000000000000000000000000000AA` |

Use a test site key in `index.html` and the test secret in the Worker
(`wrangler secret put TURNSTILE_SECRET_KEY`), then switch both to your real
keys before going live. Real and test keys can't be mixed.

## Don't forget: in HubSpot

CAPTCHA / spam protection must be switched **OFF** on both forms inside
HubSpot itself (Marketing → Forms → each form → Options). This proxy verifies
Turnstile independently before forwarding, but HubSpot's own API will still
reject the forwarded submission with a `FORM_HAS_RECAPTCHA_ENABLED` error if
its own CAPTCHA toggle is left on. That restriction applies regardless of
who calls the API.

## Checking it works

Once deployed, submit a real test entry on both the waitlist and contact
forms on your live site and confirm:
- The entry shows up in HubSpot as a contact.
- Your browser's Network tab shows a request to your `.workers.dev` URL
  returning `{"ok": true}`.
- If it returns `Verification failed`, the `detail` field holds Cloudflare's
  error code (e.g. `invalid-input-secret` means the Worker secret is wrong;
  `timeout-or-duplicate` means a token was reused or expired).
