import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { WebContainerProcess } from "@webcontainer/api";
import { getWebContainer } from "@/lib/webcontainer";

interface Props {
  /** Whether the terminal panel is currently visible — used to refit dimensions. */
  visible: boolean;
}

/**
 * A real, interactive terminal wired to the in-browser WebContainer.
 * Spawns a `jsh` shell so the user can run any command (ls, npm run dev, etc.)
 * against the same file system that powers the live preview.
 */
export function WebContainerTerminal({ visible }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || !containerRef.current) return;
    startedRef.current = true;

    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontSize: 12,
      fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", ui-monospace, monospace',
      theme: {
        background: "#0b0b0f",
        foreground: "#e5e5e5",
        cursor: "#e5e5e5",
        selectionBackground: "#333344",
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    try {
      fit.fit();
    } catch {
      /* container may not be laid out yet */
    }
    termRef.current = term;
    fitRef.current = fit;

    term.write("\x1b[90mBooting in-browser shell…\x1b[0m\r\n");

    let disposed = false;
    let inputWriter: WritableStreamDefaultWriter<string> | null = null;
    let shellProcess: WebContainerProcess | null = null;

    (async () => {
      try {
        const wc = await getWebContainer();
        if (disposed) return;
        shellProcess = await wc.spawn("jsh", {
          terminal: { cols: term.cols, rows: term.rows },
        });
        void shellProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              term.write(data);
            },
          }),
        );
        inputWriter = shellProcess.input.getWriter();
        term.onData((data) => {
          void inputWriter?.write(data);
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        term.write(`\r\n\x1b[31mFailed to start shell: ${msg}\x1b[0m\r\n`);
      }
    })();

    const handleResize = () => {
      try {
        fit.fit();
        shellProcess?.resize?.({ cols: term.cols, rows: term.rows });
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", handleResize);
      try {
        inputWriter?.releaseLock();
      } catch {
        /* ignore */
      }
      try {
        shellProcess?.kill();
      } catch {
        /* ignore */
      }
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      startedRef.current = false;
    };
  }, []);

  // Refit whenever the panel becomes visible (fit() needs a laid-out container).
  useEffect(() => {
    if (!visible) return;
    const id = requestAnimationFrame(() => {
      try {
        fitRef.current?.fit();
      } catch {
        /* ignore */
      }
    });
    return () => cancelAnimationFrame(id);
  }, [visible]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
      style={{ background: "#0b0b0f", padding: 8 }}
    />
  );
}
