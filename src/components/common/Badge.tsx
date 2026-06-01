interface BadgeProps {
  children: React.ReactNode;
  color?: string | null;
  variant?: "comment" | "todo" | "question" | "update" | "tag" | "feedback" | "default";
}

const VARIANT_CLASSES: Record<string, string> = {
  comment:  "bg-blue-900/40 text-blue-300",
  todo:     "bg-violet-900/40 text-violet-300",
  question: "bg-yellow-900/40 text-yellow-300",
  update:   "bg-emerald-900/40 text-emerald-300",
  tag:      "bg-pink-900/40 text-pink-300",
  feedback: "bg-amber-900/40 text-amber-300",
  default:  "bg-bg-active text-text-secondary",
};

const VARIANT_LABELS: Record<string, string> = {
  comment:  "Kommentar",
  todo:     "Todo",
  question: "Frage",
  update:   "Update",
  tag:      "Tag",
  feedback: "Feedback",
};

export function Badge({ children, color, variant = "default" }: BadgeProps) {
  const cls = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.default;
  const style = color && variant === "default" ? { background: `${color}22`, color } : {};
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}
      style={style}
    >
      {children}
    </span>
  );
}

export function CommentTypeBadge({ type }: { type: string }) {
  const label = VARIANT_LABELS[type] ?? type;
  const cls = VARIANT_CLASSES[type] ?? VARIANT_CLASSES.default;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}
