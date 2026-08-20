import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, X } from "lucide-react";
import { format } from "date-fns";
import { kindOf, signedUrl } from "@/lib/media";
import type { MessageRow } from "@/lib/zeel";

export function MediaViewer({
  items,
  index,
  onIndexChange,
  onClose,
  authorFor,
}: {
  items: MessageRow[];
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
  authorFor: (senderId: string) => string;
}) {
  const current = items[index];
  const [url, setUrl] = useState<string | null>(null);

  const step = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next >= 0 && next < items.length) onIndexChange(next);
    },
    [index, items.length, onIndexChange],
  );

  useEffect(() => {
    if (!current?.attachment_path) return;
    let active = true;
    setUrl(null);
    void signedUrl(current.attachment_path).then((next) => {
      if (active) setUrl(next);
    });
    return () => {
      active = false;
    };
  }, [current?.attachment_path]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, step]);

  if (!current?.attachment_path) return null;
  const kind = kindOf(current.attachment_type);

  return (
    <div
      className="animate-fade fixed inset-0 z-50 flex flex-col bg-black/92 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
    >
      <header className="flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 text-white/90">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{current.attachment_name ?? "Media"}</p>
          <p className="truncate text-xs text-white/60">
            {authorFor(current.sender_id)} ·{" "}
            {format(new Date(current.created_at), "d MMM yyyy · HH:mm")}
          </p>
        </div>
        <a
          href={url ?? undefined}
          download={current.attachment_name ?? undefined}
          target="_blank"
          rel="noreferrer"
          aria-label="Download"
          className="rounded-full p-2 transition-colors hover:bg-white/10"
        >
          <Download className="size-5" />
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close viewer"
          className="rounded-full p-2 transition-colors hover:bg-white/10"
        >
          <X className="size-5" />
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {!url ? (
          <Loader2 className="size-6 animate-spin text-white/70" />
        ) : kind === "video" ? (
          <video
            key={current.id}
            src={url}
            controls
            autoPlay
            playsInline
            className="animate-pop max-h-full max-w-full rounded-2xl"
          />
        ) : (
          <img
            key={current.id}
            src={url}
            alt={current.attachment_name ?? "Shared media"}
            className="animate-pop max-h-full max-w-full rounded-2xl object-contain"
          />
        )}

        {index > 0 ? (
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous"
            className="absolute left-2 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <ChevronLeft className="size-5" />
          </button>
        ) : null}
        {index < items.length - 1 ? (
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next"
            className="absolute right-2 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <ChevronRight className="size-5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
