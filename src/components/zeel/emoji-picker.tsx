import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    emojis: [
      "😀",
      "😄",
      "😁",
      "😊",
      "🙂",
      "😉",
      "😍",
      "🥰",
      "😘",
      "😗",
      "😎",
      "🤩",
      "🥳",
      "🤗",
      "🤔",
      "🙃",
      "😴",
      "🥺",
      "😢",
      "😭",
      "😅",
      "😂",
      "🤣",
      "😇",
    ],
  },
  {
    label: "Hearts",
    emojis: [
      "❤️",
      "🩷",
      "💜",
      "💙",
      "🩵",
      "💚",
      "🧡",
      "💛",
      "🤍",
      "💖",
      "💗",
      "💓",
      "💞",
      "💕",
      "💘",
      "💌",
      "❣️",
      "💝",
    ],
  },
  {
    label: "Gestures",
    emojis: ["👍", "👎", "👏", "🙌", "🤝", "🙏", "✌️", "🤞", "👌", "🫶", "🤙", "💪", "👋", "🫂"],
  },
  {
    label: "Little things",
    emojis: [
      "✨",
      "🌙",
      "⭐",
      "🔥",
      "🌸",
      "🌷",
      "🌊",
      "☕",
      "🍕",
      "🍰",
      "🎂",
      "🎁",
      "🎧",
      "📷",
      "🚀",
      "🏡",
      "🐈",
      "🐶",
    ],
  },
];

export function EmojiPicker({
  children,
  onPick,
  align = "start",
}: {
  children: React.ReactNode;
  onPick: (emoji: string) => void;
  align?: "start" | "center" | "end";
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        className="zeel-scroll max-h-72 w-[19rem] overflow-y-auto rounded-3xl border-border/70 p-3 shadow-float"
      >
        {GROUPS.map((group) => (
          <div key={group.label} className="mb-2 last:mb-0">
            <p className="px-1 pb-1 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
              {group.label}
            </p>
            <div className="grid grid-cols-8 gap-0.5">
              {group.emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onPick(emoji)}
                  className="rounded-lg p-1 text-lg transition-transform hover:scale-125 hover:bg-muted"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
