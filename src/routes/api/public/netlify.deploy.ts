import { createFileRoute } from "@tanstack/react-router";

/**
 * Server-side proxy for Netlify deploys. Browsers cannot reliably call
 * api.netlify.com directly (CORS / preflight), so the client posts the
 * zipped project here with its PAT and we forward to Netlify.
 *
 * Request:
 *   POST /api/public/netlify/deploy?siteId=<optional>&siteName=<optional>
 *   Headers: x-netlify-token: <pat>
 *   Body:    application/zip (the project zip)
 *
 * Response: { ok: true, siteId, url } or { ok: false, error }
 */
export const Route = createFileRoute("/api/public/netlify/deploy")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, x-netlify-token",
          },
        }),
      POST: async ({ request }) => {
        const cors = {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        };
        const token = request.headers.get("x-netlify-token");
        if (!token) {
          return new Response(JSON.stringify({ ok: false, error: "Missing token" }), {
            status: 400,
            headers: cors,
          });
        }
        const url = new URL(request.url);
        let siteId = url.searchParams.get("siteId") || "";
        const siteName = url.searchParams.get("siteName") || "";

        try {
          if (!siteId) {
            const createRes = await fetch("https://api.netlify.com/api/v1/sites", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(siteName ? { name: siteName } : {}),
            });
            if (!createRes.ok) {
              const txt = await createRes.text();
              return new Response(
                JSON.stringify({ ok: false, error: `create_site_${createRes.status}: ${txt}` }),
                { status: 200, headers: cors },
              );
            }
            const site = (await createRes.json()) as { id: string };
            siteId = site.id;
          }

          const zipBuf = await request.arrayBuffer();
          const deployRes = await fetch(
            `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/zip",
              },
              body: zipBuf,
            },
          );
          if (!deployRes.ok) {
            const txt = await deployRes.text();
            return new Response(
              JSON.stringify({ ok: false, error: `deploy_${deployRes.status}: ${txt}` }),
              { status: 200, headers: cors },
            );
          }
          const deploy = (await deployRes.json()) as {
            deploy_ssl_url?: string;
            deploy_url?: string;
            ssl_url?: string;
            url?: string;
          };
          const deployUrl =
            deploy.deploy_ssl_url || deploy.deploy_url || deploy.ssl_url || deploy.url || null;
          return new Response(
            JSON.stringify({ ok: true, siteId, url: deployUrl }),
            { status: 200, headers: cors },
          );
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "unknown" }),
            { status: 200, headers: cors },
          );
        }
      },
    },
  },
});
