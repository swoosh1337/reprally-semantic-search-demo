import type { StoreAssessment, Level } from "@/lib/types";

const LEVELS: { value: Level; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

interface QuickAssessmentStepProps {
  value: StoreAssessment;
  onChange: (assessment: StoreAssessment) => void;
}

function DotRating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[var(--text)]">{label}</span>
        <span className="text-xs text-[var(--text-muted)]">{value}/5</span>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center text-xs font-semibold ${
              n <= value
                ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                : "bg-[var(--bg)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThreeWayToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Level;
  onChange: (v: Level) => void;
}) {
  return (
    <div>
      <span className="text-sm font-medium text-[var(--text)] mb-2 block">
        {label}
      </span>
      <div className="flex bg-[var(--bg)] rounded-lg p-0.5 border border-[var(--border-subtle)]">
        {LEVELS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${
              value === opt.value
                ? "bg-[var(--surface)] text-[var(--accent)] shadow-[var(--shadow-sm)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function QuickAssessmentStep({
  value,
  onChange,
}: QuickAssessmentStepProps) {
  return (
    <div className="space-y-6">
      <DotRating
        label="Store Condition"
        value={value.condition}
        onChange={(v) => onChange({ ...value, condition: v })}
      />

      <DotRating
        label="Display Quality"
        value={value.displayQuality}
        onChange={(v) => onChange({ ...value, displayQuality: v })}
      />

      <ThreeWayToggle
        label="Stock Levels"
        value={value.stockLevels}
        onChange={(v) => onChange({ ...value, stockLevels: v })}
      />

      <ThreeWayToggle
        label="Foot Traffic"
        value={value.footTraffic}
        onChange={(v) => onChange({ ...value, footTraffic: v })}
      />

      <ThreeWayToggle
        label="Owner Engagement"
        value={value.ownerEngagement}
        onChange={(v) => onChange({ ...value, ownerEngagement: v })}
      />

      <div>
        <span className="text-sm font-medium text-[var(--text)] mb-2 block">
          Notes
        </span>
        <textarea
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          placeholder="Any observations about the store..."
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border-subtle)] text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors resize-none"
        />
      </div>
    </div>
  );
}
