# Verifsage form proxy (Cloudflare Worker)

This small serverless function does two things, server-side, so no secret keys
ever touch the browser:

1. Verifies the visitor's reCAPTCHA token with Google using your **secret key**.
2. If (and only if) that verification succeeds, forwards the submission on to
   your HubSpot form.

## One-time setup

You'll need a free [Cloudflare account](https://dash.cloudflare.com/sign-up)
and Node.js installed locally.

```bash
# 1. Install the Cloudflare CLI (one-time)
npm install -g wrangler

# 2. Log in
wrangler login

# 3. From inside this folder, set your reCAPTCHA secret key as a Worker secret
#    (get it from https://www.google.com/recaptcha/admin — it's the SECOND
#    key on that page, not the site key you already added to index.html)
wrangler secret put RECAPTCHA_SECRET_KEY
# (paste the secret key when prompted)

# 4. Edit wrangler.toml and set ALLOWED_ORIGIN to your real site's URL,
#    e.g. "https://verifsage.com" (use "*" for now if you're still testing locally)

# 5. Deploy
wrangler deploy
```

Wrangler will print a URL that looks like:

```
https://verifsage-form-proxy.<your-subdomain>.workers.dev
```

Copy that URL into the `WORKER_URL` constant near the top of the `<script>`
block in `index.html`.

## Don't forget — in HubSpot

CAPTCHA / spam protection must be switched **OFF** on both forms inside
HubSpot itself (Marketing → Forms → each form → Options). This proxy verifies
reCAPTCHA independently before forwarding, but HubSpot's own API will still
reject the forwarded submission with a `FORM_HAS_RECAPTCHA_ENABLED` error if
its own CAPTCHA toggle is left on — that restriction applies regardless of
who calls the API.

## Testing

Once deployed, submit a real test entry on both the waitlist and contact
forms on your live site and confirm:
- The entry shows up in HubSpot as a contact.
- Opening your browser's Network tab shows a request to your `.workers.dev`
  URL returning `{"ok": true}`.
