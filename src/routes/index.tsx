import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { TemplatePreviewModal } from "@/components/TemplatePreviewModal";
import { UserMenu } from "@/components/UserMenu";
import { AuthDialog } from "@/components/AuthDialog";
import { useAuth } from "@/hooks/useAuth";
import { MODE_LIST, MODES, parseSlashCommand, type ChatMode } from "@/lib/modes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI App Builder — Idea to app in seconds" },
      {
        name: "description",
        content:
          "Describe your idea and get a working React + Vite + TypeScript app with a live preview. Your personal full-stack engineer.",
      },
      { property: "og:title", content: "AI App Builder — Idea to app in seconds" },
      {
        property: "og:description",
        content: "Describe your idea, get a working React + Vite app with live preview.",
      },
    ],
  }),
  component: LandingPage,
});

const EXAMPLES = [
  { label: "Remotion video", icon: "video" },
  { label: "Bill splitter", icon: "calc" },
  { label: "Markdown editor", icon: "edit" },
  { label: "Expense tracker", icon: "wallet" },
] as const;

type Template = {
  id: string;
  name: string;
  category: string;
  description: string;
  preview: string;
  prompt: string;
};

const TEMPLATES: Template[] = [
  {
    id: "saas-landing",
    name: "SaaS Landing Page",
    category: "Marketing",
    description: "Modern hero, features grid, pricing tiers, testimonials and CTA.",
    preview: `<div style="font-family:Inter,system-ui;background:linear-gradient(180deg,#0b0f1a,#111827);color:#fff;padding:18px;height:100%">
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px"><b>◆ Acme</b><span style="opacity:.6">Login</span></div>
      <div style="margin-top:24px;text-align:center">
        <div style="font-size:20px;font-weight:700;letter-spacing:-.02em">Ship faster with Acme</div>
        <div style="font-size:9px;opacity:.6;margin-top:6px">All-in-one platform for modern teams</div>
        <div style="margin-top:10px;display:inline-block;background:#6366f1;padding:5px 12px;border-radius:999px;font-size:9px">Get started →</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:18px">
        ${[1, 2, 3].map(() => `<div style="background:#1f2937;border-radius:8px;padding:8px;font-size:8px"><div style="width:14px;height:14px;background:#6366f1;border-radius:4px;margin-bottom:4px"></div>Feature</div>`).join("")}
      </div>
    </div>`,
    prompt:
      "Build a polished modern SaaS landing page in React with: a sticky glassmorphism nav, a bold hero section with gradient headline and dual CTAs, a logo cloud, a 6-card feature grid with icons, a 3-column step-by-step 'How it works' section, social proof testimonials carousel, a 3-tier pricing table with a featured plan, an FAQ accordion, a final CTA banner, and a multi-column footer. Use semantic tokens, smooth scroll animations, and full responsive layout.",
  },
  {
    id: "portfolio",
    name: "Personal Portfolio",
    category: "Portfolio",
    description: "Bold typography, project gallery, about, skills, contact form.",
    preview: `<div style="font-family:Inter,system-ui;background:#fafaf9;color:#111;padding:18px;height:100%">
      <div style="display:flex;justify-content:space-between;font-size:10px"><b>Jane Doe</b><span>Work · About · Contact</span></div>
      <div style="margin-top:22px"><div style="font-size:24px;font-weight:800;letter-spacing:-.03em;line-height:1">Designer building<br/>thoughtful products.</div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:18px">
        <div style="background:#e7e5e4;height:50px;border-radius:8px"></div>
        <div style="background:#fef3c7;height:50px;border-radius:8px"></div>
        <div style="background:#dbeafe;height:50px;border-radius:8px"></div>
        <div style="background:#fce7f3;height:50px;border-radius:8px"></div>
      </div>
    </div>`,
    prompt:
      "Build a striking personal portfolio website in React with: a minimalist nav, a huge serif/display hero introducing the person with an animated marquee of skills, an about section with a portrait placeholder and bio, a curated project case-study grid (6 projects with hover reveal), a skills/tech stack section, a testimonials section, a contact form, and a footer with social links. Use elegant typography, generous whitespace, smooth scroll reveals, and full responsiveness.",
  },
  {
    id: "ecommerce",
    name: "E-commerce Storefront",
    category: "Shop",
    description: "Product grid, hero banner, categories, cart preview, footer.",
    preview: `<div style="font-family:Inter,system-ui;background:#fff;color:#111;padding:14px;height:100%">
      <div style="display:flex;justify-content:space-between;font-size:10px;border-bottom:1px solid #eee;padding-bottom:8px"><b>SHOP</b><span>🔍 ♡ 🛒</span></div>
      <div style="margin-top:10px;background:linear-gradient(135deg,#fde68a,#f59e0b);border-radius:12px;padding:14px;color:#111"><b style="font-size:13px">Summer Sale -40%</b></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px">
        ${[1, 2, 3, 4, 5, 6].map((i) => `<div><div style="background:#f3f4f6;height:36px;border-radius:6px"></div><div style="font-size:8px;margin-top:3px">Item ${i}</div><div style="font-size:8px;font-weight:700">$${i * 9}</div></div>`).join("")}
      </div>
    </div>`,
    prompt:
      "Build a beautiful e-commerce storefront in React with: a top promo bar, a header with logo, search, account and cart icons, a hero banner with a featured promotion, a horizontal category pill nav, a 'New arrivals' product grid (8 products with image, name, price, hover quick-add), a 'Shop by category' tile section, a curated collection feature row, customer reviews, a newsletter signup, and a rich footer. Use clean retail aesthetics, hover effects, and full responsive layout.",
  },
  {
    id: "dashboard",
    name: "Analytics Dashboard",
    category: "App",
    description: "Sidebar, KPI cards, charts, recent activity table.",
    preview: `<div style="font-family:Inter,system-ui;background:#0f172a;color:#fff;padding:0;height:100%;display:flex">
      <div style="width:48px;background:#020617;padding:8px;font-size:9px">▦<br/><br/>◉<br/><br/>♛</div>
      <div style="flex:1;padding:10px">
        <div style="font-size:11px;font-weight:700">Dashboard</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:8px">
          ${["12.4k", "$48k", "94%"].map((v) => `<div style="background:#1e293b;border-radius:6px;padding:6px;font-size:8px"><div style="opacity:.6">Metric</div><b style="font-size:11px">${v}</b></div>`).join("")}
        </div>
        <div style="background:#1e293b;border-radius:6px;height:50px;margin-top:6px;padding:6px;font-size:8px">📈 Chart</div>
      </div>
    </div>`,
    prompt:
      "Build a sophisticated analytics dashboard in React with: a collapsible sidebar nav with icons and labels, a top bar with search and user menu, a row of 4 KPI stat cards with sparklines and delta indicators, a large area chart for revenue over time, a bar chart for traffic sources, a donut chart for user breakdown, a recent transactions table with status badges and pagination, and a notifications panel. Use a polished dark theme, recharts for visualizations, and a responsive grid layout.",
  },
  {
    id: "blog",
    name: "Magazine Blog",
    category: "Content",
    description: "Featured story, article grid, categories, newsletter.",
    preview: `<div style="font-family:Georgia,serif;background:#fffbeb;color:#1c1917;padding:14px;height:100%">
      <div style="text-align:center;border-bottom:2px solid #1c1917;padding-bottom:6px;font-size:14px;font-weight:700;letter-spacing:.2em">THE DAILY</div>
      <div style="margin-top:10px"><div style="background:#e7e5e4;height:40px;border-radius:4px"></div><div style="font-size:11px;font-weight:700;margin-top:4px;line-height:1.2">The future of independent publishing</div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;font-size:9px">
        <div><div style="background:#d6d3d1;height:24px;border-radius:3px"></div><div style="margin-top:2px">Article one headline</div></div>
        <div><div style="background:#d6d3d1;height:24px;border-radius:3px"></div><div style="margin-top:2px">Article two headline</div></div>
      </div>
    </div>`,
    prompt:
      "Build an editorial magazine-style blog in React with: a centered masthead with serif typography, a horizontal category nav, a large featured story hero with image, category badge, headline, dek and byline, a 3-column 'Latest stories' grid (9 articles), a 'Most read' sidebar list, a topic-organized 'Sections' area, a newsletter signup band, and an elegant footer. Use serif headlines, sans-serif body, generous typography hierarchy, and responsive layout.",
  },
  {
    id: "restaurant",
    name: "Restaurant Site",
    category: "Hospitality",
    description: "Hero, menu sections, gallery, reservation, location.",
    preview: `<div style="font-family:Georgia,serif;background:#1c1917;color:#fef3c7;padding:14px;height:100%">
      <div style="text-align:center;font-size:9px;letter-spacing:.3em;opacity:.7">EST. 2014</div>
      <div style="text-align:center;font-size:22px;font-weight:700;margin-top:4px;font-style:italic">Maison</div>
      <div style="text-align:center;font-size:9px;opacity:.7;margin-top:4px">Seasonal · French · Tasting menu</div>
      <div style="margin-top:14px;border-top:1px solid #44403c;border-bottom:1px solid #44403c;padding:8px 0;font-size:9px;display:flex;justify-content:space-between"><span>Beef tartare</span><span>· · · ·</span><span>$24</span></div>
      <div style="font-size:9px;display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #44403c"><span>Duck confit</span><span>· · · ·</span><span>$32</span></div>
    </div>`,
    prompt:
      "Build an elegant restaurant website in React with: a full-bleed hero with restaurant name in display serif, tagline and CTA to reserve, an 'Our story' section with image, a beautifully typeset menu section (Starters / Mains / Desserts / Drinks) with dotted price leaders, a photo gallery grid, a chef profile, a reservation form, a location & hours panel with embedded-map placeholder, and a footer with social links. Use warm sophisticated colors, serif/sans pairing, and responsive layout.",
  },
  {
    id: "ai-startup",
    name: "AI Startup",
    category: "Marketing",
    description: "Aurora gradients, animated hero, model showcase, pricing.",
    preview: `<div style="font-family:Inter,system-ui;background:radial-gradient(circle at 20% 0%,#7c3aed33,transparent),radial-gradient(circle at 80% 30%,#06b6d433,transparent),#030712;color:#fff;padding:16px;height:100%">
      <div style="display:flex;justify-content:space-between;font-size:10px"><b>◇ Lumen AI</b><span style="background:#fff;color:#000;padding:3px 8px;border-radius:999px;font-size:8px">Try free</span></div>
      <div style="margin-top:24px;text-align:center">
        <div style="display:inline-block;font-size:8px;border:1px solid #ffffff33;padding:2px 8px;border-radius:999px;opacity:.8">✨ New · GPT-5 ready</div>
        <div style="font-size:22px;font-weight:800;letter-spacing:-.03em;margin-top:8px;background:linear-gradient(90deg,#fff,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Intelligence, on tap.</div>
      </div>
      <div style="margin-top:14px;background:#0b1020;border:1px solid #ffffff14;border-radius:10px;padding:8px;font-family:ui-monospace;font-size:8px;color:#a5b4fc">▸ generate("a poem about stars")</div>
    </div>`,
    prompt:
      "Build a cutting-edge AI startup landing page in React with: a glassmorphic nav with subtle aurora background, a centered hero with a gradient/animated headline, a chat or prompt-style interactive demo card, a logo cloud of customers, a 'Capabilities' bento grid (mixed sized cards) with icons, a model comparison table, a step 'How it works' section, real testimonials, a 3-tier pricing table, an FAQ accordion, and a footer. Use a deep dark theme with violet/cyan/emerald aurora gradients and smooth scroll animations.",
  },
  {
    id: "mobile-app",
    name: "Mobile App Landing",
    category: "Marketing",
    description: "App store hero, phone mockup, features, screenshots, reviews.",
    preview: `<div style="font-family:Inter,system-ui;background:linear-gradient(160deg,#fef3c7,#fde68a);color:#111;padding:16px;height:100%;position:relative;overflow:hidden">
      <div style="display:flex;justify-content:space-between;font-size:10px"><b>◐ Pocket</b><span style="background:#111;color:#fff;padding:3px 8px;border-radius:999px;font-size:8px">Download</span></div>
      <div style="margin-top:14px;font-size:18px;font-weight:800;letter-spacing:-.02em;line-height:1.1">Your day,<br/>finally focused.</div>
      <div style="font-size:8px;opacity:.7;margin-top:6px">A calmer way to plan, capture and ship.</div>
      <div style="position:absolute;right:14px;bottom:14px;width:60px;height:90px;background:#111;border-radius:14px;border:3px solid #111"><div style="background:#fff;height:100%;border-radius:10px;padding:6px;font-size:7px"><div style="background:#fde68a;height:8px;border-radius:3px;margin-bottom:3px"></div><div style="background:#e7e5e4;height:6px;border-radius:3px;margin-bottom:3px"></div><div style="background:#e7e5e4;height:6px;border-radius:3px"></div></div></div>
    </div>`,
    prompt:
      "Build a beautiful mobile-app landing page in React with: a top nav, a split hero featuring a phone mockup (CSS-only) and bold headline with App Store / Google Play badges, a feature highlights section with phone screenshots, an animated 'How it works' walkthrough, user testimonials with avatars and star ratings, a 'Press & awards' logo bar, a comparison table vs competitors, an FAQ section, a final 'Download now' CTA banner, and a footer. Use vibrant friendly colors and smooth scroll-triggered animations.",
  },
  {
    id: "agency",
    name: "Creative Agency",
    category: "Portfolio",
    description: "Bold marquee, case studies, services, awards, contact.",
    preview: `<div style="font-family:Inter,system-ui;background:#0a0a0a;color:#fff;padding:14px;height:100%;overflow:hidden">
      <div style="display:flex;justify-content:space-between;font-size:10px"><b>STUDIO ▲</b><span style="opacity:.6">Work · About · Contact</span></div>
      <div style="margin-top:14px;font-size:26px;font-weight:900;letter-spacing:-.04em;line-height:.95">We craft<br/><i style="color:#84cc16">memorable</i><br/>brands.</div>
      <div style="margin-top:10px;display:flex;gap:6px;font-size:8px;opacity:.6;white-space:nowrap;overflow:hidden">— Branding — Web — Motion — Strategy — Branding — Web —</div>
    </div>`,
    prompt:
      "Build a bold creative agency website in React with: a minimal nav, an oversized typographic hero with a kinetic marquee of services, a featured case study with image and metrics, a project case-study grid (6 projects with hover image reveal), a services list, an 'Our process' timeline, awards / press logos, a team grid, a giant call-to-action footer with email link. Use a dark theme with one bright accent color and smooth animations.",
  },
  {
    id: "fintech",
    name: "Fintech App",
    category: "Marketing",
    description: "Card mockups, security badges, charts, app store CTAs.",
    preview: `<div style="font-family:Inter,system-ui;background:linear-gradient(180deg,#ecfeff,#fff);color:#0f172a;padding:16px;height:100%;position:relative">
      <div style="display:flex;justify-content:space-between;font-size:10px"><b>◈ Northbank</b><span style="background:#0f172a;color:#fff;padding:3px 8px;border-radius:999px;font-size:8px">Open account</span></div>
      <div style="margin-top:18px;font-size:18px;font-weight:800;letter-spacing:-.02em">Banking that<br/>actually pays you.</div>
      <div style="position:relative;height:60px;margin-top:10px">
        <div style="position:absolute;left:0;top:6px;width:100px;height:54px;background:linear-gradient(135deg,#0f172a,#334155);border-radius:8px;color:#fff;padding:6px;font-size:7px"><div style="opacity:.7">VISA</div><div style="margin-top:14px">•••• 4242</div></div>
        <div style="position:absolute;left:30px;top:0;width:100px;height:54px;background:linear-gradient(135deg,#06b6d4,#0ea5e9);border-radius:8px;color:#fff;padding:6px;font-size:7px"><div style="opacity:.9">Northbank</div><div style="margin-top:14px">•••• 1109</div></div>
      </div>
    </div>`,
    prompt:
      "Build a polished fintech / neobank landing page in React with: a clean glass nav, a split hero with a stacked credit card 3D mockup and bold headline, trust badges (FDIC / SOC2 / PCI), a feature grid (cards, savings, investing, crypto), an interactive analytics chart preview, a security & compliance section, a comparison vs traditional banks, customer testimonials, App Store / Play CTAs, an FAQ, and a comprehensive footer. Use a calm light theme with cyan/navy accents.",
  },
  {
    id: "course",
    name: "Online Course",
    category: "Education",
    description: "Curriculum, instructor, testimonials, pricing & FAQ.",
    preview: `<div style="font-family:Inter,system-ui;background:#fef3c7;color:#1c1917;padding:14px;height:100%">
      <div style="display:flex;justify-content:space-between;font-size:10px"><b>📚 LearnLab</b><span style="background:#1c1917;color:#fff;padding:3px 8px;border-radius:999px;font-size:8px">Enroll</span></div>
      <div style="margin-top:14px;font-size:18px;font-weight:800;letter-spacing:-.02em;line-height:1.1">Master Design<br/>in 30 days.</div>
      <div style="margin-top:8px;display:flex;gap:6px;font-size:8px"><span style="background:#1c1917;color:#fef3c7;padding:2px 6px;border-radius:4px">12 modules</span><span style="background:#1c1917;color:#fef3c7;padding:2px 6px;border-radius:4px">48 lessons</span></div>
      <div style="margin-top:10px;background:#fff;border-radius:8px;padding:8px;font-size:8px"><div style="font-weight:700">Module 1 · Foundations</div><div style="opacity:.6;margin-top:2px">3 lessons · 42 min</div></div>
    </div>`,
    prompt:
      "Build an inviting online-course landing page in React with: a header with logo and Enroll CTA, a hero with course title, subtitle, instructor avatar, rating and 'Enroll' / 'Watch trailer' buttons, key outcomes 'You will learn' grid, a detailed curriculum accordion (modules → lessons), an instructor bio section with credentials, student testimonials with photos, a pricing card with one-time and subscription options, an FAQ accordion, a money-back guarantee badge, and a final CTA. Use warm friendly colors and clear hierarchy.",
  },
  {
    id: "saas-pricing",
    name: "Pricing Page",
    category: "Marketing",
    description: "Toggle billing, 4 tiers, comparison table, enterprise.",
    preview: `<div style="font-family:Inter,system-ui;background:#fff;color:#111;padding:14px;height:100%">
      <div style="text-align:center;font-size:14px;font-weight:700;letter-spacing:-.02em">Simple pricing</div>
      <div style="text-align:center;font-size:8px;opacity:.6;margin-top:2px">Monthly · Yearly</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:10px">
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:6px;font-size:8px"><div>Free</div><b style="font-size:11px">$0</b></div>
        <div style="border:2px solid #6366f1;border-radius:8px;padding:6px;font-size:8px;background:#eef2ff"><div>Pro</div><b style="font-size:11px">$19</b></div>
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:6px;font-size:8px"><div>Team</div><b style="font-size:11px">$49</b></div>
      </div>
    </div>`,
    prompt:
      "Build a polished pricing page in React with: a header, a centered intro headline and subtitle, a Monthly/Yearly billing toggle (with discount badge), four pricing tier cards (Free / Pro / Team / Enterprise) with feature lists and a featured-plan highlight, a detailed feature comparison table grouped by category with check / dash icons, customer logos, an 'Enterprise / contact sales' band, a 'Frequently asked questions' accordion, and a footer. Use clean modern aesthetics and full responsive layout.",
  },
  {
    id: "real-estate",
    name: "Real Estate",
    category: "Listings",
    description: "Property search, listing cards, agent, neighborhoods.",
    preview: `<div style="font-family:Inter,system-ui;background:#f5f5f4;color:#1c1917;padding:14px;height:100%">
      <div style="display:flex;justify-content:space-between;font-size:10px"><b>⌂ Haven</b><span style="opacity:.6">Buy · Rent · Sell</span></div>
      <div style="margin-top:10px;background:#fff;border-radius:8px;padding:6px;display:flex;gap:4px;font-size:8px;border:1px solid #e7e5e4"><span style="background:#f5f5f4;padding:3px 6px;border-radius:4px;flex:1">📍 City</span><span style="background:#f5f5f4;padding:3px 6px;border-radius:4px">$ Price</span><span style="background:#1c1917;color:#fff;padding:3px 8px;border-radius:4px">Search</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">
        <div style="background:#fff;border-radius:8px;overflow:hidden;font-size:8px"><div style="background:#d6d3d1;height:32px"></div><div style="padding:4px"><b>$1.2M</b><div style="opacity:.6">3bd · Brooklyn</div></div></div>
        <div style="background:#fff;border-radius:8px;overflow:hidden;font-size:8px"><div style="background:#e7e5e4;height:32px"></div><div style="padding:4px"><b>$890K</b><div style="opacity:.6">2bd · Queens</div></div></div>
      </div>
    </div>`,
    prompt:
      "Build a refined real-estate website in React with: a header nav (Buy / Rent / Sell), a hero with city image and a sticky search bar (location, price range, beds, type), a 'Featured listings' grid (8 property cards with image, price, beds/baths, sqft, location, save heart), a 'Browse neighborhoods' tile section, a featured agent profile with stats, recent client testimonials, a mortgage calculator widget, a 'How it works' section, and a footer. Use clean editorial layout, generous whitespace, and full responsiveness.",
  },
  {
    id: "newsletter",
    name: "Newsletter Landing",
    category: "Content",
    description: "Subscribe hero, sample issues, author, social proof.",
    preview: `<div style="font-family:Inter,system-ui;background:#0c0a09;color:#fafaf9;padding:18px;height:100%">
      <div style="text-align:center"><div style="font-size:10px;opacity:.6;letter-spacing:.2em">THE BRIEFING</div><div style="font-size:20px;font-weight:800;margin-top:6px;letter-spacing:-.02em">Smart takes,<br/>every Sunday.</div></div>
      <div style="margin-top:14px;background:#1c1917;border-radius:999px;padding:4px;display:flex;font-size:8px"><input style="flex:1;background:transparent;color:inherit;border:0;padding:0 8px" placeholder="you@email.com"/><span style="background:#fafaf9;color:#0c0a09;padding:5px 10px;border-radius:999px;font-weight:600">Subscribe</span></div>
      <div style="text-align:center;font-size:8px;opacity:.5;margin-top:6px">Join 24,500+ readers</div>
    </div>`,
    prompt:
      "Build a stylish newsletter landing page in React with: a minimal nav, a centered hero with newsletter name, tagline, an inline email subscribe form, a subscriber count, a 'What you'll get' 3-column feature row, a 'Recent issues' card list with titles, dates and excerpts, an author bio section with photo and credentials, social proof testimonials, an FAQ, and a footer. Use a moody dark or warm cream theme with elegant editorial typography.",
  },
  {
    id: "event",
    name: "Event / Conference",
    category: "Marketing",
    description: "Countdown, speakers, schedule, tickets, sponsors.",
    preview: `<div style="font-family:Inter,system-ui;background:linear-gradient(135deg,#1e1b4b,#7c3aed);color:#fff;padding:14px;height:100%">
      <div style="display:flex;justify-content:space-between;font-size:9px;opacity:.8"><b>DESIGN/CONF '26</b><span>Tickets →</span></div>
      <div style="margin-top:10px;font-size:18px;font-weight:800;letter-spacing:-.02em;line-height:1">Where designers<br/>meet the future.</div>
      <div style="margin-top:8px;font-size:9px;opacity:.8">Berlin · Sept 12–14, 2026</div>
      <div style="margin-top:10px;display:grid;grid-template-columns:repeat(4,1fr);gap:4px;text-align:center;font-size:8px">
        ${["48", "12", "30", "09"].map((v) => `<div style="background:#ffffff14;border-radius:6px;padding:5px"><b style="font-size:12px">${v}</b><div style="opacity:.7">d</div></div>`).join("")}
      </div>
    </div>`,
    prompt:
      "Build a vibrant event / conference landing page in React with: a sticky nav with Buy Tickets CTA, a hero with event name, dates, location, and a live countdown timer, a speakers grid with avatars and roles, a multi-day schedule tabbed by day, a venue section with map placeholder, a tiered ticket pricing section, sponsor logo tiers (Platinum / Gold / Silver), past attendee testimonials, an FAQ, and a footer. Use a bold gradient theme and dynamic layouts.",
  },
  {
    id: "docs",
    name: "Documentation Site",
    category: "App",
    description: "Sidebar nav, search, article, code blocks, on-this-page.",
    preview: `<div style="font-family:Inter,system-ui;background:#fff;color:#111;height:100%;display:flex;font-size:9px">
      <div style="width:60px;border-right:1px solid #e5e7eb;padding:8px;background:#fafafa"><b style="font-size:8px">Docs</b><div style="margin-top:6px;opacity:.6">Intro<br/><br/>Setup<br/><br/>API<br/><br/>Guides</div></div>
      <div style="flex:1;padding:10px"><div style="background:#f3f4f6;border-radius:4px;padding:3px 6px;font-size:7px;opacity:.6">⌕ Search docs…</div><div style="font-size:13px;font-weight:700;margin-top:8px">Quick start</div><div style="opacity:.7;margin-top:4px">Get up and running in under five minutes.</div><div style="background:#0f172a;color:#a5b4fc;border-radius:6px;padding:6px;margin-top:6px;font-family:ui-monospace;font-size:7px">$ npm install lumen</div></div>
    </div>`,
    prompt:
      "Build a clean technical documentation site in React with: a top bar with logo, version selector, global search and theme toggle, a left sidebar with collapsible navigation tree, a main article area with rich typography (h1-h4, code blocks with syntax-highlighted theme, callouts, tables, images), a right 'On this page' table of contents that highlights the active section on scroll, prev/next page footer links, and an edit-on-github link. Use a calm light/dark theme with monospace code and excellent readability.",
  },
];

function LandingPage() {
  const navigate = useNavigate({ from: "/" });
  const { user, loading: authLoading } = useAuth();
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const submittingRef = useRef(false);
  const [prompt, setPrompt] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importHtml, setImportHtml] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [savedProjects, setSavedProjects] = useState<
    Array<{ id: string; name: string; savedAt: number }>
  >([]);
  const [mode, setMode] = useState<ChatMode>("website");
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!savedOpen) return;
    try {
      const raw = localStorage.getItem("nuvic.savedProjects");
      const list = raw ? JSON.parse(raw) : [];
      setSavedProjects(
        list.map((p: { id: string; name: string; savedAt: number }) => ({
          id: p.id,
          name: p.name,
          savedAt: p.savedAt,
        })),
      );
    } catch {
      setSavedProjects([]);
    }
  }, [savedOpen]);

  const openSavedProject = (id: string) => {
    setSavedOpen(false);
    void navigate({ to: "/builder", search: { saved: id } }).catch(() => {
      window.location.assign(`/builder?saved=${encodeURIComponent(id)}`);
    });
  };

  const deleteSavedProject = (id: string) => {
    try {
      const raw = localStorage.getItem("nuvic.savedProjects");
      const list = raw ? JSON.parse(raw) : [];
      const next = list.filter((p: { id: string }) => p.id !== id);
      localStorage.setItem("nuvic.savedProjects", JSON.stringify(next));
      setSavedProjects(
        next.map((p: { id: string; name: string; savedAt: number }) => ({
          id: p.id,
          name: p.name,
          savedAt: p.savedAt,
        })),
      );
    } catch {
      /* noop */
    }
  };

  const pickTemplate = (tpl: Template) => {
    setTemplatesOpen(false);
    go(tpl.prompt);
  };

  const go = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || submittingRef.current) return;
    if (authLoading) return;
    if (!user) {
      toast.error("Please sign in to continue");
      setAuthOpen(true);
      return;
    }
    // If the user already typed a /command, respect it; otherwise prepend the selected mode.
    const { mode: parsedMode } = parseSlashCommand(trimmed);
    const finalPrompt = parsedMode ? trimmed : `${MODES[mode].command} ${trimmed}`;
    submittingRef.current = true;
    setSubmitting(true);
    void navigate({ to: "/builder", search: { prompt: finalPrompt } }).catch(() => {
      submittingRef.current = false;
      setSubmitting(false);
      window.location.assign(`/builder?prompt=${encodeURIComponent(finalPrompt)}`);
    });
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const livePrompt = promptRef.current?.value ?? prompt;
    go(livePrompt);
  };

  const submitExample = (text: string) => {
    setPrompt(text);
    go(text);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const submitImport = async () => {
    setImportError(null);
    let html = importHtml.trim();
    const url = importUrl.trim();
    if (!html && !url) {
      setImportError("Paste a URL or HTML to continue.");
      return;
    }
    if (!html && url) {
      setImporting(true);
      try {
        const proxied = `https://r.jina.ai/${url.replace(/^https?:\/\//, "https://")}`;
        const res = await fetch(proxied);
        if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
        html = await res.text();
      } catch (err) {
        setImporting(false);
        setImportError(err instanceof Error ? err.message : "Failed to fetch URL.");
        return;
      }
      setImporting(false);
    }
    const truncated = html.slice(0, 18000);
    const userInstruction =
      prompt.trim() ||
      "Recreate this website faithfully in React, then improve its design and structure while preserving content and brand.";
    const finalPrompt = `${userInstruction}\n\n--- EXISTING SITE${url ? ` (${url})` : ""} ---\n${truncated}\n--- END ---`;
    setImportOpen(false);
    go(finalPrompt);
  };

  return (
    <main className="dark min-h-screen bg-background text-foreground">
      {/* Top nav pill */}
      <header className="relative px-3 pt-4 sm:px-4 sm:pt-6">
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-2 rounded-full border border-border bg-card/60 px-3 py-2 backdrop-blur sm:px-6 sm:py-3">
          <Link to="/" className="text-base font-semibold tracking-tight sm:text-lg">
            nuvic
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              to="/gallery"
              className="hidden rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-card hover:text-foreground sm:inline-flex"
            >
              Gallery
            </Link>
            <Link
              to="/projects"
              className="hidden rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-card hover:text-foreground sm:inline-flex"
            >
              My projects
            </Link>
            <IconButton aria-label="Saved projects" onClick={() => setSavedOpen(true)}>
              <FolderIcon />
            </IconButton>
            <IconButton aria-label="Language">
              <GlobeIcon />
            </IconButton>
            <UserMenu size="sm" align="right" />
            <IconButton
              className="sm:hidden"
              aria-label="Menu"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((v) => !v)}
            >
              <MenuIcon />
            </IconButton>
          </div>
        </nav>

        {/* Mobile nav menu */}
        {mobileNavOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden="true"
            />
            <nav className="absolute left-3 right-3 top-full z-50 mt-2 rounded-2xl border border-border bg-card/95 p-2 shadow-2xl backdrop-blur-md sm:hidden">
              <Link
                to="/gallery"
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <GlobeIcon />
                Gallery
              </Link>
              <Link
                to="/projects"
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <FolderIcon />
                My projects
              </Link>
              <Link
                to="/analyze"
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M3 3v18h18" strokeLinecap="round" />
                  <path d="M7 14l4-4 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Analyze data
              </Link>
            </nav>
          </>
        )}
      </header>

      {/* Hero */}
      <section className="px-4 pt-10 pb-10 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-5xl font-semibold tracking-tight sm:text-7xl md:text-8xl">nuvic</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:mt-6 sm:text-lg">
            Idea to app in seconds, with your personal full stack engineer
          </p>
        </div>

        {/* Prompt card */}
        <form
          action="/builder"
          method="get"
          onSubmit={submit}
          className="mx-auto mt-6 w-full max-w-3xl rounded-2xl border border-border bg-card/60 p-2 shadow-2xl backdrop-blur sm:mt-10 sm:rounded-3xl"
        >
          <textarea
            ref={promptRef}
            name="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onKey}
            rows={3}
            placeholder={`${MODES[mode].command} — ${MODES[mode].description}`}
            className="w-full resize-none bg-transparent px-3 pt-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none sm:px-5 sm:pt-4 sm:text-base"
          />
          <div className="flex items-center justify-between gap-2 px-2 pb-1 sm:px-3 sm:pb-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <CircleButton aria-label="Attach">
                <PaperclipIcon />
              </CircleButton>
              {/* Mode / slash-command chooser */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setModeMenuOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1.5 text-xs font-medium text-foreground/90 transition-colors hover:bg-muted"
                  aria-label="Choose command"
                >
                  {(() => {
                    const Icon = MODES[mode].icon;
                    return <Icon className="h-3.5 w-3.5" />;
                  })()}
                  <span className="hidden sm:inline">{MODES[mode].command}</span>
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {modeMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setModeMenuOpen(false)} />
                    <div className="absolute bottom-full left-0 z-50 mb-2 w-72 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-2xl">
                      <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        Choose a command
                      </div>
                      {MODE_LIST.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setMode(m.id);
                            setModeMenuOpen(false);
                            promptRef.current?.focus();
                          }}
                          className={
                            "flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left text-xs transition-colors hover:bg-muted " +
                            (m.id === mode ? "bg-muted/60" : "")
                          }
                        >
                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-foreground/80">
                            <m.icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground">{m.label}</span>
                              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                {m.command}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                              {m.description}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <CircleButton aria-label="Templates" onClick={() => setTemplatesOpen(true)}>
                <TemplatesIcon />
              </CircleButton>
            </div>
            <button
              type="submit"
              aria-label="Send"
              aria-disabled={!prompt.trim() || submitting}
              disabled={submitting}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background shadow-md transition-all hover:scale-105 active:scale-95 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60 disabled:hover:scale-100 sm:h-10 sm:w-10"
            >
              {submitting ? <SpinnerIcon /> : <ArrowUpIcon />}
            </button>
          </div>
        </form>

        {/* Example chips */}
        <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-2 sm:mt-8 sm:gap-3">
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-foreground/30 bg-foreground/5 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-foreground/10 sm:px-5 sm:py-2.5 sm:text-sm"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M12 20h9" strokeLinecap="round" />
              <path
                d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z"
                strokeLinejoin="round"
              />
            </svg>
            Edit existing site
          </button>
          <Link
            to="/analyze"
            className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-primary/20 sm:px-5 sm:py-2.5 sm:text-sm"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M3 3v18h18" strokeLinecap="round" />
              <path d="M7 14l4-4 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Analyze data
          </Link>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => submitExample(ex.label)}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-3 py-2 text-xs text-foreground transition-colors hover:bg-card sm:px-5 sm:py-2.5 sm:text-sm"
            >
              <ExampleIcon name={ex.icon} />
              {ex.label}
            </button>
          ))}
        </div>

        {importOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur"
            onClick={() => setImportOpen(false)}
          >
            <div
              className="w-full max-w-xl rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Edit an existing website</h2>
                <button
                  onClick={() => setImportOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Paste a URL or the page HTML. We'll recreate it in React, then apply your changes.
              </p>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                URL
              </label>
              <input
                type="url"
                placeholder="https://example.com"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
              />
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Or paste HTML
              </label>
              <textarea
                rows={5}
                placeholder="<html>..."
                value={importHtml}
                onChange={(e) => setImportHtml(e.target.value)}
                className="mb-3 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs focus:border-foreground/40 focus:outline-none"
              />
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                What should we change? (optional)
              </label>
              <textarea
                rows={2}
                placeholder="Modernize the design, add a pricing section, improve mobile…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="mb-4 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
              />
              {importError && <p className="mb-3 text-xs text-red-400">{importError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setImportOpen(false)}
                  className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={submitImport}
                  disabled={importing}
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60"
                >
                  {importing ? <SpinnerIcon /> : null}
                  {importing ? "Fetching…" : "Import & build"}
                </button>
              </div>
            </div>
          </div>
        )}

        {templatesOpen && (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur"
            onClick={() => setTemplatesOpen(false)}
          >
            <div
              className="my-8 w-full max-w-5xl rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold sm:text-xl">Start from a template</h2>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                    Pick a starting point. We'll generate a complete React frontend with full
                    sections, components and responsive design.
                  </p>
                </div>
                <button
                  onClick={() => setTemplatesOpen(false)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {TEMPLATES.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-background text-left transition-all hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-xl"
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewTemplate(tpl)}
                      className="relative aspect-[4/3] w-full overflow-hidden border-b border-border bg-muted"
                      aria-label={`Preview ${tpl.name}`}
                    >
                      <iframe
                        title={tpl.name}
                        srcDoc={`<!doctype html><html><body style="margin:0;overflow:hidden">${tpl.preview}</body></html>`}
                        sandbox=""
                        className="pointer-events-none absolute inset-0 h-full w-full transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-black">
                          👁 Preview
                        </span>
                      </div>
                    </button>
                    <div className="flex flex-1 flex-col p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{tpl.name}</span>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {tpl.category}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {tpl.description}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => setPreviewTemplate(tpl)}
                          className="flex-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => pickTemplate(tpl)}
                          className="flex-1 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:scale-[1.02]"
                        >
                          Use →
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {savedOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur"
            onClick={() => setSavedOpen(false)}
          >
            <div
              className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Saved projects</h2>
                <button
                  onClick={() => setSavedOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              {savedProjects.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No saved projects yet. Build something, then tap <b>Save</b> in the builder.
                </p>
              ) : (
                <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
                  {savedProjects.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <button
                        onClick={() => openSavedProject(p.id)}
                        className="flex-1 truncate text-left"
                      >
                        <div className="truncate text-sm font-medium">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(p.savedAt).toLocaleString()}
                        </div>
                      </button>
                      <button
                        onClick={() => deleteSavedProject(p.id)}
                        className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Delete"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <path
                            d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <TemplatePreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onUse={(tpl) => {
            setPreviewTemplate(null);
            pickTemplate(tpl);
          }}
        />

        {/* Scroll cue */}
        <div className="mt-10 flex flex-col items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:mt-16 sm:text-[11px]">
          Scroll to explore
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </section>
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </main>
  );
}

function NavItem({ label }: { label: string }) {
  return (
    <button className="inline-flex items-center gap-1 hover:text-foreground">
      {label}
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function IconButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-card hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function CircleButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

function GlobeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0116 0" strokeLinecap="round" />
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}
function PaperclipIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M21 12.5l-8.5 8.5a5 5 0 01-7-7l9-9a3.5 3.5 0 015 5l-9 9a2 2 0 01-3-3l8-8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ChipIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" strokeLinecap="round" />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" strokeLinejoin="round" />
    </svg>
  );
}
function ArrowUpIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SpinnerIcon() {
  return (
    <svg
      className="animate-spin"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M12 3a9 9 0 019 9" strokeLinecap="round" />
    </svg>
  );
}
function ExampleIcon({ name }: { name: string }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
  } as const;
  if (name === "video")
    return (
      <svg {...common}>
        <rect x="3" y="6" width="13" height="12" rx="2" />
        <path d="M16 10l5-3v10l-5-3z" />
      </svg>
    );
  if (name === "calc")
    return (
      <svg {...common}>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path
          d="M8 7h8M8 11h2M12 11h2M16 11h.01M8 15h2M12 15h2M16 15h.01M8 19h2M12 19h2M16 19h.01"
          strokeLinecap="round"
        />
      </svg>
    );
  if (name === "edit")
    return (
      <svg {...common}>
        <path d="M12 20h9" strokeLinecap="round" />
        <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M16 15h2" strokeLinecap="round" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function TemplatesIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}
