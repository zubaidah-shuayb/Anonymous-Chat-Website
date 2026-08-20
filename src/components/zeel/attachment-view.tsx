import { useEffect, useRef, useState } from "react";
import {
  Download,
  FileText,
  ImageIcon,
  Loader2,
  Music4,
  Pause,
  Play,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatBytes,
  formatDuration,
  kindOf,
  prettyType,
  previewUrl,
  signedUrl,
} from "@/lib/media";

export type AttachmentMeta = {
  path: string;
  type: string | null;
  name: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
};

function useObjectUrl(path: string, mode: "preview" | "full") {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setUrl(null);
    setFailed(false);
    const load = mode === "preview" ? previewUrl(path) : signedUrl(path);
    void load.then((next) => {
      if (!active) return;
      if (next) setUrl(next);
      else setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [path, mode]);

  return { url, failed, setFailed };
}

function MissingMedia({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border/80 bg-muted/40 px-3 py-4 text-xs text-muted-foreground">
      <TriangleAlert className="size-4" /> {label}
    </div>
  );
}

export function AttachmentView({
  attachment,
  onOpen,
  mine,
}: {
  attachment: AttachmentMeta;
  onOpen?: (() => void) | undefined;
  mine?: boolean | undefined;
}) {
  const kind = kindOf(attachment.type);
  if (kind === "image") return <ImageAttachment attachment={attachment} onOpen={onOpen} />;
  if (kind === "video") return <VideoAttachment attachment={attachment} onOpen={onOpen} />;
  if (kind === "audio") return <AudioAttachment attachment={attachment} mine={mine} />;
  return <FileAttachment attachment={attachment} mine={mine} />;
}

function ImageAttachment({
  attachment,
  onOpen,
}: {
  attachment: AttachmentMeta;
  onOpen?: (() => void) | undefined;
}) {
  const { url, failed, setFailed } = useObjectUrl(attachment.path, "preview");
  const ratio =
    attachment.width && attachment.height
      ? Math.min(Math.max(attachment.width / attachment.height, 0.6), 1.9)
      : 1.3;

  if (failed) return <MissingMedia label="This photo is no longer available" />;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={attachment.name ?? "Open photo"}
      className="group/media relative block w-60 max-w-full overflow-hidden rounded-2xl bg-muted/60 transition-transform duration-200 active:scale-[0.985] sm:w-72"
      style={{ aspectRatio: String(ratio) }}
    >
      {url ? (
        <img
          src={url}
          alt={attachment.name ?? "Shared photo"}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="animate-rise h-full w-full object-cover transition-transform duration-300 group-hover/media:scale-[1.03]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <ImageIcon className="size-5 animate-pulse text-muted-foreground" />
        </div>
      )}
    </button>
  );
}

function VideoAttachment({
  attachment,
  onOpen,
}: {
  attachment: AttachmentMeta;
  onOpen?: (() => void) | undefined;
}) {
  const { url, failed } = useObjectUrl(attachment.path, "preview");
  if (failed) return <MissingMedia label="This video is no longer available" />;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={attachment.name ?? "Play video"}
      className="group/media relative block w-60 max-w-full overflow-hidden rounded-2xl bg-black/40 transition-transform duration-200 active:scale-[0.985] sm:w-72"
      style={{ aspectRatio: "1.5" }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover opacity-90"
        />
      ) : null}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-transform duration-200 group-hover/media:scale-110">
          <Play className="size-5 translate-x-0.5 fill-current" />
        </span>
      </span>
      {attachment.duration ? (
        <span className="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-[0.65rem] font-medium text-white">
          {formatDuration(attachment.duration)}
        </span>
      ) : null}
    </button>
  );
}

function AudioAttachment({
  attachment,
  mine,
}: {
  attachment: AttachmentMeta;
  mine?: boolean | undefined;
}) {
  const { url, failed } = useObjectUrl(attachment.path, "full");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  if (failed) return <MissingMedia label="This audio is no longer available" />;

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }

  return (
    <div
      className={cn(
        "flex w-56 items-center gap-3 rounded-2xl px-3 py-2 sm:w-64",
        mine ? "bg-white/15" : "bg-muted",
      )}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={!url}
        aria-label={playing ? "Pause audio" : "Play audio"}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95",
          mine ? "bg-white/25 text-accent-on" : "accent-gradient text-accent-on",
        )}
      >
        {!url ? (
          <Loader2 className="size-4 animate-spin" />
        ) : playing ? (
          <Pause className="size-4 fill-current" />
        ) : (
          <Play className="size-4 translate-x-px fill-current" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn("h-1 rounded-full", mine ? "bg-white/25" : "bg-border")}>
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              mine ? "bg-white" : "bg-accent-1",
            )}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <p className="mt-1 flex items-center gap-1.5 truncate text-[0.7rem] opacity-80">
          <Music4 className="size-3" />
          <span className="truncate">{attachment.name ?? "Audio"}</span>
          {attachment.duration ? <span>· {formatDuration(attachment.duration)}</span> : null}
        </p>
      </div>
      <audio
        ref={audioRef}
        src={url ?? undefined}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration) setProgress(el.currentTime / el.duration);
        }}
        className="hidden"
      />
    </div>
  );
}

function FileAttachment({
  attachment,
  mine,
}: {
  attachment: AttachmentMeta;
  mine?: boolean | undefined;
}) {
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    const url = await signedUrl(attachment.path);
    setBusy(false);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      type="button"
      onClick={() => void open()}
      className={cn(
        "flex w-56 items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors sm:w-64",
        mine ? "bg-white/15 hover:bg-white/25" : "bg-muted hover:bg-muted/70",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          mine ? "bg-white/25" : "bg-card",
        )}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{attachment.name ?? "File"}</span>
        <span className="block text-[0.7rem] opacity-75">
          {prettyType(attachment.type, attachment.name)}
          {attachment.size ? ` · ${formatBytes(attachment.size)}` : ""}
        </span>
      </span>
      <Download className="size-4 shrink-0 opacity-70" />
    </button>
  );
}
