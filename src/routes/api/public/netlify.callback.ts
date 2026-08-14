import { createFileRoute } from "@tanstack/react-router";

/**
 * OAuth callback. Exchanges ?code for an access token and returns a tiny
 * HTML page that postMessages the token back to the opener window, then closes.
 */
export const Route = createFileRoute("/api/public/netlify/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        const cookieHeader = request.headers.get("cookie") ?? "";
        const cookieState = /(?:^|;\s*)nf_oauth_state=([^;]+)/.exec(cookieHeader)?.[1];

        const respond = (payload: Record<string, unknown>) => {
          const json = JSON.stringify(payload).replace(/</g, "\\u003c");
          const html = `<!doctype html><meta charset="utf-8"><title>Netlify</title>
<script>
(function(){
  var data = ${json};
  try { if (window.opener) window.opener.postMessage({ source: "netlify-oauth", ...data }, "*"); } catch(e){}
  document.body && (document.body.innerText = data.ok ? "Connected. You can close this window." : ("Error: " + (data.error || "unknown")));
  setTimeout(function(){ window.close(); }, 400);
})();
</script><body style="font-family:system-ui;padding:24px;color:#111">Working…</body>`;
          return new Response(html, {
            status: 200,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Set-Cookie": "nf_oauth_state=; Path=/; Max-Age=0",
            },
          });
        };

        if (error) return respond({ ok: false, error });
        if (!code) return respond({ ok: false, error: "missing_code" });
        if (!state || !cookieState || state !== cookieState) {
          return respond({ ok: false, error: "invalid_state" });
        }

        const clientId = process.env.NETLIFY_CLIENT_ID;
        const clientSecret = process.env.NETLIFY_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          return respond({ ok: false, error: "server_misconfigured" });
        }

        const redirectUri = `${url.protocol}//${url.host}/api/public/netlify/callback`;
        try {
          const tokenRes = await fetch("https://api.netlify.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: redirectUri,
            }).toString(),
          });
          const body = (await tokenRes.json()) as {
            access_token?: string;
            error?: string;
            error_description?: string;
          };
          if (!tokenRes.ok || !body.access_token) {
            return respond({
              ok: false,
              error: body.error_description || body.error || `token_exchange_failed_${tokenRes.status}`,
            });
          }
          return respond({ ok: true, access_token: body.access_token });
        } catch (e) {
          return respond({ ok: false, error: e instanceof Error ? e.message : "exchange_failed" });
        }
      },
    },
  },
});
