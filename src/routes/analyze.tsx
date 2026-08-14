import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { toast } from "sonner";
import { analyzeData, type AnalyzeResult, type ChartSpec } from "@/lib/analyze.functions";

export const Route = createFileRoute("/analyze")({
  head: () => ({
    meta: [
      { title: "Data Analysis & Visualization — AI Insights" },
      {
        name: "description",
        content:
          "Upload a CSV, JSON or text file, or describe your data. Get an AI-generated dashboard with KPIs, insights, charts, and recommendations.",
      },
      { property: "og:title", content: "AI Data Analysis & Visualization" },
      {
        property: "og:description",
        content: "Turn raw data or a prompt into a polished analytics report with charts.",
      },
    ],
  }),
  component: AnalyzePage,
});

const PALETTE = [
  "oklch(0.72 0.18 295)",
  "oklch(0.78 0.16 200)",
  "oklch(0.82 0.15 145)",
  "oklch(0.78 0.18 60)",
  "oklch(0.72 0.2 25)",
  "oklch(0.75 0.16 330)",
];

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadCSV(result: AnalyzeResult) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const parts: string[] = [];
  parts.push("# KPIs\nlabel,value,delta");
  for (const k of result.kpis ?? []) parts.push([esc(k.label), esc(k.value), esc(k.delta ?? "")].join(","));
  for (const c of result.charts ?? []) {
    parts.push(`\n# Chart: ${c.title}`);
    const headers = [c.xKey, ...c.yKeys];
    parts.push(headers.map(esc).join(","));
    for (const row of c.data) parts.push(headers.map((h) => esc(row[h])).join(","));
  }
  triggerDownload(`analysis-${stamp}.csv`, parts.join("\n"), "text/csv");
}

function downloadReport(result: AnalyzeResult, format: "md" | "json") {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  if (format === "json") {
    triggerDownload(`analysis-${stamp}.json`, JSON.stringify(result, null, 2), "application/json");
    return;
  }
  const lines: string[] = [];
  lines.push(`# Data Analysis Report`, "", `_Generated ${new Date().toLocaleString()}_`, "");
  lines.push(`## Executive Summary`, "", result.summary ?? "", "");
  if (result.kpis?.length) {
    lines.push(`## Key Metrics`, "");
    for (const k of result.kpis) lines.push(`- **${k.label}:** ${k.value}${k.delta ? ` (${k.delta})` : ""}`);
    lines.push("");
  }
  if (result.insights?.length) {
    lines.push(`## Insights`, "");
    for (const it of result.insights) lines.push(`### ${it.title}`, "", it.detail, "");
  }
  if (result.charts?.length) {
    lines.push(`## Visualizations`, "");
    for (const c of result.charts) {
      lines.push(`### ${c.title} (${c.type})`, "");
      if (c.description) lines.push(c.description, "");
      const headers = [c.xKey, ...c.yKeys];
      lines.push(`| ${headers.join(" | ")} |`);
      lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
      for (const row of c.data) {
        lines.push(`| ${headers.map((h) => String(row[h] ?? "")).join(" | ")} |`);
      }
      lines.push("");
    }
  }
  if (result.recommendations?.length) {
    lines.push(`## Recommendations`, "");
    for (const r of result.recommendations) lines.push(`- ${r}`);
    lines.push("");
  }
  triggerDownload(`analysis-${stamp}.md`, lines.join("\n"), "text/markdown");
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function downloadHTMLDashboard(result: AnalyzeResult) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const palette = ["#a78bfa", "#38bdf8", "#4ade80", "#fbbf24", "#f87171", "#f472b6"];

  const kpisHTML = (result.kpis ?? [])
    .map((k) => {
      const delta = k.delta?.trim();
      const isNeg = delta?.startsWith("-");
      return `
        <div class="kpi">
          <div class="kpi-label">${escapeHtml(k.label)}</div>
          <div class="kpi-value">${escapeHtml(String(k.value))}</div>
          ${delta ? `<div class="kpi-delta ${isNeg ? "neg" : "pos"}">${escapeHtml(delta)}</div>` : ""}
        </div>`;
    })
    .join("");

  const chartsHTML = (result.charts ?? [])
    .map(
      (c, i) => `
      <div class="card chart-card">
        <div class="chart-head">
          <div class="chart-title">${escapeHtml(c.title)}</div>
          ${c.description ? `<div class="chart-desc">${escapeHtml(c.description)}</div>` : ""}
        </div>
        <div class="chart-wrap"><canvas id="chart-${i}"></canvas></div>
      </div>`,
    )
    .join("");

  const insightsHTML = (result.insights ?? [])
    .map(
      (it) => `
      <div class="card insight">
        <div class="insight-title">${escapeHtml(it.title)}</div>
        <p class="insight-detail">${escapeHtml(it.detail)}</p>
      </div>`,
    )
    .join("");

  const recsHTML = (result.recommendations ?? [])
    .map((r) => `<li><span class="arrow">→</span>${escapeHtml(r)}</li>`)
    .join("");

  const chartsData = (result.charts ?? []).map((c) => ({
    type: c.type,
    xKey: c.xKey,
    yKeys: c.yKeys,
    data: c.data,
  }));

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Data Analysis Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
<style>
  :root {
    --bg: #0b0b12;
    --bg-2: #12121c;
    --card: rgba(255,255,255,0.04);
    --card-border: rgba(255,255,255,0.08);
    --text: #e7e7ef;
    --muted: #8b8ba0;
    --primary: #a78bfa;
    --primary-2: #38bdf8;
    --pos: #4ade80;
    --neg: #f87171;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  body { background:
    radial-gradient(1200px 600px at 10% -10%, rgba(167,139,250,0.18), transparent 60%),
    radial-gradient(900px 500px at 90% 0%, rgba(56,189,248,0.12), transparent 60%),
    var(--bg);
    min-height: 100vh;
  }
  .wrap { max-width: 1200px; margin: 0 auto; padding: 40px 24px 80px; }
  header.top { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 32px; }
  .brand { display:flex; align-items:center; gap: 10px; }
  .brand-badge { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, var(--primary), var(--primary-2)); display: grid; place-items: center; font-weight: 800; color: #0b0b12; }
  h1 { font-size: 30px; letter-spacing: -0.02em; margin: 0; font-weight: 800; }
  .subtitle { color: var(--muted); font-size: 13px; margin-top: 4px; }
  .stamp { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.15em; }

  section { margin-top: 36px; }
  h2 { font-size: 15px; font-weight: 700; margin: 0 0 14px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }

  .card { background: var(--card); border: 1px solid var(--card-border); border-radius: 18px; padding: 20px; backdrop-filter: blur(10px); }
  .summary { font-size: 15px; line-height: 1.65; color: #d3d3df; }

  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
  .kpi { background: linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)); border: 1px solid var(--card-border); border-radius: 18px; padding: 18px 20px; position: relative; overflow: hidden; }
  .kpi::before { content:""; position:absolute; inset:0; background: radial-gradient(400px 120px at 100% 0%, rgba(167,139,250,0.15), transparent 60%); pointer-events:none; }
  .kpi-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--muted); }
  .kpi-value { font-size: 30px; font-weight: 800; margin-top: 6px; letter-spacing: -0.02em; }
  .kpi-delta { font-size: 12px; font-weight: 600; margin-top: 4px; }
  .kpi-delta.pos { color: var(--pos); }
  .kpi-delta.neg { color: var(--neg); }

  .charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; }
  .chart-card { display: flex; flex-direction: column; }
  .chart-head { margin-bottom: 10px; }
  .chart-title { font-weight: 700; font-size: 14px; }
  .chart-desc { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .chart-wrap { position: relative; height: 280px; }

  .insights-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
  .insight-title { font-weight: 700; font-size: 14px; }
  .insight-detail { color: var(--muted); font-size: 13px; line-height: 1.55; margin: 8px 0 0; }

  .recs { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
  .recs li { display: flex; gap: 10px; font-size: 14px; color: #d3d3df; background: rgba(167,139,250,0.06); border: 1px solid rgba(167,139,250,0.2); padding: 12px 14px; border-radius: 14px; }
  .arrow { color: var(--primary); font-weight: 800; }

  footer { margin-top: 60px; text-align: center; font-size: 11px; color: var(--muted); }
  @media print { body { background: white; color: #111; } .kpi, .card { background: #fff; border-color: #ddd; } h1, .kpi-value { color: #111; } .kpi-label, .chart-desc, .insight-detail, .subtitle, .stamp, h2 { color: #555; } }
</style>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <div>
        <div class="brand">
          <div class="brand-badge">D</div>
          <div>
            <h1>Data Analysis Dashboard</h1>
            <div class="subtitle">AI-generated insights, KPIs & visualizations</div>
          </div>
        </div>
      </div>
      <div class="stamp">Generated ${escapeHtml(new Date().toLocaleString())}</div>
    </header>

    <section>
      <h2>Executive summary</h2>
      <div class="card summary">${escapeHtml(result.summary ?? "")}</div>
    </section>

    ${
      kpisHTML
        ? `<section><h2>Key metrics</h2><div class="kpi-grid">${kpisHTML}</div></section>`
        : ""
    }

    ${
      chartsHTML
        ? `<section><h2>Visualizations</h2><div class="charts-grid">${chartsHTML}</div></section>`
        : ""
    }

    ${
      insightsHTML
        ? `<section><h2>Insights</h2><div class="insights-grid">${insightsHTML}</div></section>`
        : ""
    }

    ${
      recsHTML
        ? `<section><h2>Recommended next steps</h2><div class="card"><ul class="recs">${recsHTML}</ul></div></section>`
        : ""
    }

    <footer>Built with AI — standalone HTML dashboard · Open in any browser</footer>
  </div>

<script>
  const PALETTE = ${JSON.stringify(palette)};
  const CHARTS = ${JSON.stringify(chartsData)};
  Chart.defaults.color = "#8b8ba0";
  Chart.defaults.font.family = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  Chart.defaults.borderColor = "rgba(255,255,255,0.08)";

  function hexToRgba(hex, a) {
    const h = hex.replace('#','');
    const r = parseInt(h.substring(0,2),16), g = parseInt(h.substring(2,4),16), b = parseInt(h.substring(4,6),16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  CHARTS.forEach((c, i) => {
    const ctx = document.getElementById("chart-" + i);
    if (!ctx) return;
    const labels = c.data.map(d => d[c.xKey]);
    const commonOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, font: { size: 11 } } },
        tooltip: { backgroundColor: 'rgba(15,15,25,0.95)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 10, titleFont: { size: 12 }, bodyFont: { size: 12 } }
      },
      scales: (c.type === 'pie' || c.type === 'doughnut') ? undefined : {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { font: { size: 11 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { font: { size: 11 } } }
      }
    };
    let cfg;
    if (c.type === 'pie' || c.type === 'doughnut') {
      const key = c.yKeys[0] || 'value';
      cfg = {
        type: 'doughnut',
        data: { labels, datasets: [{ data: c.data.map(d => d[key]), backgroundColor: labels.map((_, idx) => PALETTE[idx % PALETTE.length]), borderColor: '#0b0b12', borderWidth: 2 }] },
        options: { ...commonOpts, cutout: '55%' }
      };
    } else if (c.type === 'line') {
      cfg = {
        type: 'line',
        data: { labels, datasets: c.yKeys.map((k, idx) => ({
          label: k,
          data: c.data.map(d => d[k]),
          borderColor: PALETTE[idx % PALETTE.length],
          backgroundColor: hexToRgba(PALETTE[idx % PALETTE.length], 0.15),
          tension: 0.35, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, fill: false,
        })) },
        options: commonOpts
      };
    } else if (c.type === 'area') {
      cfg = {
        type: 'line',
        data: { labels, datasets: c.yKeys.map((k, idx) => ({
          label: k,
          data: c.data.map(d => d[k]),
          borderColor: PALETTE[idx % PALETTE.length],
          backgroundColor: hexToRgba(PALETTE[idx % PALETTE.length], 0.35),
          tension: 0.35, borderWidth: 2, pointRadius: 2, fill: true,
        })) },
        options: commonOpts
      };
    } else {
      cfg = {
        type: 'bar',
        data: { labels, datasets: c.yKeys.map((k, idx) => ({
          label: k,
          data: c.data.map(d => d[k]),
          backgroundColor: hexToRgba(PALETTE[idx % PALETTE.length], 0.85),
          borderRadius: 8, borderSkipped: false,
        })) },
        options: commonOpts
      };
    }
    new Chart(ctx, cfg);
  });
</script>
</body>
</html>`;

  triggerDownload(`dashboard-${stamp}.html`, html, "text/html");
}

function AnalyzePage() {
  const analyze = useServerFn(analyzeData);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileContent, setFileContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  const onFile = async (f: File | null) => {
    if (!f) {
      setFileName("");
      setFileContent("");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5MB).");
      return;
    }
    const text = await f.text();
    setFileName(f.name);
    setFileContent(text);
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const prompt = promptRef.current?.value?.trim() ?? "";
    if (!prompt && !fileContent) {
      toast.error("Add a prompt or upload a file.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const r = await analyze({ data: { prompt, fileName, fileContent } });
      setResult(r);
      toast.success("Analysis ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-sm font-semibold tracking-tight">
            ← AI Builder
          </Link>
          <div className="text-xs text-muted-foreground">Data Analysis</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <section className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Analyze & visualize anything
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
            Upload a CSV / JSON / text file, paste data, or just describe what you want visualized —
            e.g. <em>"quarterly SaaS revenue for a mid-market startup"</em>. You'll get KPIs,
            insights, charts, and a downloadable report.
          </p>
        </section>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-border/60 bg-card/40 p-5 shadow-lg backdrop-blur"
        >
          <textarea
            ref={promptRef}
            placeholder="e.g. Analyze sales trends and identify top products and risk segments…"
            rows={3}
            className="w-full resize-none rounded-xl border border-border/60 bg-background/60 px-4 py-3 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border/60 bg-background/40 px-4 py-3 text-sm transition hover:border-primary/60 hover:bg-background/60">
              <input
                type="file"
                accept=".csv,.json,.txt,.tsv,.md,text/*,application/json"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
              <span className="text-muted-foreground">
                {fileName ? `📄 ${fileName}` : "📎 Upload data file (CSV, JSON, TXT…)"}
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Analyzing…" : "Generate analysis ✨"}
            </button>
          </div>
        </form>

        {loading && (
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-2xl border border-border/40 bg-card/40"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        )}

        {result && (
          <div className="mt-10 space-y-10">
            <section className="rounded-2xl border border-border/60 bg-card/40 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">Executive summary</h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => downloadHTMLDashboard(result)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-primary/70 px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/30 transition hover:opacity-90"
                  >
                    ✨ HTML Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadReport(result, "md")}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground/90 transition hover:bg-background/70"
                  >
                    ⬇ Markdown
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadCSV(result)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground/90 transition hover:bg-background/70"
                  >
                    ⬇ CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadReport(result, "json")}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground/90 transition hover:bg-background/70"
                  >
                    ⬇ JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground/90 transition hover:bg-background/70"
                  >
                    🖨 Print / PDF
                  </button>
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{result.summary}</p>
            </section>

            {result.kpis?.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-semibold">Key metrics</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {result.kpis.map((k, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-border/60 bg-gradient-to-br from-card/60 to-card/20 p-5 shadow-md"
                    >
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">
                        {k.label}
                      </div>
                      <div className="mt-2 text-3xl font-bold tracking-tight">{k.value}</div>
                      {k.delta && (
                        <div
                          className={`mt-1 text-xs font-medium ${
                            k.delta.trim().startsWith("-") ? "text-red-400" : "text-emerald-400"
                          }`}
                        >
                          {k.delta}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {result.charts?.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-semibold">Visualizations</h2>
                <div className="grid gap-5 lg:grid-cols-2">
                  {result.charts.map((c, i) => (
                    <ChartCard key={i} spec={c} />
                  ))}
                </div>
              </section>
            )}

            {result.insights?.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-semibold">Insights</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {result.insights.map((it, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-border/60 bg-card/40 p-5 transition hover:border-primary/40"
                    >
                      <div className="text-sm font-semibold">{it.title}</div>
                      <p className="mt-1.5 text-sm text-muted-foreground">{it.detail}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {result.recommendations?.length > 0 && (
              <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
                <h2 className="text-lg font-semibold">Recommended next steps</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {result.recommendations.map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary">→</span>
                      <span className="text-muted-foreground">{r}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function ChartCard({ spec }: { spec: ChartSpec }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
      <div className="mb-3">
        <div className="text-sm font-semibold">{spec.title}</div>
        {spec.description && (
          <div className="text-xs text-muted-foreground">{spec.description}</div>
        )}
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(spec)}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function renderChart(spec: ChartSpec) {
  const tooltipStyle = {
    background: "oklch(0.18 0.02 280)",
    border: "1px solid oklch(0.3 0.02 280)",
    borderRadius: 8,
    fontSize: 12,
  };

  if (spec.type === "pie") {
    const key = spec.yKeys[0] ?? "value";
    return (
      <PieChart>
        <Pie
          data={spec.data}
          dataKey={key}
          nameKey={spec.xKey}
          outerRadius={90}
          innerRadius={45}
          paddingAngle={2}
        >
          {spec.data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    );
  }

  if (spec.type === "line") {
    return (
      <LineChart data={spec.data}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 280)" />
        <XAxis dataKey={spec.xKey} stroke="oklch(0.6 0.02 280)" fontSize={11} />
        <YAxis stroke="oklch(0.6 0.02 280)" fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {spec.yKeys.map((k, i) => (
          <Line
            key={k}
            type="monotone"
            dataKey={k}
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    );
  }

  if (spec.type === "area") {
    return (
      <AreaChart data={spec.data}>
        <defs>
          {spec.yKeys.map((k, i) => (
            <linearGradient key={k} id={`g-${k}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.6} />
              <stop offset="100%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 280)" />
        <XAxis dataKey={spec.xKey} stroke="oklch(0.6 0.02 280)" fontSize={11} />
        <YAxis stroke="oklch(0.6 0.02 280)" fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {spec.yKeys.map((k, i) => (
          <Area
            key={k}
            type="monotone"
            dataKey={k}
            stroke={PALETTE[i % PALETTE.length]}
            fill={`url(#g-${k}-${i})`}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    );
  }

  return (
    <BarChart data={spec.data}>
      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 280)" />
      <XAxis dataKey={spec.xKey} stroke="oklch(0.6 0.02 280)" fontSize={11} />
      <YAxis stroke="oklch(0.6 0.02 280)" fontSize={11} />
      <Tooltip contentStyle={tooltipStyle} />
      <Legend wrapperStyle={{ fontSize: 11 }} />
      {spec.yKeys.map((k, i) => (
        <Bar key={k} dataKey={k} fill={PALETTE[i % PALETTE.length]} radius={[6, 6, 0, 0]} />
      ))}
    </BarChart>
  );
}
