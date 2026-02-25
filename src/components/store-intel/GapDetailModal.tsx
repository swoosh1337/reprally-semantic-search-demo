"use client";

import { X, Loader2, AlertTriangle, Lightbulb, MessageSquareQuote, Package } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import type { SearchResult, StoreVisitData } from "@/lib/types";
import { useState, useEffect } from "react";

interface GapDetailModalProps {
  label: string | null;
  type: "gap" | "opportunity";
  storeData: StoreVisitData;
  onClose: () => void;
}

interface GapData {
  reasoning: string;
  salesPitch: string;
  products: SearchResult[];
}

export function GapDetailModal({
  label,
  type,
  storeData,
  onClose,
}: GapDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<SearchResult | null>(null);

  useEffect(() => {
    if (!label) {
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    fetch("/api/gap-products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, type, storeData }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then((result) => {
        setData({
          reasoning: result.reasoning,
          salesPitch: result.salesPitch,
          products: result.products || [],
        });
      })
      .catch((err) => {
        setError(err.message || "Failed to load details");
      })
      .finally(() => setLoading(false));
  }, [label, type, storeData]);

  if (!label) return null;

  const isGap = type === "gap";
  const accentColor = isGap ? "amber" : "green";

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/40 animate-fade-in" />

        {/* Modal */}
        <div
          className="relative bg-[var(--surface)] rounded-t-2xl sm:rounded-2xl shadow-[var(--shadow-lg)] w-full sm:max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--bg)] hover:bg-[var(--border)] flex items-center justify-center transition-colors z-10"
          >
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>

          {/* Header */}
          <div className={`px-5 pt-5 pb-4 border-b border-[var(--border)]`}>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                  isGap
                    ? "bg-amber-100 text-amber-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {isGap ? "Gap" : "Opportunity"}
              </span>
            </div>
            <h3 className="text-base font-semibold text-[var(--text)] pr-8">
              {label}
            </h3>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin" />
                <p className="text-sm text-[var(--text-muted)]">
                  Finding products & generating pitch…
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="px-4 py-3 rounded-lg bg-[var(--error-bg)] text-[var(--error)] text-sm">
                {error}
              </div>
            )}

            {/* Results */}
            {data && !loading && (
              <>
                {/* Reasoning */}
                <div className={`rounded-xl p-4 ${
                  isGap
                    ? "bg-amber-50 border border-amber-200"
                    : "bg-green-50 border border-green-200"
                }`}>
                  <div className="flex items-start gap-2">
                    <Lightbulb className={`w-4 h-4 mt-0.5 shrink-0 ${
                      isGap ? "text-amber-600" : "text-green-600"
                    }`} />
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                        isGap ? "text-amber-700" : "text-green-700"
                      }`}>
                        Why This Matters
                      </p>
                      <p className={`text-sm leading-relaxed ${
                        isGap ? "text-amber-800" : "text-green-800"
                      }`}>
                        {data.reasoning}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sales Pitch */}
                <div className="rounded-xl p-4 bg-blue-50 border border-blue-200">
                  <div className="flex items-start gap-2">
                    <MessageSquareQuote className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" />
                    <div>
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">
                        Say This to the Owner
                      </p>
                      <p className="text-sm text-blue-800 leading-relaxed italic">
                        &ldquo;{data.salesPitch}&rdquo;
                      </p>
                    </div>
                  </div>
                </div>

                {/* Products */}
                {data.products.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                      Matching Products ({data.products.length})
                    </p>
                    <div className="grid gap-2">
                      {data.products.map((product, i) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          rank={i + 1}
                          animationDelay={i * 30}
                          onClick={setSelectedProduct}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {data.products.length === 0 && (
                  <div className="text-center py-4 text-sm text-[var(--text-muted)]">
                    No matching products found in catalog.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Nested product detail modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </>
  );
}
