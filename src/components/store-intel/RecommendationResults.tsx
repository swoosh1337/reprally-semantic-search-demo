import { Sparkles, Loader2, Check, Brain, Search, ListOrdered, ScanEye, Store, Camera } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import type { RecommendationGroup, SearchResult, ShelfAnalysis, StoreVisitData } from "@/lib/types";
import { useState, useEffect } from "react";

// ---------------------------------------------------------------------------
// Multi-step loading progress
// ---------------------------------------------------------------------------

const PROFILE_STEPS = [
  { icon: Brain, text: "Analyzing store profile..." },
  { icon: Sparkles, text: "Generating search queries..." },
  { icon: Search, text: "Searching 2,461 products..." },
  { icon: ListOrdered, text: "Ranking best matches..." },
];

const SHELF_STEPS = [
  { icon: ScanEye, text: "Analyzing shelf photos..." },
  { icon: Brain, text: "Identifying products & gaps..." },
  { icon: Search, text: "Searching product catalog..." },
  { icon: ListOrdered, text: "Ranking recommendations..." },
];

function LoadingProgress({ isShelf }: { isShelf: boolean }) {
  const steps = isShelf ? SHELF_STEPS : PROFILE_STEPS;
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 3000);
    return () => clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] p-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin" />
        <span className="text-sm font-semibold text-[var(--text)]">
          {isShelf ? "Analyzing Shelves" : "Finding Recommendations"}
        </span>
      </div>
      <div className="space-y-2.5">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isDone = i < activeStep;
          const isActive = i === activeStep;

          return (
            <div
              key={i}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-500 ${
                isActive
                  ? "bg-[var(--accent-soft)]"
                  : isDone
                    ? "opacity-60"
                    : "opacity-30"
              }`}
            >
              {isDone ? (
                <div className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </div>
              ) : (
                <Icon
                  className={`w-5 h-5 shrink-0 ${
                    isActive
                      ? "text-[var(--accent)] animate-pulse"
                      : "text-[var(--text-muted)]"
                  }`}
                />
              )}
              <span
                className={`text-sm ${
                  isActive
                    ? "text-[var(--text)] font-medium"
                    : isDone
                      ? "text-[var(--text-muted)] line-through"
                      : "text-[var(--text-muted)]"
                }`}
              >
                {step.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecommendationResults
// ---------------------------------------------------------------------------

interface RecommendationResultsProps {
  groups: RecommendationGroup[];
  shelfAnalysis?: ShelfAnalysis | null;
  loading?: boolean;
  label?: string;
  /** Store data for product-level sales pitch in modal */
  storeData?: StoreVisitData;
}

export function RecommendationResults({
  groups,
  shelfAnalysis,
  loading,
  label = "Recommendations",
  storeData,
}: RecommendationResultsProps) {
  const [selectedProduct, setSelectedProduct] = useState<SearchResult | null>(null);
  const [selectedGroupContext, setSelectedGroupContext] = useState<string>("");
  const isShelf = label.toLowerCase().includes("shelf");

  const handleProductClick = (product: SearchResult, groupContext: string) => {
    setSelectedProduct(product);
    setSelectedGroupContext(groupContext);
  };

  if (loading) {
    return <LoadingProgress isShelf={isShelf} />;
  }

  if (groups.length === 0) return null;

  const SectionIcon = isShelf ? Camera : Store;

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-2.5 pb-2 border-b border-[var(--border)]">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isShelf
            ? "bg-blue-100 text-blue-600"
            : "bg-purple-100 text-purple-600"
        }`}>
          <SectionIcon className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--text)]">{label}</h3>
          <p className="text-xs text-[var(--text-muted)]">
            {isShelf
              ? `${groups.length} recommendation ${groups.length === 1 ? "group" : "groups"} based on shelf photos`
              : `${groups.length} recommendation ${groups.length === 1 ? "group" : "groups"} based on store profile`}
          </p>
        </div>
      </div>

      {/* Shelf Analysis Summary */}
      {shelfAnalysis && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 animate-fade-in">
          <h4 className="text-sm font-semibold text-blue-800 mb-2">
            Shelf Analysis
          </h4>
          <p className="text-xs text-blue-700 mb-3">
            {shelfAnalysis.overallAssessment}
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            {shelfAnalysis.productsIdentified.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-1">
                  Products Found
                </p>
                <div className="flex flex-wrap gap-1">
                  {shelfAnalysis.productsIdentified.map((p, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {shelfAnalysis.gaps.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1">
                  Gaps Identified
                </p>
                <div className="flex flex-wrap gap-1">
                  {shelfAnalysis.gaps.map((g, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {shelfAnalysis.opportunities.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-1">
                  Opportunities
                </p>
                <div className="flex flex-wrap gap-1">
                  {shelfAnalysis.opportunities.map((o, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-[10px] bg-green-100 text-green-700"
                    >
                      {o}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recommendation Groups */}
      {groups.map((group, gi) => (
        <div key={gi} className="animate-fade-in">
          <div className="flex items-start gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-[var(--text)]">
                {group.title}
              </h4>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {group.rationale}
              </p>
            </div>
          </div>
          <div className="grid gap-2">
            {group.products.map((product, pi) => (
              <ProductCard
                key={product.id}
                product={product}
                rank={pi + 1}
                animationDelay={pi * 30}
                onClick={(p) => handleProductClick(p, `${group.title}: ${group.rationale}`)}
              />
            ))}
          </div>
        </div>
      ))}

      <ProductDetailModal
        product={selectedProduct}
        onClose={() => { setSelectedProduct(null); setSelectedGroupContext(""); }}
        storeData={isShelf ? storeData : undefined}
        groupContext={isShelf ? selectedGroupContext : undefined}
      />
    </div>
  );
}
