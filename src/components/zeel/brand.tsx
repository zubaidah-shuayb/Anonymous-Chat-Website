import { Link } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { cn } from "@/lib/utils";

export function ZeelMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "accent-gradient inline-flex items-center justify-center rounded-2xl text-accent-on shadow-accent",
        className ?? "size-9",
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-1/2">
        <path
          d="M6 6h12L7 18h11"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function ZeelWordmark() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <ZeelMark />
      <span className="font-display text-xl tracking-tight">ZEEL</span>
    </Link>
  );
}

export function AppearanceToggle({ className }: { className?: string }) {
  const { dark, toggle } = useDarkMode();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "glass inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
