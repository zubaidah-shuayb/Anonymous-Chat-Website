import { cn } from "@/lib/utils";
import { initials, type ThemeKey } from "@/lib/zeel";

export function AvatarOrb({
  name,
  theme,
  online,
  className,
}: {
  name: string;
  theme: ThemeKey;
  online?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex", `theme-${theme}`)}>
      <span
        className={cn(
          "accent-gradient flex items-center justify-center rounded-2xl font-semibold text-accent-on shadow-accent",
          className ?? "size-10 text-sm",
        )}
      >
        {initials(name) || "·"}
      </span>
      {online !== undefined ? (
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-background",
            online ? "bg-emerald-500" : "bg-muted-foreground/50",
          )}
        />
      ) : null}
    </span>
  );
}
