import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, HeartCrack, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthCard } from "@/components/zeel/auth-card";
import { AppearanceToggle, ZeelMark } from "@/components/zeel/brand";
import { ThemeChoice } from "@/components/zeel/theme-choice";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import type { ThemeKey } from "@/lib/zeel";

export const Route = createFileRoute("/join/$token")({
  head: () => ({
    meta: [
      { title: "You're invited — ZEEL" },
      { name: "description", content: "Accept a private invitation and join a two-person space." },
      { property: "og:title", content: "You're invited — ZEEL" },
      { property: "og:description", content: "Accept a private invitation on ZEEL." },
    ],
  }),
  component: JoinToken,
});

type Preview =
  { valid: true; room_name: string; host_name: string } | { valid: false; reason: string };

function JoinToken() {
  const { token } = Route.useParams();
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [theme, setTheme] = useState<ThemeKey>("azure");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void supabase.rpc("invite_preview", { p_token: token }).then(({ data, error }) => {
      if (!active) return;
      if (error) setPreview({ valid: false, reason: "error" });
      else setPreview(data as unknown as Preview);
    });
    return () => {
      active = false;
    };
  }, [token, user]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("join_private_space", {
        p_token: token,
        p_display_name: displayName.trim(),
        p_theme: theme,
      });
      if (error) throw error;
      void navigate({ to: "/chat", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not join this space");
      setBusy(false);
    }
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
            title="You've been invited ✨"
            subtitle="Create a quick account so this space remembers you next time."
            returnPath={`/join/${token}`}
          />
        ) : !preview ? (
          <div className="flex justify-center py-20">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !preview.valid ? (
          <div className="glass animate-rise rounded-[2rem] p-8 text-center shadow-float">
            <HeartCrack className="mx-auto size-6 text-muted-foreground" />
            <h1 className="font-display mt-3 text-xl">This invitation isn't open</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {preview.reason === "full"
                ? "That space already has both of its people."
                : preview.reason === "expired"
                  ? "The invitation has expired — ask for a fresh one."
                  : preview.reason === "used"
                    ? "This invitation has already been used."
                    : "We couldn't find that invitation."}
            </p>
            <Link
              to="/"
              className="mt-5 inline-flex rounded-2xl border border-border bg-card px-4 py-2.5 text-sm hover:bg-muted"
            >
              Back home
            </Link>
          </div>
        ) : (
          <form
            onSubmit={join}
            className={`glass animate-rise rounded-[2rem] p-6 shadow-float sm:p-8 theme-${theme}`}
          >
            <ZeelMark className="size-11" />
            <h1 className="font-display mt-4 text-2xl tracking-tight">
              {preview.host_name} invited you
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              You're joining “{preview.room_name}”. Just the two of you.
            </p>

            <label className="mt-6 block text-xs font-medium text-muted-foreground">
              Your display name
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              required
              placeholder="e.g. Leo"
              className="mt-1.5 w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus:border-accent-1"
            />

            <p className="mt-5 mb-2 text-xs font-medium text-muted-foreground">Your colour</p>
            <ThemeChoice value={theme} onChange={setTheme} />

            <button
              type="submit"
              disabled={busy}
              className="accent-gradient mt-6 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold text-accent-on shadow-accent disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Join the space
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
