import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  PAGE_SIZE,
  fetchMessages,
  fetchMessagesAfter,
  fetchMessagesAround,
  fetchProfiles,
  fetchReactions,
  fetchReceipts,
  markDelivered,
  markRead,
  touchLastSeen,
  type MessageRow,
  type Profile,
  type ReactionRow,
  type ReceiptRow,
} from "@/lib/zeel";

export type Attachment = {
  path: string;
  type: string;
  name: string;
  size?: number | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
};

export type SendPayload = {
  body: string;
  replyTo?: string | null;
  attachment?: Attachment | null;
};

export type OutboxStatus = "sending" | "failed";
export type ConnectionState = "connecting" | "connected" | "reconnecting" | "offline";

const PENDING_PREFIX = "pending:";

function optimisticRow(
  roomId: string,
  userId: string,
  clientId: string,
  payload: SendPayload,
): MessageRow {
  return {
    id: `${PENDING_PREFIX}${clientId}`,
    room_id: roomId,
    sender_id: userId,
    body: payload.body,
    reply_to: payload.replyTo ?? null,
    attachment_path: payload.attachment?.path ?? null,
    attachment_type: payload.attachment?.type ?? null,
    attachment_name: payload.attachment?.name ?? null,
    attachment_size: payload.attachment?.size ?? null,
    attachment_width: payload.attachment?.width ?? null,
    attachment_height: payload.attachment?.height ?? null,
    attachment_duration: payload.attachment?.duration ?? null,
    client_id: clientId,
    edited_at: null,
    deleted_at: null,
    created_at: new Date().toISOString(),
  } as MessageRow;
}

export function useChat(roomId: string | null, userId: string | null) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [hasNewer, setHasNewer] = useState(false);
  const [loadingNewer, setLoadingNewer] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [outbox, setOutbox] = useState<Record<string, OutboxStatus>>({});
  const outboxPayloads = useRef(new Map<string, SendPayload>());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  const partner = useMemo(() => profiles.find((p) => p.id !== userId) ?? null, [profiles, userId]);
  const me = useMemo(() => profiles.find((p) => p.id === userId) ?? null, [profiles, userId]);

  const reload = useCallback(async () => {
    if (!roomId) return;
    try {
      const [msgs, reacts, recs, profs] = await Promise.all([
        fetchMessages(roomId),
        fetchReactions(roomId),
        fetchReceipts(roomId),
        fetchProfiles(roomId),
      ]);
      setMessages((prev) => {
        const pending = prev.filter((m) => m.id.startsWith(PENDING_PREFIX));
        return [...msgs, ...pending];
      });
      setReactions(reacts);
      setReceipts(recs);
      setProfiles(profs);
      setHasMore(msgs.length >= PAGE_SIZE);
      setHasNewer(false);
      setError(null);
    } catch {
      setError("We couldn't load this conversation.");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    setLoading(true);
    void reload();
  }, [roomId, reload]);

  const loadOlder = useCallback(async () => {
    if (!roomId || loadingOlder || !hasMore) return;
    const oldest = messages[0];
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const older = await fetchMessages(roomId, oldest.created_at);
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !seen.has(m.id)), ...prev];
      });
      setHasMore(older.length >= PAGE_SIZE);
    } catch {
      /* keep what we have; the button stays available */
    } finally {
      setLoadingOlder(false);
    }
  }, [roomId, messages, hasMore, loadingOlder]);

  const loadNewer = useCallback(async () => {
    if (!roomId || loadingNewer || !hasNewer) return;
    const persisted = messages.filter((m) => !m.id.startsWith(PENDING_PREFIX));
    const newest = persisted[persisted.length - 1];
    if (!newest) return;
    setLoadingNewer(true);
    try {
      const rows = await fetchMessagesAfter(roomId, newest.created_at);
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const fresh = rows.filter((m) => !seen.has(m.id));
        const pending = prev.filter((m) => m.id.startsWith(PENDING_PREFIX));
        const rest = prev.filter((m) => !m.id.startsWith(PENDING_PREFIX));
        return [...rest, ...fresh, ...pending];
      });
      setHasNewer(rows.length >= PAGE_SIZE);
    } finally {
      setLoadingNewer(false);
    }
  }, [roomId, messages, hasNewer, loadingNewer]);

  /** Loads the window of messages around an arbitrary (possibly very old) message. */
  const jumpTo = useCallback(
    async (messageId: string) => {
      if (!roomId) return;
      if (messages.some((m) => m.id === messageId)) return;
      const window = await fetchMessagesAround(roomId, messageId);
      if (window.length === 0) return;
      setMessages((prev) => [...window, ...prev.filter((m) => m.id.startsWith(PENDING_PREFIX))]);
      setHasMore(true);
      setHasNewer(true);
    },
    [roomId, messages],
  );

  // realtime
  useEffect(() => {
    if (!roomId || !userId) return;
    setConnection(navigator.onLine === false ? "offline" : "connecting");
    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as MessageRow;
            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              const withoutPending = row.client_id
                ? prev.filter((m) => m.id !== `${PENDING_PREFIX}${row.client_id}`)
                : prev;
              return [...withoutPending, row];
            });
            if (row.sender_id !== userId) void markDelivered(roomId);
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as MessageRow;
            setMessages((prev) => prev.map((m) => (m.id === row.id ? row : m)));
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as { id?: string };
            setMessages((prev) => prev.filter((m) => m.id !== old.id));
          }
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => {
        void fetchReactions(roomId).then(setReactions);
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "read_receipts", filter: `room_id=eq.${roomId}` },
        () => {
          void fetchReceipts(roomId).then(setReceipts);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        () => {
          void fetchProfiles(roomId).then(setProfiles);
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setPartnerOnline(Object.keys(state).some((key) => key !== userId));
      })
      .on("broadcast", { event: "typing" }, (payload) => {
        const from = (payload["payload"] as { user_id?: string } | undefined)?.user_id;
        if (!from || from === userId) return;
        setPartnerTyping(true);
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setPartnerTyping(false), 3000);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnection("connected");
          void channel.track({ online_at: new Date().toISOString() });
          void markDelivered(roomId);
          void touchLastSeen();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnection(navigator.onLine === false ? "offline" : "reconnecting");
        } else if (status === "CLOSED") {
          setConnection((prev) => (prev === "connected" ? "reconnecting" : prev));
        }
      });

    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      void supabase.removeChannel(channel);
    };
  }, [roomId, userId]);

  // browser connectivity + refresh after coming back
  useEffect(() => {
    const goOffline = () => setConnection("offline");
    const goOnline = () => {
      setConnection("reconnecting");
      void reload();
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [reload]);

  // keep "last seen" fresh while the tab is in use
  useEffect(() => {
    if (!roomId || !userId) return;
    const beat = () => {
      if (document.visibilityState === "visible") void touchLastSeen();
    };
    beat();
    const id = setInterval(beat, 60_000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [roomId, userId]);

  // refresh partner profile (last seen) periodically
  useEffect(() => {
    if (!roomId) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void fetchProfiles(roomId).then(setProfiles);
    }, 60_000);
    return () => clearInterval(id);
  }, [roomId]);

  // read receipts — only while the tab is actually being looked at
  useEffect(() => {
    if (!roomId || !userId || messages.length === 0) return;
    const sync = () => {
      if (document.visibilityState !== "visible") return;
      void markRead(roomId, userId);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, [roomId, userId, messages.length]);

  const deliver = useCallback(
    async (clientId: string, payload: SendPayload) => {
      if (!roomId || !userId) return;
      setOutbox((prev) => ({ ...prev, [clientId]: "sending" }));
      const { data, error: insertError } = await supabase
        .from("messages")
        .insert({
          room_id: roomId,
          sender_id: userId,
          body: payload.body,
          reply_to: payload.replyTo ?? null,
          attachment_path: payload.attachment?.path ?? null,
          attachment_type: payload.attachment?.type ?? null,
          attachment_name: payload.attachment?.name ?? null,
          attachment_size: payload.attachment?.size ?? null,
          attachment_width: payload.attachment?.width ?? null,
          attachment_height: payload.attachment?.height ?? null,
          attachment_duration: payload.attachment?.duration ?? null,
          client_id: clientId,
        })
        .select()
        .single();

      if (insertError || !data) {
        setOutbox((prev) => ({ ...prev, [clientId]: "failed" }));
        throw insertError ?? new Error("Message could not be sent");
      }

      const row = data as MessageRow;
      outboxPayloads.current.delete(clientId);
      setOutbox((prev) => {
        const next = { ...prev };
        delete next[clientId];
        return next;
      });
      setMessages((prev) => {
        const withoutPending = prev.filter((m) => m.id !== `${PENDING_PREFIX}${clientId}`);
        return withoutPending.some((m) => m.id === row.id)
          ? withoutPending
          : [...withoutPending, row];
      });
    },
    [roomId, userId],
  );

  const send = useCallback(
    async (payload: SendPayload) => {
      if (!roomId || !userId) return;
      const clientId = crypto.randomUUID();
      outboxPayloads.current.set(clientId, payload);
      setMessages((prev) => [...prev, optimisticRow(roomId, userId, clientId, payload)]);
      await deliver(clientId, payload);
    },
    [roomId, userId, deliver],
  );

  const retry = useCallback(
    async (messageId: string) => {
      const clientId = messageId.replace(PENDING_PREFIX, "");
      const payload = outboxPayloads.current.get(clientId);
      if (!payload) return;
      await deliver(clientId, payload);
    },
    [deliver],
  );

  const discard = useCallback((messageId: string) => {
    const clientId = messageId.replace(PENDING_PREFIX, "");
    outboxPayloads.current.delete(clientId);
    setOutbox((prev) => {
      const next = { ...prev };
      delete next[clientId];
      return next;
    });
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  const remove = useCallback(
    async (messageId: string) => {
      if (messageId.startsWith(PENDING_PREFIX)) {
        discard(messageId);
        return;
      }
      const previous = messages.find((m) => m.id === messageId) ?? null;
      const { error: updateError } = await supabase
        .from("messages")
        .update({
          deleted_at: new Date().toISOString(),
          body: "",
          attachment_path: null,
          attachment_name: null,
          attachment_type: null,
        })
        .eq("id", messageId);
      if (updateError) {
        if (previous) setMessages((prev) => prev.map((m) => (m.id === messageId ? previous : m)));
        throw updateError;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, deleted_at: new Date().toISOString(), body: "", attachment_path: null }
            : m,
        ),
      );
    },
    [discard, messages],
  );

  const edit = useCallback(async (messageId: string, body: string) => {
    if (messageId.startsWith(PENDING_PREFIX)) return;
    const stamp = new Date().toISOString();
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, body, edited_at: stamp } : m)),
    );
    const { error: updateError } = await supabase
      .from("messages")
      .update({ body, edited_at: stamp })
      .eq("id", messageId);
    if (updateError) throw updateError;
  }, []);

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!userId) return;
      const existing = reactions.find(
        (r) => r.message_id === messageId && r.user_id === userId && r.emoji === emoji,
      );
      if (existing) {
        await supabase.from("message_reactions").delete().eq("id", existing.id);
        setReactions((prev) => prev.filter((r) => r.id !== existing.id));
      } else {
        const { data } = await supabase
          .from("message_reactions")
          .insert({ message_id: messageId, user_id: userId, emoji })
          .select()
          .maybeSingle();
        if (data) setReactions((prev) => [...prev, data as ReactionRow]);
      }
    },
    [reactions, userId],
  );

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (!channelRef.current || !userId || now - lastTypingSent.current < 1500) return;
    lastTypingSent.current = now;
    void channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: userId },
    });
  }, [userId]);

  const partnerReadAt = useMemo(() => {
    const rec = receipts.find((r) => r.user_id !== userId);
    return rec ? new Date(rec.last_read_at).getTime() : 0;
  }, [receipts, userId]);

  const partnerDeliveredAt = useMemo(() => {
    const rec = receipts.find((r) => r.user_id !== userId);
    return rec ? new Date(rec.last_delivered_at).getTime() : 0;
  }, [receipts, userId]);

  return {
    messages,
    reactions,
    profiles,
    me,
    partner,
    loading,
    error,
    loadingOlder,
    hasMore,
    loadOlder,
    hasNewer,
    loadingNewer,
    loadNewer,
    jumpTo,
    partnerOnline,
    partnerTyping,
    partnerReadAt,
    partnerDeliveredAt,
    connection,
    outbox,
    send,
    retry,
    discard,
    remove,
    edit,
    toggleReaction,
    notifyTyping,
    reload,
  };
}
