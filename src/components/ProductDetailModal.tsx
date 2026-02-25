import { X, Package, Loader2, Lightbulb, MessageSquareQuote } from "lucide-react";
import type { SearchResult, StoreVisitData } from "@/lib/types";
import { useState, useEffect } from "react";

function similarityColor(s: number) {
  if (s >= 0.6) return "text-[var(--success)] bg-[var(--success-bg)]";
  if (s >= 0.45) return "text-[var(--warning)] bg-[var(--warning-bg)]";
  return "text-[var(--text-muted)] bg-[var(--bg)]";
}

// ---------------------------------------------------------------------------
// Sales Pitch Section (loaded async when storeData is provided)
// ---------------------------------------------------------------------------

function SalesPitchSection({
  product,
  storeData,
  groupContext,
}: {
  product: SearchResult;
  storeData: StoreVisitData;
  groupContext: string;
}) {
  const [loading, setLoading] = useState(true);
  const [pitch, setPitch] = useState<{ reasoning: string; salesPitch: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    setPitch(null);

    fetch("/api/product-pitch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: {
          name: product.name,
          brand: product.brandName,
          category: product.category,
          price: product.msrp || 0,
          margin: product.margin || 0,
        },
        storeData,
        groupContext,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then((data) => {
        setPitch({ reasoning: data.reasoning, salesPitch: data.salesPitch });
      })
      .catch((err) => {
        console.error("Pitch fetch failed:", err);
        setPitch({
          reasoning: "Could not generate reasoning.",
          salesPitch: "Could not generate sales pitch.",
        });
      })
      .finally(() => setLoading(false));
  }, [product.id, storeData, groupContext]);

  if (loading) {
    return (
      <div className="mt-5 flex items-center gap-2 py-4 justify-center">
        <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin" />
        <span className="text-xs text-[var(--text-muted)]">Generating sales pitch…</span>
      </div>
    );
  }

  if (!pitch) return null;

  return (
    <div className="mt-5 space-y-3">
      <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
        Sales Intelligence
      </p>

      {/* Reasoning */}
      <div className="rounded-xl p-3.5 bg-purple-50 border border-purple-200">
        <div className="flex items-start gap-2">
          <Lightbulb className="w-4 h-4 mt-0.5 shrink-0 text-purple-600" />
          <div>
            <p className="text-[10px] font-semibold text-purple-700 uppercase tracking-wider mb-1">
              Why This Product
            </p>
            <p className="text-sm text-purple-800 leading-relaxed">
              {pitch.reasoning}
            </p>
          </div>
        </div>
      </div>

      {/* Sales Pitch */}
      <div className="rounded-xl p-3.5 bg-blue-50 border border-blue-200">
        <div className="flex items-start gap-2">
          <MessageSquareQuote className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" />
          <div>
            <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider mb-1">
              Say This to the Owner
            </p>
            <p className="text-sm text-blue-800 leading-relaxed italic">
              &ldquo;{pitch.salesPitch}&rdquo;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProductDetailModal
// ---------------------------------------------------------------------------

interface ProductDetailModalProps {
  product: SearchResult | null;
  onClose: () => void;
  /** When provided, shows AI sales pitch section */
  storeData?: StoreVisitData;
  /** Group title/rationale for pitch context */
  groupContext?: string;
}

export function ProductDetailModal({
  product,
  onClose,
  storeData,
  groupContext,
}: ProductDetailModalProps) {
  if (!product) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 animate-fade-in" />

      {/* Modal */}
      <div
        className="relative bg-[var(--surface)] rounded-2xl shadow-[var(--shadow-lg)] max-w-2xl w-full max-h-[85vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--bg)] hover:bg-[var(--border)] flex items-center justify-center transition-colors z-10"
        >
          <X className="w-4 h-4 text-[var(--text-muted)]" />
        </button>

        {/* Product image */}
        <div className="bg-[var(--bg)] rounded-t-2xl p-8 flex items-center justify-center min-h-[240px]">
          {product.media ? (
            <img
              src={product.media}
              alt={product.name}
              className="max-h-[220px] object-contain"
            />
          ) : (
            <Package className="w-16 h-16 text-[var(--text-muted)]" />
          )}
        </div>

        {/* Product info */}
        <div className="p-6">
          {/* Match badge */}
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${similarityColor(product.similarity)}`}
            >
              {(product.similarity * 100).toFixed(0)}% match
            </span>
            {product.category && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--accent-soft)] text-[var(--accent)]">
                {product.category}
              </span>
            )}
          </div>

          <h2 className="text-xl font-semibold text-[var(--text)]">
            {product.name}
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            by {product.brandName || "Unknown brand"}
          </p>

          {/* Tags */}
          {product.tags && (
            <div className="mt-4">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {product.tags.split(", ").map((tag, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded text-[11px] bg-[var(--bg)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sales Intelligence — only in shelf rec context */}
          {storeData && (
            <SalesPitchSection
              product={product}
              storeData={storeData}
              groupContext={groupContext || ""}
            />
          )}

          {/* Parsed product details from embedded document */}
          {product.document &&
            (() => {
              const lines = product.document.split("\n").filter(Boolean);
              const skipKeys = ["Product", "Brand", "Category", "Tags"];
              const details = lines
                .map((line) => {
                  const idx = line.indexOf(": ");
                  if (idx === -1) return null;
                  return {
                    label: line.slice(0, idx).trim(),
                    value: line.slice(idx + 2).trim(),
                  };
                })
                .filter(
                  (d): d is { label: string; value: string } =>
                    d !== null && !skipKeys.includes(d.label),
                );

              if (details.length === 0) return null;

              return (
                <div className="mt-5 space-y-3">
                  <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                    Product Details
                  </p>
                  {details.map((detail, i) => (
                    <div
                      key={i}
                      className="bg-[var(--bg)] rounded-lg p-3 border border-[var(--border-subtle)]"
                    >
                      <p className="text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wider mb-1">
                        {detail.label}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                        {detail.value}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })()}
        </div>
      </div>
    </div>
  );
}
