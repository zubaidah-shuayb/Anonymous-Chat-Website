import { useEffect, useState } from "react";
import { Check, FileText, Link2, LogOut, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AvatarOrb } from "@/components/zeel/avatar-orb";
import { ThemeChoice } from "@/components/zeel/theme-choice";
import { supabase } from "@/integrations/supabase/client";
import {
  extractLinks,
  fetchRoomLinks,
  fetchRoomMedia,
  inviteUrl,
  lastSeenLabel,
  type MediaFilter,
  type MessageRow,
  type Profile,
  type Room,
  type ThemeKey,
} from "@/lib/zeel";
import { cn } from "@/lib/utils";
import { formatBytes, kindOf, previewUrl } from "@/lib/media";

const TABS: { key: MediaFilter | "link"; label: string }[] = [
  { key: "image", label: "Media" },
  { key: "file", label: "Files" },
  { key: "link", label: "Links" },
];

function MediaThumb({ message, onOpen }: { message: MessageRow; onOpen: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!message.attachment_path) return;
    let active = true;
    void previewUrl(message.attachment_path).then((next) => {
      if (active) setUrl(next);
    });
    return () => {
      active = false;
    };
  }, [message.attachment_path]);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={message.attachment_name ?? "Open media"}
      className="relative aspect-square overflow-hidden rounded-xl bg-muted transition-transform active:scale-95"
    >
      {url ? <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
      {kindOf(message.attachment_type) === "video" ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Play className="size-5 fill-white text-white drop-shadow" />
        </span>
      ) : null}
    </button>
  );
}

function SharedPanel({
  roomId,
  open,
  onOpenMedia,
}: {
  roomId: string;
  open: boolean;
  onOpenMedia: (items: MessageRow[], index: number) => void;
}) {
  const [tab, setTab] = useState<MediaFilter | "link">("image");
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    const request =
      tab === "link"
        ? fetchRoomLinks(roomId)
        : fetchRoomMedia(roomId, tab === "image" ? "image" : "file");
    void request
      .then((data) => {
        if (active) setRows(data);
      })
      .catch(() => {
        if (active) setRows([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [roomId, tab, open]);

  const visuals = rows.filter((r) => ["image", "video"].includes(kindOf(r.attachment_type)));

  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Shared together
      </p>
      <div className="mb-3 flex gap-1 rounded-full bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              tab === t.key ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          Nothing shared here yet.
        </p>
      ) : tab === "image" ? (
        <div className="grid grid-cols-3 gap-1.5">
          {visuals.map((row, index) => (
            <MediaThumb key={row.id} message={row} onOpen={() => onOpenMedia(visuals, index)} />
          ))}
        </div>
      ) : tab === "file" ? (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card px-3 py-2 text-xs"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{row.attachment_name ?? "File"}</span>
              <span className="text-muted-foreground">{formatBytes(row.attachment_size)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-1.5">
          {rows.flatMap((row) =>
            extractLinks(row.body).map((href) => (
              <li key={`${row.id}-${href}`}>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block truncate rounded-2xl border border-border/70 bg-card px-3 py-2 text-xs text-accent-1 hover:bg-muted"
                >
                  {href}
                </a>
              </li>
            )),
          )}
        </ul>
      )}
    </div>
  );
}

export function ChatInfo({
  open,
  onOpenChange,
  room,
  me,
  partner,
  partnerOnline,
  messageCount,
  onThemeChange,
  onSignOut,
  onOpenMedia,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room;
  me: Profile | null;
  partner: Profile | null;
  partnerOnline: boolean;
  messageCount: number;
  onThemeChange: (theme: ThemeKey) => void;
  onSignOut: () => void;
  onOpenMedia: (items: MessageRow[], index: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState<string | null>(null);

  async function makeInvite() {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("rotate_invite", { p_room_id: room.id });
      if (error) throw error;
      const url = inviteUrl(String(data));
      setInvite(url);
      await navigator.clipboard.writeText(url);
      toast.success("Fresh invitation copied");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create an invitation");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="glass w-full gap-0 overflow-y-auto border-l-border/70 sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">{room.name}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-8">
          <div className="space-y-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              The two of you
            </p>
            {[me, partner].map((person, i) =>
              person ? (
                <div
                  key={person.id}
                  className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3"
                >
                  <AvatarOrb
                    name={person.display_name}
                    theme={person.theme as ThemeKey}
                    online={i === 1 ? partnerOnline : true}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {person.display_name}
                      {i === 0 ? " (you)" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {i === 0
                        ? "Signed in"
                        : partnerOnline
                          ? "Online"
                          : lastSeenLabel(person.last_seen_at)}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  key="empty"
                  className="rounded-2xl border border-dashed border-border p-3 text-sm text-muted-foreground"
                >
                  Waiting for the second person to join.
                </div>
              ),
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Your colour
            </p>
            <ThemeChoice value={(me?.theme as ThemeKey) ?? "rose"} onChange={onThemeChange} />
          </div>

          <SharedPanel roomId={room.id} open={open} onOpenMedia={onOpenMedia} />

          {!partner ? (
            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Invitation
              </p>
              <button
                type="button"
                onClick={() => void makeInvite()}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm hover:bg-muted disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                Create a fresh invitation
              </button>
              {invite ? (
                <p className="mt-2 rounded-2xl border border-border bg-card px-3 py-2 text-xs break-all text-muted-foreground">
                  {invite}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-2xl border border-border/70 bg-card p-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-2">
              <Check className="size-3.5 text-accent-1" /> {messageCount} messages loaded
            </p>
            <p className="mt-1.5 flex items-center gap-2">
              <Check className="size-3.5 text-accent-1" /> Only the two of you can read this room
            </p>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
