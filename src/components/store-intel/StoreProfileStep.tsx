import {
  Store,
  Cigarette,
  Wine,
  ShoppingCart,
  Fuel,
  Utensils,
  Dumbbell,
  MoreHorizontal,
} from "lucide-react";
import type { StoreProfile, StoreType, StoreSize, PriceMix, BrandMix } from "@/lib/types";

const STORE_TYPES: { value: StoreType; label: string; icon: React.ElementType }[] = [
  { value: "convenience", label: "Convenience", icon: Store },
  { value: "tobacco_smoke", label: "Tobacco / Smoke", icon: Cigarette },
  { value: "liquor", label: "Liquor", icon: Wine },
  { value: "grocery", label: "Grocery", icon: ShoppingCart },
  { value: "gas", label: "Gas Station", icon: Fuel },
  { value: "foodservice", label: "Food Service", icon: Utensils },
  { value: "gym", label: "Gym", icon: Dumbbell },
  { value: "other", label: "Other", icon: MoreHorizontal },
];

const STORE_SIZES: { value: StoreSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "xlarge", label: "X-Large" },
];

const PRICE_MIXES: { value: PriceMix; label: string }[] = [
  { value: "budget", label: "Budget" },
  { value: "midrange", label: "Mid-Range" },
  { value: "premium", label: "Premium" },
];

const BRAND_MIXES: { value: BrandMix; label: string }[] = [
  { value: "commodities", label: "Commodities" },
  { value: "mixed", label: "Mixed" },
  { value: "premium", label: "Premium" },
];

interface StoreProfileStepProps {
  value: StoreProfile;
  onChange: (profile: StoreProfile) => void;
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex bg-[var(--bg)] rounded-lg p-0.5 border border-[var(--border-subtle)]">
      {options.map((opt) => (
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
  );
}

export function StoreProfileStep({ value, onChange }: StoreProfileStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text)] mb-3">
          Store Type
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STORE_TYPES.map((type) => {
            const Icon = type.icon;
            const isActive = value.storeType === type.value;
            return (
              <button
                key={type.value}
                onClick={() => onChange({ ...value, storeType: type.value })}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                  isActive
                    ? "bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]"
                    : "bg-[var(--surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border)]"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{type.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--text)] mb-3">
          Store Size
        </h3>
        <SegmentedControl
          options={STORE_SIZES}
          value={value.storeSize}
          onChange={(v) => onChange({ ...value, storeSize: v })}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--text)] mb-3">
          Price Mix
        </h3>
        <SegmentedControl
          options={PRICE_MIXES}
          value={value.priceMix}
          onChange={(v) => onChange({ ...value, priceMix: v })}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--text)] mb-3">
          Brand Mix
        </h3>
        <SegmentedControl
          options={BRAND_MIXES}
          value={value.brandMix}
          onChange={(v) => onChange({ ...value, brandMix: v })}
        />
      </div>
    </div>
  );
}
