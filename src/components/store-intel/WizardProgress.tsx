import { Check } from "lucide-react";

const STEPS = [
  { num: 1, label: "Store Profile" },
  { num: 2, label: "Assessment" },
  { num: 3, label: "Conversation" },
  { num: 4, label: "Scan Shelves" },
];

interface WizardProgressProps {
  currentStep: number;
}

export function WizardProgress({ currentStep }: WizardProgressProps) {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {STEPS.map((step, i) => {
        const isComplete = currentStep > step.num;
        const isActive = currentStep === step.num;

        return (
          <div key={step.num} className="flex items-center gap-1 sm:gap-2">
            {i > 0 && (
              <div
                className={`w-4 sm:w-8 h-px ${
                  isComplete ? "bg-[var(--accent)]" : "bg-[var(--border)]"
                }`}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                  isComplete
                    ? "bg-[var(--accent)] text-white"
                    : isActive
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--bg)] text-[var(--text-muted)] border border-[var(--border)]"
                }`}
              >
                {isComplete ? <Check className="w-3 h-3" /> : step.num}
              </div>
              <span
                className={`text-xs font-medium hidden sm:inline ${
                  isActive
                    ? "text-[var(--text)]"
                    : "text-[var(--text-muted)]"
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
