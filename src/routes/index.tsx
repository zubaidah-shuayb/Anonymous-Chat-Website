import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, KeyRound, LogIn, Lock, Sparkles, Zap } from "lucide-react";
import { AppearanceToggle, ZeelMark } from "@/components/zeel/brand";
import { useRoomRedirect } from "@/hooks/use-room-redirect";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZEEL — your little corner of the internet" },
      {
        name: "description",
        content:
          "A private, real-time messaging space for exactly two people. Invite-only, encrypted-by-permission, beautifully quiet.",
      },
      { property: "og:title", content: "ZEEL — your little corner of the internet" },
      {
        property: "og:description",
        content: "A private, real-time messaging space for exactly two people.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user } = useRoomRedirect(null);

  return (
    <main className="page-gradient relative min-h-dvh overflow-hidden">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <ZeelMark />
          <span className="font-display text-xl tracking-tight">ZEEL</span>
        </div>
        <AppearanceToggle />
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-5 pt-10 pb-20 text-center sm:pt-16">
        <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs text-muted-foreground">
          <Lock className="size-3" /> Invite-only · two people, no more
        </span>

        <h1 className="font-display mt-6 text-4xl leading-[1.05] tracking-tight sm:text-6xl">
          Your little corner
          <br />
          of the internet <span className="accent-text">✨</span>
        </h1>

        <p className="mt-5 max-w-md text-balance text-muted-foreground">
          ZEEL is a quiet, real-time space made for exactly two. Your words live in a private room
          only the two of you can open.
        </p>

        <div className="mt-9 flex w-full max-w-sm flex-col gap-3">
          <Link
            to="/create"
            className="accent-gradient group flex items-center justify-center gap-2 rounded-2xl px-5 py-4 font-semibold text-accent-on shadow-accent transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            Create account & space
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/signin"
            className="glass flex items-center justify-center gap-2 rounded-2xl px-5 py-4 font-medium shadow-soft transition-colors hover:bg-muted"
          >
            <LogIn className="size-4" />
            Sign in
          </Link>
          <Link
            to="/join"
            className="glass flex items-center justify-center gap-2 rounded-2xl px-5 py-4 font-medium shadow-soft transition-colors hover:bg-muted"
          >
            <KeyRound className="size-4" />
            Join private space
          </Link>
          {user ? (
            <Link to="/chat" className="text-xs text-muted-foreground hover:text-foreground">
              Already inside? Open your space →
            </Link>
          ) : null}
        </div>

        <ul className="mt-16 grid w-full gap-3 text-left sm:grid-cols-3">
          {[
            {
              icon: Lock,
              title: "Private by design",
              body: "Only two members. Everyone else is locked out at the database.",
            },
            {
              icon: Zap,
              title: "Real-time",
              body: "Typing, presence, reactions and read receipts, instantly.",
            },
            {
              icon: Sparkles,
              title: "Yours",
              body: "Each person picks their own colour identity, saved forever.",
            },
          ].map((item) => (
            <li key={item.title} className="glass rounded-3xl p-4 shadow-soft">
              <item.icon className="size-4 text-accent-1" />
              <p className="mt-2 text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
