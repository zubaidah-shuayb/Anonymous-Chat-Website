import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEMES, type ThemeKey } from "@/lib/zeel";

export function ThemeChoice({
  value,
  onChange,
}: {
  value: ThemeKey;
  onChange: (theme: ThemeKey) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {THEMES.map((theme) => {
        const active = theme.key === value;
        return (
          <button
            key={theme.key}
            type="button"
            onClick={() => onChange(theme.key)}
            className={cn(
              "group relative overflow-hidden rounded-2xl border p-3 text-left transition-all",
              `theme-${theme.key}`,
              active
                ? "border-accent-1 shadow-accent"
                : "border-border hover:border-accent-1/60 hover:shadow-soft",
            )}
          >
            <span className="accent-gradient block h-10 w-full rounded-xl" />
            <span className="mt-2 flex items-center justify-between">
              <span className="text-sm font-medium">{theme.label}</span>
              {active ? <Check className="size-4 text-accent-1" /> : null}
            </span>
            <span className="text-xs text-muted-foreground">{theme.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
