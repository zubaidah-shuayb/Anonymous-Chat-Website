import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, Copy, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { AuthCard } from "@/components/zeel/auth-card";
import { AppearanceToggle, ZeelMark } from "@/components/zeel/brand";
import { ThemeChoice } from "@/components/zeel/theme-choice";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyRoom, inviteUrl, type ThemeKey } from "@/lib/zeel";

function backendMessage(error: unknown) {
  if (error && typeof error === "object") {
    const e = error as { message?: string; details?: string; hint?: string; code?: string };
    const parts = [e.message, e.details, e.hint].filter(Boolean);
    if (parts.length) return `${parts.join(" — ")}${e.code ? ` (${e.code})` : ""}`;
  }
  return error instanceof Error ? error.message : "Could not create the space";
}

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create your private space — ZEEL" },
      {
        name: "description",
        content: "Set up a private two-person space on ZEEL and invite the one person you want in.",
      },
      { property: "og:title", content: "Create your private space — ZEEL" },
      { property: "og:description", content: "Set up a private two-person space on ZEEL." },
    ],
  }),
  component: CreatePage,
});

function CreatePage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [roomName, setRoomName] = useState("Our Space");
  const [theme, setTheme] = useState<ThemeKey>("rose");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // An existing member never belongs in setup — send them to their room.
  useEffect(() => {
    if (loading || !user || token) return;
    let active = true;
    void fetchMyRoom(user.id)
      .then((room) => {
        if (active && room) void navigate({ to: "/chat", replace: true });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user, loading, token, navigate]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setBusy(true);
    setErrorText(null);
    try {
      const { data, error } = await supabase.rpc("create_private_space", {
        p_display_name: displayName.trim(),
        p_theme: theme,
        p_room_name: roomName.trim() || "Our Space",
      });
      if (error) throw error;
      const result = data as { room_id: string; token: string; existing?: boolean };
      if (!result?.token) throw new Error("The backend did not return an invitation token.");
      setToken(result.token);
    } catch (error) {
      const message = backendMessage(error);
      console.error("[ZEEL] create_private_space failed:", error);
      setErrorText(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!token) return;
    const url = inviteUrl(token);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Join me on ZEEL", url });
        return;
      }
    } catch {
      /* fall through to copy */
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Invitation link copied");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="page-gradient min-h-dvh">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-5 py-5">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </Link>
        <AppearanceToggle />
      </header>

      <div className="mx-auto w-full max-w-xl px-5 pb-16">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !user ? (
          <AuthCard
            title="First, a way back in"
            subtitle="Your account keeps this space yours across devices and sessions."
            returnPath="/create"
          />
        ) : token ? (
          <div className="glass animate-rise rounded-[2rem] p-6 text-center shadow-float sm:p-8">
            <ZeelMark className="mx-auto size-12" />
            <h1 className="font-display mt-4 text-2xl tracking-tight">Your space is ready</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Send this private invitation to the one person you want inside. It works once, then
              the door closes.
            </p>
            <p className="mt-5 rounded-2xl border border-border bg-card px-3 py-3 text-xs break-all text-muted-foreground">
              {inviteUrl(token)}
            </p>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="accent-gradient mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-accent-on shadow-accent"
            >
              {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
              {copied ? "Copied" : "Share invitation"}
            </button>
            <button
              type="button"
              onClick={() => void navigate({ to: "/chat" })}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-muted"
            >
              Enter our space
            </button>
          </div>
        ) : (
          <form
            onSubmit={create}
            className={`glass animate-rise rounded-[2rem] p-6 shadow-float sm:p-8 theme-${theme}`}
          >
            <ZeelMark className="size-11" />
            <h1 className="font-display mt-4 text-2xl tracking-tight">Make it yours</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose how you appear and the colour that will carry your voice.
            </p>

            <label className="mt-6 block text-xs font-medium text-muted-foreground">
              Your display name
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              required
              placeholder="e.g. Zara"
              className="mt-1.5 w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus:border-accent-1"
            />

            <label className="mt-4 block text-xs font-medium text-muted-foreground">
              Name of your space
            </label>
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              maxLength={40}
              className="mt-1.5 w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus:border-accent-1"
            />

            <p className="mt-5 mb-2 text-xs font-medium text-muted-foreground">Your colour</p>
            <ThemeChoice value={theme} onChange={setTheme} />

            {errorText ? (
              <p
                role="alert"
                className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs break-words text-destructive"
              >
                {errorText}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="accent-gradient mt-6 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold text-accent-on shadow-accent disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Create private space
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
