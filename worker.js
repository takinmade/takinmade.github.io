/**
 * Verifsage form proxy — verifies reCAPTCHA server-side, then forwards
 * the submission to HubSpot's Forms API.
 *
 * Required setup (see README.md in this folder):
 *   - Set the secret:      wrangler secret put RECAPTCHA_SECRET_KEY
 *   - Set the allowed origin in wrangler.toml -> [vars] ALLOWED_ORIGIN
 *   - Deploy:               wrangler deploy
 *   - Put the resulting *.workers.dev URL into WORKER_URL in index.html
 *
 * IMPORTANT: HubSpot will still reject the forward if CAPTCHA / spam
 * protection is left switched ON for the form inside HubSpot itself.
 * That setting must be turned OFF on both forms in HubSpot regardless
 * of this proxy — the restriction is per-form, not per-caller.
 */

const CONSENT_TEXT = 'I agree to allow Verifsage to store and process my personal data.';

export default {
  async fetch(request, env, ctx) {
    const headers = corsHeaders(env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405, headers);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ ok: false, error: 'Invalid JSON body' }, 400, headers);
    }

    const { recaptchaToken, portalId, formId, fields, pageUri, pageName } = body;

    if (!recaptchaToken) {
      return json({ ok: false, error: 'Missing reCAPTCHA token' }, 400, headers);
    }
    if (!portalId || !formId || !Array.isArray(fields)) {
      return json({ ok: false, error: 'Missing form data' }, 400, headers);
    }

    // ---- 1. Verify the token with Google, server-side ----
    let verifyData;
    try {
      const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: env.RECAPTCHA_SECRET_KEY,
          response: recaptchaToken
        })
      });
      verifyData = await verifyRes.json();
    } catch (e) {
      return json({ ok: false, error: 'reCAPTCHA verification request failed' }, 502, headers);
    }

    if (!verifyData.success) {
      return json({ ok: false, error: 'reCAPTCHA verification failed', detail: verifyData['error-codes'] }, 400, headers);
    }

    // ---- 2. Forward the submission to HubSpot ----
    let hsRes;
    try {
      hsRes = await fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${portalId}/${formId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields,
          context: {
            pageUri: pageUri || '',
            pageName: pageName || ''
          },
          legalConsentOptions: {
            consent: {
              consentToProcess: true,
              text: CONSENT_TEXT
            }
          }
        })
      });
    } catch (e) {
      return json({ ok: false, error: 'Could not reach HubSpot' }, 502, headers);
    }

    if (!hsRes.ok) {
      const detail = await hsRes.text();
      return json({ ok: false, error: 'HubSpot submission failed', detail }, 502, headers);
    }

    return json({ ok: true }, 200, headers);
  }
};

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers });
}
