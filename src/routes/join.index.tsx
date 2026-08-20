import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, KeyRound } from "lucide-react";
import { AppearanceToggle } from "@/components/zeel/brand";

export const Route = createFileRoute("/join/")({
  head: () => ({
    meta: [
      { title: "Join a private space — ZEEL" },
      {
        name: "description",
        content: "Have an invitation? Enter it here to join your private ZEEL space.",
      },
      { property: "og:title", content: "Join a private space — ZEEL" },
      {
        property: "og:description",
        content: "Enter your invitation to join a private ZEEL space.",
      },
    ],
  }),
  component: JoinIndex,
});

function JoinIndex() {
  const [value, setValue] = useState("");
  const navigate = useNavigate();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    const token = trimmed.includes("/join/")
      ? (trimmed.split("/join/")[1] ?? "").split(/[?#]/)[0]
      : trimmed;
    if (!token) return;
    void navigate({ to: "/join/$token", params: { token } });
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
      <div className="mx-auto w-full max-w-xl px-5">
        <form
          onSubmit={submit}
          className="glass animate-rise rounded-[2rem] p-6 shadow-float sm:p-8"
        >
          <KeyRound className="size-5 text-accent-1" />
          <h1 className="font-display mt-3 text-2xl tracking-tight">Join a private space</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste the invitation link you were sent.
          </p>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://…/join/abc123"
            className="mt-5 w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus:border-accent-1"
          />
          <button
            type="submit"
            className="accent-gradient mt-3 w-full rounded-2xl px-4 py-3.5 text-sm font-semibold text-accent-on shadow-accent"
          >
            Continue
          </button>
        </form>
      </div>
    </main>
  );
}
