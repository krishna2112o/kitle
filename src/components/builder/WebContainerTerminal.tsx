import { useEffect, useRef, useState, useCallback } from "react";
import type { WebContainerProcess } from "@webcontainer/api";
import { getWebContainer } from "@/lib/webcontainer";

interface Props {
  /** Whether the terminal panel is currently visible. */
  visible: boolean;
}

// Strip ANSI escape / control sequences so raw shell output renders cleanly
// in a plain element (no xterm dependency required).
function stripAnsi(input: string): string {
  return (
    input
      // CSI sequences: ESC [ ... letter
      .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
      // OSC sequences: ESC ] ... BEL or ESC \
      .replace(/\x1b\][^\x07]*(\x07|\x1b\\)/g, "")
      // Other single ESC sequences
      .replace(/\x1b[@-Z\\-_]/g, "")
      // Carriage returns (progress bars) — keep newlines only
      .replace(/\r(?!\n)/g, "\n")
  );
}

/**
 * A dependency-free interactive terminal wired to the in-browser WebContainer.
 * Spawns a `jsh` shell so the user can run any command (ls, npm install,
 * npm run dev, etc.) against the same file system that powers the live preview.
 */
export function WebContainerTerminal({ visible }: Props) {
  const [lines, setLines] = useState<string>("Booting in-browser shell…\n");
  const [command, setCommand] = useState("");
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const outputRef = useRef<HTMLPreElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<string> | null>(null);
  const processRef = useRef<WebContainerProcess | null>(null);
  const startedRef = useRef(false);

  const append = useCallback((chunk: string) => {
    setLines((prev) => {
      const next = (prev + stripAnsi(chunk)).slice(-40000); // cap buffer
      return next;
    });
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let disposed = false;

    (async () => {
      try {
        const wc = await getWebContainer();
        if (disposed) return;
        const shell = await wc.spawn("jsh");
        processRef.current = shell;
        writerRef.current = shell.input.getWriter();
        setReady(true);
        void shell.output.pipeTo(
          new WritableStream({
            write(data) {
              append(data);
            },
          }),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        append(`\nFailed to start shell: ${msg}\n`);
      }
    })();

    return () => {
      disposed = true;
      try {
        writerRef.current?.releaseLock();
      } catch {
        /* ignore */
      }
      try {
        processRef.current?.kill();
      } catch {
        /* ignore */
      }
      startedRef.current = false;
    };
  }, [append]);

  // Auto-scroll to the newest output.
  useEffect(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  // Focus the input when the panel becomes visible.
  useEffect(() => {
    if (visible) inputRef.current?.focus();
  }, [visible]);

  const runCommand = useCallback(
    (raw: string) => {
      const writer = writerRef.current;
      if (!writer) return;
      append(`\n$ ${raw}\n`);
      void writer.write(raw + "\n");
      if (raw.trim()) {
        setHistory((prev) => [...prev, raw]);
      }
      setHistoryIndex(-1);
    },
    [append],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;

    // Ctrl+C — send interrupt to the shell.
    if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
      e.preventDefault();
      void writerRef.current?.write("\x03");
      append("^C\n");
      setCommand("");
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      runCommand(command);
      setCommand("");
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const idx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(idx);
      setCommand(history[idx]);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === -1) return;
      const idx = historyIndex + 1;
      if (idx >= history.length) {
        setHistoryIndex(-1);
        setCommand("");
      } else {
        setHistoryIndex(idx);
        setCommand(history[idx]);
      }
    }
  };

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{ background: "#0b0b0f", color: "#e5e5e5" }}
      onClick={() => inputRef.current?.focus()}
    >
      <pre
        ref={outputRef}
        className="m-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-3 pt-3 text-[12px] leading-relaxed"
        style={{
          fontFamily:
            '"Fira Code", "Cascadia Code", "JetBrains Mono", ui-monospace, monospace',
        }}
      >
        {lines}
      </pre>
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderTop: "1px solid #1e1e26" }}
      >
        <span style={{ color: "#4ade80" }} className="text-[12px] font-medium">
          $
        </span>
        <input
          ref={inputRef}
          value={command}
          disabled={!ready}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={ready ? "Type a command and press Enter…" : "Starting shell…"}
          className="flex-1 bg-transparent text-[12px] outline-none"
          style={{
            color: "#e5e5e5",
            fontFamily:
              '"Fira Code", "Cascadia Code", "JetBrains Mono", ui-monospace, monospace',
          }}
        />
      </div>
    </div>
  );
}
