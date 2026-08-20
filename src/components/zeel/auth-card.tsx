import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function AuthCard({
  title,
  subtitle,
  returnPath,
  defaultMode = "signup",
}: {
  title: string;
  subtitle: string;
  returnPath?: string;
  defaultMode?: "signin" | "signup";
}) {
  const [mode, setMode] = useState<"signin" | "signup">(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.href },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="glass w-full rounded-[2rem] p-6 shadow-float sm:p-8">
      <h1 className="font-display text-2xl tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>

    

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        EMAIL & PASSWORD
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus:border-accent-1"
        />
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min. 8 characters)"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="w-full rounded-2xl border border-input bg-card px-4 py-3 pr-11 text-sm outline-none focus:border-accent-1"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <button
          type="submit"
          disabled={busy}
          className={cn(
            "accent-gradient flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-accent-on shadow-accent transition-transform",
            busy ? "opacity-70" : "hover:scale-[1.01] active:scale-[0.99]",
          )}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {mode === "signup" ? "Create my account" : "Sign in"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
      >
        {mode === "signup" ? "I already have an account" : "I need to create an account"}
      </button>
    </div>
  );
}
