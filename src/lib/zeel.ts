import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Room = Database["public"]["Tables"]["rooms"]["Row"];
export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
export type ReactionRow = Database["public"]["Tables"]["message_reactions"]["Row"];
export type ReceiptRow = Database["public"]["Tables"]["read_receipts"]["Row"];
export type ThemeKey = "rose" | "azure";

export const THEMES: { key: ThemeKey; label: string; hint: string; swatch: string[] }[] = [
  { key: "rose", label: "Rose", hint: "pink · lavender", swatch: ["#f4a2c3", "#b79cf0"] },
  { key: "azure", label: "Azure", hint: "cyan · blue", swatch: ["#7dd3e8", "#6b8ff0"] },
];

export const PAGE_SIZE = 30;

export async function fetchMyRoom(userId: string) {
  const { data, error } = await supabase
    .from("room_members")
    .select("room_id, rooms(id, name, created_at, created_by)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.rooms as Room | null) ?? null;
}

export async function fetchProfiles(roomId: string) {
  const { data: members, error } = await supabase
    .from("room_members")
    .select("user_id")
    .eq("room_id", roomId);
  if (error) throw error;
  const ids = (members ?? []).map((m) => m.user_id);
  if (ids.length === 0) return [] as Profile[];
  const { data: profiles, error: pErr } = await supabase.from("profiles").select("*").in("id", ids);
  if (pErr) throw pErr;
  return (profiles ?? []) as Profile[];
}

export async function fetchMessages(roomId: string, before?: string) {
  let q = supabase
    .from("messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as MessageRow[]).slice().reverse();
}

export async function fetchMessagesAfter(roomId: string, after: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("room_id", roomId)
    .gt("created_at", after)
    .order("created_at", { ascending: true })
    .limit(PAGE_SIZE);
  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

export async function searchMessages(roomId: string, query: string) {
  const { data, error } = await supabase.rpc("search_messages", {
    p_room_id: roomId,
    p_query: query,
    p_limit: 40,
  });
  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

export async function fetchMessagesAround(roomId: string, messageId: string) {
  const { data, error } = await supabase.rpc("messages_around", {
    p_room_id: roomId,
    p_message_id: messageId,
    p_span: 25,
  });
  if (error) throw error;
  return ((data ?? []) as MessageRow[])
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export type MediaFilter = "all" | "image" | "video" | "audio" | "file";

export async function fetchRoomMedia(roomId: string, kind: MediaFilter, offset = 0) {
  const { data, error } = await supabase.rpc("room_media", {
    p_room_id: roomId,
    p_kind: kind,
    p_limit: 60,
    p_offset: offset,
  });
  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

export async function fetchRoomLinks(roomId: string) {
  const { data, error } = await supabase.rpc("room_links", { p_room_id: roomId, p_limit: 60 });
  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

export async function markDelivered(roomId: string) {
  await supabase.rpc("mark_delivered", { p_room_id: roomId });
}

export async function touchLastSeen() {
  await supabase.rpc("touch_last_seen");
}

export const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;

export function extractLinks(text: string) {
  return text.match(URL_PATTERN) ?? [];
}

export async function fetchReactions(roomId: string) {
  const { data, error } = await supabase
    .from("message_reactions")
    .select("*, messages!inner(room_id)")
    .eq("messages.room_id", roomId);
  if (error) throw error;
  return (data ?? []) as unknown as ReactionRow[];
}

export async function fetchReceipts(roomId: string) {
  const { data, error } = await supabase.from("read_receipts").select("*").eq("room_id", roomId);
  if (error) throw error;
  return (data ?? []) as ReceiptRow[];
}

export async function markRead(roomId: string, userId: string) {
  await supabase
    .from("read_receipts")
    .upsert(
      { room_id: roomId, user_id: userId, last_read_at: new Date().toISOString() },
      { onConflict: "room_id,user_id" },
    );
}

export function inviteUrl(token: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/join/${token}`;
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

export function lastSeenLabel(iso?: string | null) {
  if (!iso) return "offline";
  const then = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "last seen just now";
  if (mins < 60) return `last seen ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `last seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "last seen yesterday" : `last seen ${days}d ago`;
}
