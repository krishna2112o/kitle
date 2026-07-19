import * as esbuild from "esbuild-wasm";

let initPromise: Promise<void> | null = null;

async function ensureInit() {
  if (!initPromise) {
    initPromise = esbuild.initialize({
      wasmURL: "https://unpkg.com/esbuild-wasm@0.28.0/esbuild.wasm",
    });
  }
  await initPromise;
}

/**
 * Bundle a Sandpack-style project (Record<path, content>) into a static
 * deployable site. Returns a new file map containing `index.html` and
 * `assets/bundle.js` ready to upload to Netlify / Vercel as a static deploy.
 */
export async function bundleProject(
  files: Record<string, string>,
): Promise<Record<string, string>> {
  await ensureInit();

  // Normalize keys (strip leading slash)
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(files)) {
    map.set(k.replace(/^\/+/, ""), v);
  }

  const ENTRY_CANDIDATES = [
    "index.tsx",
    "index.ts",
    "index.jsx",
    "index.js",
    "src/index.tsx",
    "src/index.ts",
    "src/main.tsx",
    "src/main.ts",
  ];
  const entry = ENTRY_CANDIDATES.find((c) => map.has(c));
  if (!entry) throw new Error("No entry file found (index.tsx / main.tsx).");

  const EXT_TRIES = [
    "",
    ".tsx",
    ".ts",
    ".jsx",
    ".js",
    "/index.tsx",
    "/index.ts",
    "/index.jsx",
    "/index.js",
  ];

  function resolveLocal(spec: string, importer: string): string | null {
    // Resolve relative imports
    let base = "";
    if (spec.startsWith(".")) {
      const importerDir = importer.includes("/")
        ? importer.slice(0, importer.lastIndexOf("/"))
        : "";
      const parts = (importerDir ? importerDir + "/" : "").split("/").filter(Boolean);
      for (const seg of spec.split("/")) {
        if (seg === "." || seg === "") continue;
        if (seg === "..") parts.pop();
        else parts.push(seg);
      }
      base = parts.join("/");
    } else if (spec.startsWith("/")) {
      base = spec.slice(1);
    } else {
      return null;
    }
    for (const ext of EXT_TRIES) {
      if (map.has(base + ext)) return base + ext;
    }
    return null;
  }

  const cdnPlugin: esbuild.Plugin = {
    name: "lovable-bundle",
    setup(build) {
      // Local files
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.kind === "entry-point") {
          return { path: args.path, namespace: "local" };
        }
        const resolved = resolveLocal(args.path, args.importer);
        if (resolved) return { path: resolved, namespace: "local" };
        // CSS bare imports → bundle as text via esm.sh? Just mark external for css packages
        // Bare specifier → esm.sh
        return {
          path: `https://esm.sh/${args.path}?bundle-deps`,
          external: true,
        };
      });

      build.onLoad({ filter: /.*/, namespace: "local" }, (args) => {
        const contents = map.get(args.path);
        if (contents == null) return null;
        const loader: esbuild.Loader = args.path.endsWith(".css")
          ? "css"
          : args.path.endsWith(".tsx")
            ? "tsx"
            : args.path.endsWith(".ts")
              ? "ts"
              : args.path.endsWith(".jsx")
                ? "jsx"
                : args.path.endsWith(".json")
                  ? "json"
                  : "js";
        return { contents, loader };
      });
    },
  };

  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    target: "es2020",
    minify: true,
    write: false,
    sourcemap: false,
    jsx: "automatic",
    plugins: [cdnPlugin],
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });

  let js = "";
  let css = "";
  for (const out of result.outputFiles) {
    if (out.path.endsWith(".css")) css += out.text;
    else js += out.text;
  }

  // Pull collected CSS files explicitly imported as side-effects (esbuild output above)
  // Also include any standalone .css files that were imported via the loader.
  // Find an existing index.html to reuse the <head>, otherwise generate one.
  const sourceHtml = map.get("index.html") || map.get("public/index.html");
  let html: string;
  if (sourceHtml) {
    html = sourceHtml
      // Remove any <script src="/index.tsx"> or similar dev entry points
      .replace(/<script[^>]*src=["'][^"']*\.(t|j)sx?["'][^>]*><\/script>/gi, "")
      .replace(
        /<\/body>/i,
        `${css ? `<style>${css}</style>` : ""}<script type="module" src="/assets/bundle.js"></script></body>`,
      );
  } else {
    html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>App</title>${css ? `<style>${css}</style>` : ""}</head><body><div id="root"></div><script type="module" src="/assets/bundle.js"></script></body></html>`;
  }

  return {
    "index.html": html,
    "assets/bundle.js": js,
    _redirects: "/*  /index.html  200",
  };
}
