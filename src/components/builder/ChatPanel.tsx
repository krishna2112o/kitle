import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowUp,
  ChevronDown,
  Gift,
  Home,
  KeyRound,
  Slash,
  Sparkles,
  Star,
  User,
  Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { UserMenu } from "@/components/UserMenu";
import { MODES, MODE_LIST, parseSlashCommand, type ChatMode } from "@/lib/modes";
import {
  PROVIDERS,
  PROVIDER_LIST,
  loadByok,
  saveByok,
  type ProviderId,
  type ByokSettings,
} from "@/lib/providers";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  mode?: ChatMode;
  outputs?: "files" | "text";
};

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (text: string, mode: ChatMode) => void;
  onModeChange?: (mode: ChatMode) => void;
}

export function ChatPanel({ messages, isLoading, onSend, onModeChange }: Props) {
  const [input, setInput] = useState("");
  const [mode, _setMode] = useState<ChatMode>("website");
  const setMode = (m: ChatMode) => {
    _setMode(m);
    onModeChange?.(m);
  };
  const [accountOpen, setAccountOpen] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIdx, setSlashIdx] = useState(0);
  const [keyOpen, setKeyOpen] = useState(false);
  const [byok, setByok] = useState<ByokSettings>({ provider: "gemini", keys: {}, models: {} });
  const [draftProvider, setDraftProvider] = useState<ProviderId>("gemini");
  const [draftKey, setDraftKey] = useState("");
  const [draftModel, setDraftModel] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // hydrate stored BYOK settings
  useEffect(() => {
    const s = loadByok();
    setByok(s);
  }, []);

  // when opening the dialog or switching provider inside it, sync drafts to stored values
  useEffect(() => {
    if (!keyOpen) return;
    setDraftKey(byok.keys[draftProvider] || "");
    setDraftModel(byok.models[draftProvider] || PROVIDERS[draftProvider].defaultModel);
  }, [keyOpen, draftProvider, byok]);

  // when opening, default the dialog to the currently active provider
  useEffect(() => {
    if (keyOpen) setDraftProvider(byok.provider);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyOpen]);

  const activeKey = byok.keys[byok.provider];
  const activeProviderDef = PROVIDERS[byok.provider];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  const slashQuery = useMemo(() => {
    const m = input.match(/^\s*\/([a-z-]*)$/i);
    return m ? m[1].toLowerCase() : null;
  }, [input]);

  const filteredModes = useMemo(() => {
    if (slashQuery === null) return MODE_LIST;
    return MODE_LIST.filter(
      (m) =>
        m.command.slice(1).startsWith(slashQuery) || m.label.toLowerCase().includes(slashQuery),
    );
  }, [slashQuery]);

  useEffect(() => {
    setSlashOpen(slashQuery !== null && filteredModes.length > 0);
    setSlashIdx(0);
  }, [slashQuery, filteredModes.length]);

  const pickMode = (id: ChatMode) => {
    setMode(id);
    setInput("");
    setSlashOpen(false);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const raw = input.trim();
    if (!raw || isLoading) return;
    // allow slash-command in the text to override mode
    const parsed = parseSlashCommand(raw);
    let finalMode = mode;
    let finalText = raw;
    if (parsed.mode) {
      finalMode = parsed.mode;
      finalText = parsed.rest.trim() || raw;
      setMode(parsed.mode);
    }
    if (!finalText) return;
    onSend(finalText, finalMode);
    setInput("");
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIdx((i) => (i + 1) % filteredModes.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIdx((i) => (i - 1 + filteredModes.length) % filteredModes.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        pickMode(filteredModes[slashIdx].id);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashOpen(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const saveKey = () => {
    const next: ByokSettings = {
      provider: draftProvider,
      keys: { ...byok.keys, [draftProvider]: draftKey.trim() },
      models: {
        ...byok.models,
        [draftProvider]: draftModel.trim() || PROVIDERS[draftProvider].defaultModel,
      },
    };
    saveByok(next);
    setByok(next);
    setKeyOpen(false);
  };
  const clearKey = () => {
    const nextKeys = { ...byok.keys };
    delete nextKeys[draftProvider];
    const next: ByokSettings = { ...byok, keys: nextKeys };
    saveByok(next);
    setByok(next);
    setDraftKey("");
  };

  const activeMode = MODES[mode];

  return (
    <div
      className="relative flex h-full flex-col border-r border-border/60"
      style={{ background: "var(--builder-surface)" }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{ background: "var(--gradient-glow)" }}
      />

      {/* Header */}
      <div className="relative flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2.5">
        <UserMenu size="sm" align="left" />
        <div className="relative">
          <button
            onClick={() => setAccountOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-1.5 py-1 pr-2 text-foreground transition-colors hover:bg-background/70"
            aria-label="Account menu"
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold text-white"
              style={{ background: "var(--gradient-builder)" }}
            >
              N
            </span>
            <span className="max-w-[110px] truncate text-[12px] font-medium sm:max-w-none">
              Workspace
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>

          {accountOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
              <div className="absolute left-0 top-11 z-50 w-72 overflow-hidden rounded-2xl border border-border/60 bg-background/95 p-2 shadow-2xl backdrop-blur-md">
                <Link
                  to="/"
                  onClick={() => setAccountOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <Home className="h-3.5 w-3.5" /> Go to Home
                </Link>
                <div className="mt-1 flex items-center gap-2 px-2.5 py-2">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[12px] font-bold text-white"
                    style={{ background: "var(--gradient-builder)" }}
                  >
                    N
                  </span>
                  <span className="flex-1 text-sm font-medium">Your workspace</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                    {activeKey ? "BYOK" : "Free"}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setAccountOpen(false);
                    setKeyOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <KeyRound className="h-3.5 w-3.5" />{" "}
                  {activeKey ? `Update ${activeProviderDef.short} key` : "Connect an AI provider"}
                </button>
                <a
                  href={activeProviderDef.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <Gift className="h-3.5 w-3.5" /> Get a {activeProviderDef.short} key
                </a>
                <a
                  href="https://lovable.dev/pricing"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <Star className="h-3.5 w-3.5" /> Pricing & plans
                </a>
              </div>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setKeyOpen(true)}
            className={
              "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors " +
              (activeKey
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                : "border-border/60 bg-background/40 text-muted-foreground hover:bg-background/70")
            }
            title={
              activeKey
                ? `${activeProviderDef.short} key connected`
                : "Connect an AI provider API key"
            }
          >
            <KeyRound className="h-3 w-3" />
            {activeKey ? activeProviderDef.short : "Key"}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="builder-scroll relative flex-1 space-y-4 overflow-y-auto px-4 py-5"
      >
        {messages.length === 0 && !isLoading && (
          <EmptyState
            onPick={(id) => {
              setMode(id);
              taRef.current?.focus();
            }}
          />
        )}

        {messages.map((m, i) => {
          const isUser = m.role === "user";
          const msgMode = m.mode ? MODES[m.mode] : null;
          const renderMarkdown =
            m.role === "assistant" &&
            (m.outputs === "text" || (!!msgMode && msgMode.outputs === "text"));
          return (
            <div
              key={i}
              className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""} animate-fade-in`}
            >
              <div
                className={
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold " +
                  (isUser
                    ? "bg-background/60 text-foreground border border-border/60"
                    : "text-white shadow-md")
                }
                style={!isUser ? { background: "var(--gradient-builder)" } : undefined}
              >
                {isUser ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              </div>
              <div
                className={`flex max-w-[85%] flex-col ${isUser ? "items-end" : "items-start"} gap-1`}
              >
                {msgMode && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                    <msgMode.icon className="h-2.5 w-2.5" /> {msgMode.label}
                  </span>
                )}
                <div
                  className={
                    "rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed " +
                    (isUser
                      ? "rounded-tr-md bg-foreground text-background"
                      : "rounded-tl-md border border-border/60 bg-background/40 text-foreground")
                  }
                >
                  {renderMarkdown ? (
                    <div className="markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-2.5 animate-fade-in">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-md"
              style={{ background: "var(--gradient-builder)" }}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="rounded-2xl rounded-tl-md border border-border/60 bg-background/40 px-3.5 py-3">
              <div className="flex items-center gap-1">
                <span
                  className="builder-dot h-1.5 w-1.5 rounded-full bg-foreground/60"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="builder-dot h-1.5 w-1.5 rounded-full bg-foreground/60"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="builder-dot h-1.5 w-1.5 rounded-full bg-foreground/60"
                  style={{ animationDelay: "300ms" }}
                />
                <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <activeMode.icon className="h-3 w-3" /> {activeMode.label} — thinking…
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={submit} className="relative shrink-0 border-t border-border/60 p-3">
        {/* Slash autocomplete */}
        {slashOpen && (
          <div className="mb-2 overflow-hidden rounded-xl border border-border/60 bg-background/95 shadow-2xl backdrop-blur">
            <div className="border-b border-border/60 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              Slash commands
            </div>
            {filteredModes.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onMouseEnter={() => setSlashIdx(i)}
                onClick={() => pickMode(m.id)}
                className={
                  "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors " +
                  (i === slashIdx ? "bg-muted" : "hover:bg-muted/60")
                }
              >
                <m.icon className="h-4 w-4 text-foreground/80" />
                <span className="flex-1">
                  <span className="block text-[13px] font-medium text-foreground">{m.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{m.description}</span>
                </span>
                <span className="rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {m.command}
                </span>
              </button>
            ))}
          </div>
        )}

        <div
          className="builder-glow-border rounded-2xl border border-border/60 bg-background/60 p-2 transition-colors focus-within:border-border"
          style={{ boxShadow: "var(--shadow-soft)" }}
        >
          {/* Mode pill row */}
          <div className="mb-1 flex items-center gap-1.5 px-1">
            <ModePill mode={mode} onChange={setMode} />
            <button
              type="button"
              onClick={() => {
                setInput("/");
                setSlashOpen(true);
                taRef.current?.focus();
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-background/70"
              title="Type / for commands"
            >
              <Slash className="h-2.5 w-2.5" /> commands
            </button>
          </div>

          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            placeholder={
              messages.length === 0
                ? `Try "${activeMode.label}" — describe what you want, or press / to switch mode…`
                : "Continue the conversation…"
            }
            disabled={isLoading}
            className="block w-full resize-none bg-transparent px-2 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-50"
            style={{ maxHeight: 200 }}
          />
          <div className="mt-1 flex items-center justify-between gap-2 px-1">
            <span className="text-[10px] text-muted-foreground/80">
              <kbd className="rounded border border-border/60 bg-background/60 px-1 py-px text-[9px]">
                /
              </kbd>{" "}
              commands ·{" "}
              <kbd className="rounded border border-border/60 bg-background/60 px-1 py-px text-[9px]">
                Enter
              </kbd>{" "}
              send
            </span>
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="group flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-md transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              style={{ background: "var(--gradient-builder)", boxShadow: "var(--shadow-glow)" }}
              aria-label="Send message"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </form>

      {/* AI provider / API key dialog */}
      {keyOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 p-4 backdrop-blur"
          onClick={() => setKeyOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl"
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
                style={{ background: "var(--gradient-builder)" }}
              >
                <KeyRound className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold leading-tight">Connect an AI provider</h2>
                <p className="text-[11px] text-muted-foreground">
                  Bring your own key — stored only in this browser and sent per-request.
                </p>
              </div>
            </div>

            <label className="mt-4 mb-1.5 block text-[10px] uppercase tracking-wider text-muted-foreground">
              Provider
            </label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {PROVIDER_LIST.map((p) => {
                const selected = draftProvider === p.id;
                const hasKey = !!byok.keys[p.id];
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setDraftProvider(p.id)}
                    className={
                      "relative rounded-xl border px-2.5 py-2 text-left text-[12px] transition-all " +
                      (selected
                        ? "border-foreground bg-foreground/5"
                        : "border-border/60 bg-background/40 hover:bg-background/70")
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{p.short}</span>
                      {hasKey && <Check className="h-3 w-3 text-emerald-400" />}
                    </div>
                    <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                      {p.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <label className="mt-4 mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
              API key
            </label>
            <input
              type="password"
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              placeholder={PROVIDERS[draftProvider].keyPlaceholder}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
            />

            <label className="mt-3 mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
              Model
            </label>
            <input
              value={draftModel}
              onChange={(e) => setDraftModel(e.target.value)}
              placeholder={PROVIDERS[draftProvider].defaultModel}
              list={`models-${draftProvider}`}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
            />
            <datalist id={`models-${draftProvider}`}>
              {PROVIDERS[draftProvider].models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>

            <p className="mt-2 text-[11px] text-muted-foreground">
              {PROVIDERS[draftProvider].keyHint}{" "}
              <a
                href={PROVIDERS[draftProvider].keyUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Get a key
              </a>
              .
            </p>

            <div className="mt-5 flex justify-between gap-2">
              <button
                onClick={clearKey}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Remove key
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setKeyOpen(false)}
                  className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={saveKey}
                  className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-all hover:scale-[1.02] active:scale-95"
                >
                  Save & use
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModePill({ mode, onChange }: { mode: ChatMode; onChange: (m: ChatMode) => void }) {
  const [open, setOpen] = useState(false);
  const m = MODES[mode];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-background/70"
      >
        <m.icon className="h-3.5 w-3.5" />
        <span>{m.label}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-50 mb-2 w-72 overflow-hidden rounded-xl border border-border/60 bg-background/95 p-1 shadow-2xl backdrop-blur">
            {MODE_LIST.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                className={
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted " +
                  (opt.id === mode ? "bg-muted" : "")
                }
              >
                <opt.icon className="h-4 w-4 text-foreground/80" />
                <span className="flex-1">
                  <span className="block text-[13px] font-medium text-foreground">{opt.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{opt.description}</span>
                </span>
                <span className="rounded border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {opt.command}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (id: ChatMode) => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-10 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg"
        style={{ background: "var(--gradient-builder)", boxShadow: "var(--shadow-glow)" }}
      >
        <Sparkles className="h-5 w-5" />
      </div>
      <h2 className="mt-3 text-base font-semibold">What do you want to create?</h2>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Choose a mode — or type{" "}
        <kbd className="rounded border border-border/60 bg-background/60 px-1 py-px text-[10px]">
          /
        </kbd>{" "}
        in the input for commands.
      </p>
      <div className="mt-4 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {MODE_LIST.map((m) => (
          <button
            key={m.id}
            onClick={() => onPick(m.id)}
            className="group flex items-start gap-2 rounded-xl border border-border/60 bg-background/40 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:bg-background/70"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-foreground/80">
              <m.icon className="h-4 w-4" />
            </span>
            <span className="flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-foreground">{m.label}</span>
                <span className="rounded border border-border/60 bg-background/60 px-1 py-px font-mono text-[9px] text-muted-foreground">
                  {m.command}
                </span>
              </span>
              <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                {m.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
