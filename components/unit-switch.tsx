import type { Unit } from "@/lib/units";

export function UnitSwitch({ unit, onChange }: { unit: Unit; onChange: (unit: Unit) => void }) {
  return (
    <div
      role="group"
      aria-label="Weight unit"
      className="flex shrink-0 rounded-full border border-line bg-card p-1 text-sm font-medium"
    >
      {(["lb", "kg"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={unit === option}
          onClick={() => onChange(option)}
          className={`h-9 min-w-12 rounded-full px-3 touch-manipulation ${
            unit === option ? "bg-ink text-paper" : "text-muted"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
