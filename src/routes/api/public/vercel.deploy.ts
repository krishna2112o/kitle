import { createFileRoute } from "@tanstack/react-router";

/**
 * Server-side proxy for Vercel deploys. Avoids browser CORS issues by
 * forwarding the project files to api.vercel.com from the server.
 *
 * Request:
 *   POST /api/public/vercel/deploy?name=<projectName>
 *   Headers: x-vercel-token: <token>
 *   Body:    JSON { files: { "path": "content", ... } }
 *
 * Response: { ok: true, url } or { ok: false, error }
 */
export const Route = createFileRoute("/api/public/vercel/deploy")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, x-vercel-token",
          },
        }),
      POST: async ({ request }) => {
        const cors = {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        };
        const token = request.headers.get("x-vercel-token");
        if (!token) {
          return new Response(JSON.stringify({ ok: false, error: "Missing token" }), {
            status: 400,
            headers: cors,
          });
        }
        const url = new URL(request.url);
        const rawName = (url.searchParams.get("name") || "lovable-app").toLowerCase();
        const name = rawName.replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 52) || "lovable-app";

        try {
          const { files } = (await request.json()) as { files: Record<string, string> };
          if (!files || typeof files !== "object") {
            return new Response(JSON.stringify({ ok: false, error: "Missing files" }), {
              status: 400,
              headers: cors,
            });
          }

          const filePayload = Object.entries(files).map(([path, content]) => ({
            file: path.startsWith("/") ? path.slice(1) : path,
            data: content,
          }));

          const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name,
              files: filePayload,
              projectSettings: { framework: "vite" },
              target: "production",
            }),
          });
          const body = (await deployRes.json()) as {
            url?: string;
            alias?: string[];
            error?: { message?: string; code?: string };
          };
          if (!deployRes.ok) {
            return new Response(
              JSON.stringify({
                ok: false,
                error: body.error?.message || `vercel_${deployRes.status}`,
              }),
              { status: 200, headers: cors },
            );
          }
          const deployUrl = body.url ? `https://${body.url}` : null;
          return new Response(
            JSON.stringify({ ok: true, url: deployUrl }),
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
