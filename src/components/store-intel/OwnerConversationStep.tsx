import { X } from "lucide-react";
import type { OwnerConversation, ShelfSpace, Budget } from "@/lib/types";

const SHELF_SPACE: { value: ShelfSpace; label: string; desc: string }[] = [
  { value: "limited", label: "Limited", desc: "1-2 shelves" },
  { value: "moderate", label: "Moderate", desc: "3-5 shelves" },
  { value: "plenty", label: "Plenty", desc: "6+ shelves" },
];

const BUDGETS: { value: Budget; label: string }[] = [
  { value: "tight", label: "Tight" },
  { value: "moderate", label: "Moderate" },
  { value: "flexible", label: "Flexible" },
];

interface OwnerConversationStepProps {
  value: OwnerConversation;
  onChange: (conversation: OwnerConversation) => void;
  categories: string[];
}

export function OwnerConversationStep({
  value,
  onChange,
  categories,
}: OwnerConversationStepProps) {
  const toggleCategory = (cat: string) => {
    const current = value.categoriesOfInterest;
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    onChange({ ...value, categoriesOfInterest: next });
  };

  return (
    <div className="space-y-6">
      {/* Shelf Space */}
      <div>
        <span className="text-sm font-medium text-[var(--text)] mb-2 block">
          Available Shelf Space
        </span>
        <div className="flex bg-[var(--bg)] rounded-lg p-0.5 border border-[var(--border-subtle)]">
          {SHELF_SPACE.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ ...value, shelfSpace: opt.value })}
              className={`flex-1 px-3 py-2 rounded-md text-center transition-all ${
                value.shelfSpace === opt.value
                  ? "bg-[var(--surface)] shadow-[var(--shadow-sm)]"
                  : "hover:text-[var(--text)]"
              }`}
            >
              <span
                className={`text-xs font-medium block ${
                  value.shelfSpace === opt.value
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-muted)]"
                }`}
              >
                {opt.label}
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">
                {opt.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Categories of Interest */}
      <div>
        <span className="text-sm font-medium text-[var(--text)] mb-2 block">
          Categories of Interest
        </span>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => {
            const isSelected = value.categoriesOfInterest.includes(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  isSelected
                    ? "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]"
                    : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:border-[var(--border)]"
                }`}
              >
                {cat}
                {isSelected && <X className="w-3 h-3" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <span className="text-sm font-medium text-[var(--text)] mb-2 block">
          Price Range (per unit MSRP)
        </span>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 block">
              Min
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">
                $
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={value.priceRangeMin || ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    priceRangeMin: Number(e.target.value) || 0,
                  })
                }
                placeholder="0"
                className="w-full pl-7 pr-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border-subtle)] text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
          </div>
          <span className="text-[var(--text-muted)] mt-5">-</span>
          <div className="flex-1">
            <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 block">
              Max
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">
                $
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={value.priceRangeMax || ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    priceRangeMax: Number(e.target.value) || 0,
                  })
                }
                placeholder="50"
                className="w-full pl-7 pr-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border-subtle)] text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Budget */}
      <div>
        <span className="text-sm font-medium text-[var(--text)] mb-2 block">
          Total Order Budget
        </span>
        <div className="flex bg-[var(--bg)] rounded-lg p-0.5 border border-[var(--border-subtle)]">
          {BUDGETS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ ...value, budget: opt.value })}
              className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                value.budget === opt.value
                  ? "bg-[var(--surface)] text-[var(--accent)] shadow-[var(--shadow-sm)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Owner Comments */}
      <div>
        <span className="text-sm font-medium text-[var(--text)] mb-2 block">
          Owner&apos;s Comments
        </span>
        <textarea
          value={value.ownerComments}
          onChange={(e) =>
            onChange({ ...value, ownerComments: e.target.value })
          }
          placeholder="What did the owner say about their needs, challenges, what's selling well..."
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border-subtle)] text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors resize-none"
        />
      </div>
    </div>
  );
}
