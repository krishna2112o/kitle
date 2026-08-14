type Template = {
  id: string;
  name: string;
  category: string;
  description: string;
  preview: string;
  prompt: string;
};

export function TemplatePreviewModal({
  template,
  onClose,
  onUse,
}: {
  template: Template | null;
  onClose: () => void;
  onUse: (tpl: Template) => void;
}) {
  if (!template) return null;
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-background/85 p-4 backdrop-blur"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{template.category}</div>
            <h3 className="text-lg font-semibold text-foreground">{template.name}</h3>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{template.description}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="bg-muted/30 p-4">
          <div className="mx-auto aspect-[16/10] w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-background shadow-xl">
            <iframe
              title={template.name}
              srcDoc={`<!doctype html><html><body style="margin:0">${template.preview}</body></html>`}
              sandbox=""
              className="h-full w-full"
              style={{ transform: "scale(1.6)", transformOrigin: "top left", width: "62.5%", height: "62.5%" }}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <button
            onClick={onClose}
            className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Close
          </button>
          <button
            onClick={() => onUse(template)}
            className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-all hover:scale-[1.02] active:scale-95"
          >
            Use this template →
          </button>
        </div>
      </div>
    </div>
  );
}
