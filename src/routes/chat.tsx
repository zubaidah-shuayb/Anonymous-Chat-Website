import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Info, Loader2, Search, WifiOff, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AvatarOrb } from "@/components/zeel/avatar-orb";
import { AppearanceToggle, ZeelMark } from "@/components/zeel/brand";
import { ChatInfo } from "@/components/zeel/chat-info";
import { Composer } from "@/components/zeel/composer";
import { MediaViewer } from "@/components/zeel/media-viewer";
import { MessageList } from "@/components/zeel/message-list";
import { useChat } from "@/hooks/use-chat";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchMyRoom,
  lastSeenLabel,
  searchMessages,
  type MessageRow,
  type Room,
  type ThemeKey,
} from "@/lib/zeel";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Our Space — ZEEL" },
      { name: "description", content: "Your private, real-time two-person conversation on ZEEL." },
      { property: "og:title", content: "Our Space — ZEEL" },
      { property: "og:description", content: "Your private two-person conversation on ZEEL." },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { user, loading: sessionLoading } = useSession();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MessageRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ items: MessageRow[]; index: number } | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      void navigate({ to: "/", replace: true });
      return;
    }
    let active = true;
    void fetchMyRoom(user.id)
      .then((found) => {
        if (!active) return;
        if (!found) void navigate({ to: "/create", replace: true });
        setRoom(found);
        setRoomLoading(false);
      })
      .catch(() => setRoomLoading(false));
    return () => {
      active = false;
    };
  }, [user, sessionLoading, navigate]);

  const chat = useChat(room?.id ?? null, user?.id ?? null);
  const myTheme = (chat.me?.theme as ThemeKey) ?? "rose";
  const partnerTheme = (chat.partner?.theme as ThemeKey) ?? "azure";

  // debounced full-history search
  useEffect(() => {
    const q = query.trim();
    if (!room || q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const id = setTimeout(() => {
      void searchMessages(room.id, q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(id);
  }, [query, room]);

  const focusMessage = useCallback(
    async (messageId: string) => {
      await chat.jumpTo(messageId);
      setHighlightId(messageId);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => setHighlightId(null), 2400);
    },
    [chat],
  );

  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    },
    [],
  );

  function openMedia(message: MessageRow) {
    const gallery = chat.messages.filter(
      (m) =>
        m.attachment_path &&
        !m.deleted_at &&
        ((m.attachment_type ?? "").startsWith("image/") ||
          (m.attachment_type ?? "").startsWith("video/")),
    );
    const index = gallery.findIndex((m) => m.id === message.id);
    if (index >= 0) setViewer({ items: gallery, index });
  }

  async function updateTheme(theme: ThemeKey) {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ theme }).eq("id", user.id);
    if (error) toast.error("Could not save your colour");
    else await chat.reload();
  }

  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/", replace: true });
  }

  if (sessionLoading || roomLoading || !room || !user) {
    return (
      <main className="page-gradient flex min-h-dvh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="sr-only">Loading your space</span>
      </main>
    );
  }

  const offline = chat.connection === "offline" || chat.connection === "reconnecting";

  return (
    <main className="page-gradient flex h-dvh flex-col">
      <header className="glass sticky top-0 z-20 flex items-center gap-3 px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <Link to="/" aria-label="ZEEL home">
          <ZeelMark className="size-9" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{room.name}</p>
          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            {chat.partner ? (
              <>
                <span
                  className={`size-1.5 rounded-full ${chat.partnerOnline ? "bg-emerald-500" : "bg-muted-foreground/50"}`}
                />
                {chat.partner.display_name} ·{" "}
                {chat.partnerTyping
                  ? "typing…"
                  : chat.partnerOnline
                    ? "online"
                    : lastSeenLabel(chat.partner.last_seen_at)}
              </>
            ) : (
              "Waiting for your person to join"
            )}
          </p>
        </div>
        {chat.partner ? (
          <AvatarOrb
            name={chat.partner.display_name}
            theme={partnerTheme}
            online={chat.partnerOnline}
            className="size-9 text-xs"
          />
        ) : null}
        <button
          type="button"
          aria-label="Search messages"
          onClick={() => setSearchOpen((v) => !v)}
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
        </button>
        <AppearanceToggle className="hidden sm:inline-flex" />
        <button
          type="button"
          aria-label="Chat info"
          onClick={() => setInfoOpen(true)}
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Info className="size-5" />
        </button>
      </header>

      {offline ? (
        <div
          role="status"
          className="animate-rise flex items-center justify-center gap-2 bg-muted px-3 py-1.5 text-xs text-muted-foreground"
        >
          <WifiOff className="size-3.5" />
          {chat.connection === "offline"
            ? "You're offline — messages will send when you're back."
            : "Reconnecting…"}
        </div>
      ) : null}

      {searchOpen ? (
        <div className="animate-rise glass z-10 border-b border-border/60 px-3 py-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this conversation…"
            aria-label="Search this conversation"
            className="w-full rounded-2xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:border-accent-1"
          />
          {query.trim().length >= 2 ? (
            <div className="zeel-scroll mt-2 max-h-52 space-y-1 overflow-y-auto">
              {searching ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">Searching…</p>
              ) : results.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">No matches yet.</p>
              ) : (
                results.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSearchOpen(false);
                      setQuery("");
                      void focusMessage(m.id);
                    }}
                    className="block w-full rounded-2xl px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span className="line-clamp-1">
                      {m.body || m.attachment_name || "Attachment"}
                    </span>
                    <span className="text-[0.7rem] text-muted-foreground">
                      {format(new Date(m.created_at), "d MMM · HH:mm")}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {chat.loading ? (
        <div className="flex flex-1 flex-col justify-end gap-3 px-4 pb-4">
          {[70, 45, 60].map((width, i) => (
            <div
              key={i}
              className={`h-12 animate-pulse rounded-3xl bg-muted ${i % 2 ? "self-end" : ""}`}
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
      ) : chat.error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-muted-foreground">{chat.error}</p>
          <button
            type="button"
            onClick={() => void chat.reload()}
            className="rounded-full border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Try again
          </button>
        </div>
      ) : (
        <MessageList
          messages={chat.messages}
          reactions={chat.reactions}
          profiles={chat.profiles}
          myId={user.id}
          partnerReadAt={chat.partnerReadAt}
          partnerDeliveredAt={chat.partnerDeliveredAt}
          partnerTyping={chat.partnerTyping}
          partnerName={chat.partner?.display_name ?? "They"}
          partnerTheme={partnerTheme}
          outbox={chat.outbox}
          hasMore={chat.hasMore}
          loadingOlder={chat.loadingOlder}
          loadOlder={() => void chat.loadOlder()}
          hasNewer={chat.hasNewer}
          loadingNewer={chat.loadingNewer}
          loadNewer={() => void chat.loadNewer()}
          onReply={setReplyTo}
          onDelete={(m) => {
            void chat.remove(m.id).catch(() => toast.error("Could not delete that message"));
          }}
          onReact={(id, emoji) => void chat.toggleReaction(id, emoji)}
          onEdit={(m, body) => {
            void chat.edit(m.id, body).catch(() => toast.error("Could not save your edit"));
          }}
          onRetry={(m) => {
            void chat.retry(m.id).catch(() => toast.error("Still couldn't send that"));
          }}
          onDiscard={(m) => chat.discard(m.id)}
          onOpenMedia={openMedia}
          onJumpToMessage={(id) => void focusMessage(id)}
          highlightId={highlightId}
          emptyState={
            <div className="animate-rise mx-auto max-w-sm px-6 py-16 text-center">
              <ZeelMark className="mx-auto size-14" />
              <h2 className="font-display mt-4 text-xl tracking-tight">
                {chat.partner ? "Say the first thing" : "Almost there"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {chat.partner
                  ? `This is the very beginning of ${room.name}. Nothing here but the two of you.`
                  : "Share your invitation link and this room becomes yours together."}
              </p>
            </div>
          }
        />
      )}

      <Composer
        roomId={room.id}
        theme={myTheme}
        replyTo={replyTo}
        replyAuthor={
          replyTo
            ? (chat.profiles.find((p) => p.id === replyTo.sender_id)?.display_name ?? "Someone")
            : null
        }
        onCancelReply={() => setReplyTo(null)}
        onSend={chat.send}
        onTyping={chat.notifyTyping}
        disabled={chat.connection === "offline"}
      />

      <ChatInfo
        open={infoOpen}
        onOpenChange={setInfoOpen}
        room={room}
        me={chat.me}
        partner={chat.partner}
        partnerOnline={chat.partnerOnline}
        messageCount={chat.messages.length}
        onThemeChange={(theme) => void updateTheme(theme)}
        onSignOut={() => void signOut()}
        onOpenMedia={(items, index) => {
          setInfoOpen(false);
          setViewer({ items, index });
        }}
      />

      {viewer ? (
        <MediaViewer
          items={viewer.items}
          index={viewer.index}
          onIndexChange={(index) => setViewer((prev) => (prev ? { ...prev, index } : prev))}
          onClose={() => setViewer(null)}
          authorFor={(senderId) =>
            chat.profiles.find((p) => p.id === senderId)?.display_name ?? "Someone"
          }
        />
      ) : null}
    </main>
  );
}
