import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { ArrowDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { MessageRow, Profile, ReactionRow, ThemeKey } from "@/lib/zeel";
import type { OutboxStatus } from "@/hooks/use-chat";
import { MessageBubble, type BubbleStatus } from "./message-bubble";

function dayLabel(date: Date) {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, d MMMM yyyy");
}

export function MessageList({
  messages,
  reactions,
  profiles,
  myId,
  partnerReadAt,
  partnerDeliveredAt,
  partnerTyping,
  partnerName,
  partnerTheme,
  outbox,
  hasMore,
  loadingOlder,
  loadOlder,
  hasNewer,
  loadingNewer,
  loadNewer,
  onReply,
  onDelete,
  onReact,
  onEdit,
  onRetry,
  onDiscard,
  onOpenMedia,
  onJumpToMessage,
  emptyState,
  highlightId,
}: {
  messages: MessageRow[];
  reactions: ReactionRow[];
  profiles: Profile[];
  myId: string;
  partnerReadAt: number;
  partnerDeliveredAt: number;
  partnerTyping: boolean;
  partnerName: string;
  partnerTheme: ThemeKey;
  outbox: Record<string, OutboxStatus>;
  hasMore: boolean;
  loadingOlder: boolean;
  loadOlder: () => void;
  hasNewer: boolean;
  loadingNewer: boolean;
  loadNewer: () => void;
  onReply: (m: MessageRow) => void;
  onDelete: (m: MessageRow) => void;
  onReact: (id: string, emoji: string) => void;
  onEdit: (m: MessageRow, body: string) => void;
  onRetry: (m: MessageRow) => void;
  onDiscard: (m: MessageRow) => void;
  onOpenMedia: (m: MessageRow) => void;
  onJumpToMessage: (id: string) => void;
  emptyState: React.ReactNode;
  highlightId: string | null;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const prevCount = useRef(0);
  const prevHeight = useRef(0);
  const lastId = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const newest = messages[messages.length - 1];
    const appended = Boolean(newest && newest.id !== lastId.current);
    const grewAtTop = messages.length > prevCount.current && !appended;

    if (grewAtTop) {
      el.scrollTop = el.scrollHeight - prevHeight.current;
    } else if (appended) {
      const mine = newest?.sender_id === myId;
      if (mine || atBottom || prevCount.current === 0) {
        bottomRef.current?.scrollIntoView({
          behavior: prevCount.current === 0 ? "auto" : "smooth",
        });
      } else {
        setUnseen((n) => n + 1);
      }
    }
    lastId.current = newest?.id ?? null;
    prevCount.current = messages.length;
    prevHeight.current = el.scrollHeight;
  }, [messages, atBottom, myId]);

  useEffect(() => {
    if (!highlightId) return;
    const node = document.getElementById(`msg-${highlightId}`);
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId, messages.length]);

  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const bottom = distance < 120;
    setAtBottom(bottom);
    if (bottom) setUnseen(0);
    if (el.scrollTop < 120 && hasMore && !loadingOlder) {
      prevHeight.current = el.scrollHeight;
      loadOlder();
    }
    if (distance < 200 && hasNewer && !loadingNewer) loadNewer();
  }, [hasMore, loadingOlder, loadOlder, hasNewer, loadingNewer, loadNewer]);

  function jumpToBottom() {
    setUnseen(0);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  let lastDay = "";

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="zeel-scroll h-full overflow-y-auto scroll-smooth px-3 pt-4 pb-2"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-2.5">
          {hasMore ? (
            <div className="flex justify-center py-2">
              {loadingOlder ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : (
                <button
                  type="button"
                  onClick={loadOlder}
                  className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
                >
                  Load earlier messages
                </button>
              )}
            </div>
          ) : null}

          {messages.length === 0 ? emptyState : null}

          {messages.map((message) => {
            const created = new Date(message.created_at);
            const label = dayLabel(created);
            const showDay = label !== lastDay;
            lastDay = label;
            const mine = message.sender_id === myId;
            const author = profiles.find((p) => p.id === message.sender_id);
            const replied = message.reply_to
              ? (messages.find((m) => m.id === message.reply_to) ?? null)
              : null;
            const repliedAuthor = replied
              ? (profiles.find((p) => p.id === replied.sender_id)?.display_name ?? "Message")
              : null;
            const pendingStatus = message.client_id ? outbox[message.client_id] : undefined;
            const sentAt = created.getTime();
            const status: BubbleStatus = pendingStatus
              ? pendingStatus
              : sentAt <= partnerReadAt
                ? "read"
                : sentAt <= partnerDeliveredAt
                  ? "delivered"
                  : "sent";

            return (
              <div key={message.id} id={`msg-${message.id}`}>
                {showDay ? (
                  <div className="my-4 flex items-center justify-center">
                    <span className="glass rounded-full px-3 py-1 text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
                      {label}
                    </span>
                  </div>
                ) : null}
                <div
                  className={cn(
                    "rounded-3xl transition-colors duration-500",
                    highlightId === message.id && "bg-accent-1/12",
                  )}
                >
                  <MessageBubble
                    message={message}
                    mine={mine}
                    theme={(author?.theme as ThemeKey) ?? (mine ? "rose" : partnerTheme)}
                    authorName={author?.display_name ?? "Someone"}
                    repliedTo={replied}
                    repliedAuthor={repliedAuthor}
                    reactions={reactions.filter((r) => r.message_id === message.id)}
                    myId={myId}
                    status={status}
                    onReply={onReply}
                    onDelete={onDelete}
                    onReact={onReact}
                    onEdit={onEdit}
                    onRetry={onRetry}
                    onDiscard={onDiscard}
                    onOpenMedia={onOpenMedia}
                    onJumpToReply={onJumpToMessage}
                    onCopy={(text) => {
                      void navigator.clipboard.writeText(text);
                      toast.success("Copied to clipboard");
                    }}
                  />
                </div>
              </div>
            );
          })}

          {loadingNewer ? (
            <div className="flex justify-center py-2">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : null}

          {partnerTyping ? (
            <div className={cn("flex items-center gap-2", `theme-${partnerTheme}`)}>
              <div className="flex items-center gap-1 rounded-full border border-border/70 bg-card px-3 py-2 shadow-soft">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="typing-dot size-1.5 rounded-full bg-accent-1"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{partnerName} is typing…</span>
            </div>
          ) : null}

          <div ref={bottomRef} className="h-1" />
        </div>
      </div>

      {!atBottom ? (
        <button
          type="button"
          onClick={jumpToBottom}
          aria-label="Jump to latest messages"
          className="glass animate-pop absolute right-4 bottom-4 flex size-11 items-center justify-center rounded-full shadow-float"
        >
          <ArrowDown className="size-4" />
          {unseen > 0 ? (
            <span className="accent-gradient absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full px-1 text-[0.65rem] font-semibold text-accent-on">
              {unseen > 9 ? "9+" : unseen}
            </span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}
