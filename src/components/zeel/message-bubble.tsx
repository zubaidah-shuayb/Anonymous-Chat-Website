import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  Clock,
  CornerUpLeft,
  Copy,
  Pencil,
  RotateCcw,
  Smile,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { URL_PATTERN, type MessageRow, type ReactionRow, type ThemeKey } from "@/lib/zeel";
import { AttachmentView } from "./attachment-view";
import { EmojiPicker } from "./emoji-picker";

const QUICK = ["❤️", "😂", "🥰", "👍", "🔥", "😢"];

export type BubbleStatus = "sending" | "failed" | "sent" | "delivered" | "read";

function Linkified({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  const pattern = new RegExp(URL_PATTERN.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const href = match[0];
    parts.push(
      <a
        key={`${href}-${match.index}`}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="underline underline-offset-2 hover:opacity-80"
      >
        {href}
      </a>,
    );
    last = match.index + href.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

export function MessageBubble({
  message,
  mine,
  theme,
  authorName,
  repliedTo,
  repliedAuthor,
  reactions,
  myId,
  status,
  onReply,
  onDelete,
  onReact,
  onCopy,
  onEdit,
  onRetry,
  onDiscard,
  onOpenMedia,
  onJumpToReply,
}: {
  message: MessageRow;
  mine: boolean;
  theme: ThemeKey;
  authorName: string;
  repliedTo: MessageRow | null;
  repliedAuthor: string | null;
  reactions: ReactionRow[];
  myId: string;
  status: BubbleStatus;
  onReply: (m: MessageRow) => void;
  onDelete: (m: MessageRow) => void;
  onReact: (id: string, emoji: string) => void;
  onCopy: (text: string) => void;
  onEdit: (m: MessageRow, body: string) => void;
  onRetry: (m: MessageRow) => void;
  onDiscard: (m: MessageRow) => void;
  onOpenMedia: (m: MessageRow) => void;
  onJumpToReply: (id: string) => void;
}) {
  const deleted = Boolean(message.deleted_at);
  const failed = status === "failed";
  const pending = status === "sending";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body);
  const editRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing) {
      setDraft(message.body);
      requestAnimationFrame(() => editRef.current?.focus());
    }
  }, [editing, message.body]);

  const grouped = new Map<string, ReactionRow[]>();
  for (const r of reactions) {
    grouped.set(r.emoji, [...(grouped.get(r.emoji) ?? []), r]);
  }

  function commitEdit() {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== message.body) onEdit(message, next);
  }

  return (
    <div
      className={cn(
        "group/msg animate-rise flex w-full gap-2",
        mine ? "justify-end" : "justify-start",
        `theme-${theme}`,
      )}
    >
      <div className={cn("flex max-w-[86%] flex-col sm:max-w-[70%]", mine && "items-end")}>
        <div className={cn("flex items-end gap-1.5", mine && "flex-row-reverse")}>
          <div
            className={cn(
              "relative rounded-3xl px-3.5 py-2 text-[0.95rem] leading-relaxed shadow-soft transition-all duration-200",
              mine
                ? "accent-gradient rounded-br-lg text-accent-on shadow-accent"
                : "rounded-bl-lg border border-accent-1/35 bg-accent-1/10 text-card-foreground",
              deleted && "italic opacity-70",
              pending && "opacity-70",
              failed && "ring-1 ring-destructive/60",
            )}
          >
            {repliedTo ? (
              <button
                type="button"
                onClick={() => onJumpToReply(repliedTo.id)}
                className={cn(
                  "mb-1.5 block w-full rounded-2xl border-l-2 px-2.5 py-1 text-left text-xs transition-opacity hover:opacity-80",
                  mine
                    ? "border-white/60 bg-white/15 text-accent-on/90"
                    : "border-accent-1 bg-muted text-muted-foreground",
                )}
              >
                <span className="block font-medium">{repliedAuthor ?? "Message"}</span>
                <span className="line-clamp-2 opacity-90">
                  {repliedTo.deleted_at
                    ? "Deleted message"
                    : repliedTo.body || repliedTo.attachment_name || "Attachment"}
                </span>
              </button>
            ) : null}

            {deleted ? (
              <span className="text-sm">This message was deleted</span>
            ) : editing ? (
              <div className="w-56 sm:w-72">
                <textarea
                  ref={editRef}
                  value={draft}
                  rows={2}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      commitEdit();
                    }
                    if (e.key === "Escape") setEditing(false);
                  }}
                  className={cn(
                    "zeel-scroll w-full resize-none rounded-xl px-2 py-1.5 text-sm outline-none",
                    mine ? "bg-white/20 text-accent-on placeholder:text-accent-on/60" : "bg-muted",
                  )}
                />
                <div className="mt-1 flex justify-end gap-2 text-xs">
                  <button type="button" onClick={() => setEditing(false)} className="opacity-80">
                    Cancel
                  </button>
                  <button type="button" onClick={commitEdit} className="font-semibold">
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                {message.attachment_path ? (
                  <div className={cn(message.body && "mb-1.5")}>
                    <AttachmentView
                      attachment={{
                        path: message.attachment_path,
                        type: message.attachment_type,
                        name: message.attachment_name,
                        size: message.attachment_size,
                        width: message.attachment_width,
                        height: message.attachment_height,
                        duration: message.attachment_duration,
                      }}
                      mine={mine}
                      onOpen={() => onOpenMedia(message)}
                    />
                  </div>
                ) : null}
                {message.body ? (
                  <p className="break-words whitespace-pre-wrap">
                    <Linkified text={message.body} />
                  </p>
                ) : null}
              </>
            )}

            <div
              className={cn(
                "mt-1 flex items-center justify-end gap-1 text-[0.65rem]",
                mine ? "text-accent-on/80" : "text-muted-foreground",
              )}
            >
              {message.edited_at && !deleted ? <span>edited</span> : null}
              <span>{format(new Date(message.created_at), "HH:mm")}</span>
              {mine && !deleted ? (
                failed ? (
                  <TriangleAlert className="size-3 text-destructive" />
                ) : pending ? (
                  <Clock className="size-3" />
                ) : status === "read" ? (
                  <CheckCheck className="size-3.5 text-sky-200" />
                ) : status === "delivered" ? (
                  <CheckCheck className="size-3.5" />
                ) : (
                  <Check className="size-3.5" />
                )
              ) : null}
            </div>
          </div>

          {!deleted && !pending && !failed && !editing ? (
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100">
              <EmojiPicker onPick={(e) => onReact(message.id, e)} align={mine ? "end" : "start"}>
                <button
                  type="button"
                  aria-label="React"
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Smile className="size-3.5" />
                </button>
              </EmojiPicker>
              <button
                type="button"
                aria-label="Reply"
                onClick={() => onReply(message)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <CornerUpLeft className="size-3.5" />
              </button>
              {message.body ? (
                <button
                  type="button"
                  aria-label="Copy text"
                  onClick={() => onCopy(message.body)}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Copy className="size-3.5" />
                </button>
              ) : null}
              {mine && message.body ? (
                <button
                  type="button"
                  aria-label="Edit message"
                  onClick={() => setEditing(true)}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="size-3.5" />
                </button>
              ) : null}
              {mine ? (
                <button
                  type="button"
                  aria-label="Delete message"
                  onClick={() => onDelete(message)}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {failed ? (
          <div className="mt-1 flex items-center gap-2 text-xs text-destructive">
            <span>Not sent</span>
            <button
              type="button"
              onClick={() => onRetry(message)}
              className="flex items-center gap-1 rounded-full border border-destructive/40 px-2 py-0.5 hover:bg-destructive/10"
            >
              <RotateCcw className="size-3" /> Retry
            </button>
            <button
              type="button"
              onClick={() => onDiscard(message)}
              className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-muted-foreground hover:bg-muted"
            >
              <X className="size-3" /> Discard
            </button>
          </div>
        ) : null}

        {grouped.size > 0 ? (
          <div className={cn("mt-1 flex flex-wrap gap-1", mine && "justify-end")}>
            {[...grouped.entries()].map(([emoji, list]) => {
              const active = list.some((r) => r.user_id === myId);
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact(message.id, emoji)}
                  className={cn(
                    "animate-pop flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                    active
                      ? "border-accent-1 bg-accent-1/12 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span>{emoji}</span>
                  <span>{list.length}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {!deleted && !pending && !failed ? (
          <div className="mt-1 hidden gap-1 group-hover/msg:flex">
            {QUICK.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(message.id, emoji)}
                className="rounded-full px-1 text-sm opacity-60 transition-all hover:scale-125 hover:opacity-100"
                aria-label={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}
        <span className="sr-only">{authorName}</span>
      </div>
    </div>
  );
}
