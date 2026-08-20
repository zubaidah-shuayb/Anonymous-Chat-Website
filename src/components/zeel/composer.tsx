import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, SendHorizonal, Smile, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { MessageRow, ThemeKey } from "@/lib/zeel";
import {
  ACCEPT_ATTRIBUTE,
  formatBytes,
  kindOf,
  probeFile,
  thumbPathFor,
  validateFile,
} from "@/lib/media";
import { removeObjects, uploadObject } from "@/lib/upload";
import { EmojiPicker } from "./emoji-picker";
import type { SendPayload } from "@/hooks/use-chat";

type Staged = {
  id: string;
  file: File;
  localUrl: string | null;
  progress: number;
  status: "uploading" | "ready" | "failed";
  path?: string;
  width?: number;
  height?: number;
  duration?: number;
  controller?: AbortController;
};

export function Composer({
  roomId,
  theme,
  replyTo,
  replyAuthor,
  onCancelReply,
  onSend,
  onTyping,
  disabled,
}: {
  roomId: string;
  theme: ThemeKey;
  replyTo: MessageRow | null;
  replyAuthor: string | null;
  onCancelReply: () => void;
  onSend: (payload: SendPayload) => Promise<void>;
  onTyping: () => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const draftKey = `zeel:draft:${roomId}`;

  // restore + persist draft text per room
  useEffect(() => {
    const saved = window.localStorage.getItem(draftKey);
    if (saved) setText(saved);
  }, [draftKey]);

  useEffect(() => {
    if (text) window.localStorage.setItem(draftKey, text);
    else window.localStorage.removeItem(draftKey);
  }, [text, draftKey]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  const startUpload = useCallback(
    async (file: File) => {
      const problem = validateFile(file);
      if (problem) {
        toast.error(problem);
        return;
      }
      const id = crypto.randomUUID();
      const kind = kindOf(file.type);
      const localUrl = kind === "image" || kind === "video" ? URL.createObjectURL(file) : null;
      const controller = new AbortController();

      setStaged((prev) => [
        ...prev,
        { id, file, localUrl, progress: 0, status: "uploading", controller },
      ]);

      const patch = (next: Partial<Staged>) =>
        setStaged((prev) => prev.map((s) => (s.id === id ? { ...s, ...next } : s)));

      try {
        const probe = await probeFile(file);
        const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-80);
        const path = `${roomId}/${id}-${safe}`;

        await uploadObject({
          path,
          body: file,
          contentType: file.type || "application/octet-stream",
          signal: controller.signal,
          onProgress: (fraction) => patch({ progress: fraction }),
        });

        if (probe.thumbnail) {
          try {
            await uploadObject({
              path: thumbPathFor(path),
              body: probe.thumbnail,
              contentType: "image/jpeg",
            });
          } catch {
            /* thumbnails are an optimisation, never a blocker */
          }
        }

        patch({
          status: "ready",
          progress: 1,
          path,
          ...(probe.width ? { width: probe.width } : {}),
          ...(probe.height ? { height: probe.height } : {}),
          ...(probe.duration ? { duration: probe.duration } : {}),
        });
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") {
          setStaged((prev) => prev.filter((s) => s.id !== id));
          return;
        }
        patch({ status: "failed" });
        toast.error(err instanceof Error ? err.message : "Upload failed");
      }
    },
    [roomId],
  );

  function removeStaged(item: Staged) {
    item.controller?.abort();
    if (item.localUrl) URL.revokeObjectURL(item.localUrl);
    if (item.path) void removeObjects([item.path, thumbPathFor(item.path)]);
    setStaged((prev) => prev.filter((s) => s.id !== item.id));
  }

  async function submit() {
    if (sending || disabled) return;
    const body = text.trim();
    const ready = staged.filter((s) => s.status === "ready" && s.path);
    if (staged.some((s) => s.status === "uploading")) {
      toast.info("Hang on — your attachment is still uploading.");
      return;
    }
    if (!body && ready.length === 0) return;

    setSending(true);
    const previousText = text;
    setText("");
    try {
      if (ready.length === 0) {
        await onSend({ body, replyTo: replyTo?.id ?? null });
      } else {
        for (const [index, item] of ready.entries()) {
          await onSend({
            body: index === 0 ? body : "",
            replyTo: index === 0 ? (replyTo?.id ?? null) : null,
            attachment: {
              path: item.path!,
              type: item.file.type || "application/octet-stream",
              name: item.file.name,
              size: item.file.size,
              width: item.width ?? null,
              height: item.height ?? null,
              duration: item.duration ?? null,
            },
          });
        }
      }
      for (const item of staged) if (item.localUrl) URL.revokeObjectURL(item.localUrl);
      setStaged([]);
      onCancelReply();
    } catch {
      setText(previousText);
      toast.error("Message could not be sent — tap retry.");
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  const canSend =
    !disabled &&
    !sending &&
    (text.trim().length > 0 || staged.some((s) => s.status === "ready")) &&
    !staged.some((s) => s.status === "uploading");

  return (
    <div
      className={cn("px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]", `theme-${theme}`)}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        for (const file of Array.from(e.dataTransfer.files).slice(0, 5)) void startUpload(file);
      }}
    >
      {replyTo ? (
        <div className="animate-rise mx-auto mb-2 flex max-w-3xl items-center gap-2 rounded-2xl border border-border/70 bg-card/80 px-3 py-2 text-sm">
          <span className="h-8 w-0.5 shrink-0 rounded-full bg-accent-1" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-accent-1">Replying to {replyAuthor}</p>
            <p className="truncate text-xs text-muted-foreground">
              {replyTo.body || replyTo.attachment_name || "Attachment"}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {staged.length > 0 ? (
        <div className="zeel-scroll mx-auto mb-2 flex max-w-3xl gap-2 overflow-x-auto pb-1">
          {staged.map((item) => (
            <div
              key={item.id}
              className="animate-pop relative flex w-40 shrink-0 flex-col gap-1 rounded-2xl border border-border/70 bg-card p-2 shadow-soft"
            >
              {item.localUrl ? (
                <img src={item.localUrl} alt="" className="h-20 w-full rounded-xl object-cover" />
              ) : (
                <div className="flex h-20 w-full items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">
                  {item.file.name.split(".").pop()?.toUpperCase() ?? "FILE"}
                </div>
              )}
              <p className="truncate text-[0.7rem] font-medium">{item.file.name}</p>
              <p className="text-[0.65rem] text-muted-foreground">
                {item.status === "failed"
                  ? "Upload failed"
                  : item.status === "ready"
                    ? formatBytes(item.file.size)
                    : `${Math.round(item.progress * 100)}%`}
              </p>
              {item.status === "uploading" ? (
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="accent-gradient h-full transition-[width] duration-200"
                    style={{ width: `${Math.max(4, item.progress * 100)}%` }}
                  />
                </div>
              ) : null}
              {item.status === "failed" ? (
                <button
                  type="button"
                  onClick={() => {
                    removeStaged(item);
                    void startUpload(item.file);
                  }}
                  className="rounded-full border border-border px-2 py-0.5 text-[0.65rem] hover:bg-muted"
                >
                  Retry
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => removeStaged(item)}
                aria-label={`Remove ${item.file.name}`}
                className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full border border-border bg-card shadow-soft hover:bg-muted"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div
        className={cn(
          "glass mx-auto flex max-w-3xl items-end gap-1 rounded-[1.75rem] p-1.5 shadow-soft transition-shadow",
          dragging && "ring-2 ring-accent-1",
        )}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []).slice(0, 5);
            e.target.value = "";
            for (const file of files) void startUpload(file);
          }}
        />
        <button
          type="button"
          aria-label="Attach a file"
          onClick={() => fileRef.current?.click()}
          className="rounded-full p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Paperclip className="size-5" />
        </button>
        <EmojiPicker onPick={(emoji) => setText((prev) => prev + emoji)}>
          <button
            type="button"
            aria-label="Insert emoji"
            className="rounded-full p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Smile className="size-5" />
          </button>
        </EmojiPicker>
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          enterKeyHint="send"
          placeholder={disabled ? "Reconnecting…" : "Write something lovely…"}
          aria-label="Message"
          onChange={(e) => {
            setText(e.target.value);
            onTyping();
          }}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.length > 0) {
              e.preventDefault();
              for (const file of files.slice(0, 5)) void startUpload(file);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          className="zeel-scroll max-h-40 flex-1 resize-none bg-transparent px-2 py-2.5 text-[1rem] leading-relaxed outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          aria-label="Send message"
          disabled={!canSend}
          onClick={() => void submit()}
          className="accent-gradient flex size-11 shrink-0 items-center justify-center rounded-full text-accent-on shadow-accent transition-transform disabled:opacity-40 not-disabled:hover:scale-105 not-disabled:active:scale-95"
        >
          {sending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <SendHorizonal className="size-5" />
          )}
        </button>
      </div>
    </div>
  );
}
