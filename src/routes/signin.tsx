import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AuthCard } from "@/components/zeel/auth-card";
import { AppearanceToggle } from "@/components/zeel/brand";
import { useRoomRedirect } from "@/hooks/use-room-redirect";

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: "Sign in — ZEEL" },
      { name: "description", content: "Sign back into your private ZEEL space in one tap." },
      { property: "og:title", content: "Sign in — ZEEL" },
      { property: "og:description", content: "Sign back into your private ZEEL space." },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const { user, loading, resolving } = useRoomRedirect("/create");

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
        {loading || user || resolving ? (
          <div className="flex justify-center py-20">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <AuthCard
            title="Welcome back"
            subtitle="Sign in and we'll drop you straight back into your space."
            defaultMode="signin"
            returnPath="/signin"
          />
        )}
      </div>
    </main>
  );
}
