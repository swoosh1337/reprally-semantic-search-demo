import { Package, ChevronRight } from "lucide-react";
import type { SearchResult } from "@/lib/types";

function similarityColor(s: number) {
  if (s >= 0.6) return "text-[var(--success)] bg-[var(--success-bg)]";
  if (s >= 0.45) return "text-[var(--warning)] bg-[var(--warning-bg)]";
  return "text-[var(--text-muted)] bg-[var(--bg)]";
}

interface ProductCardProps {
  product: SearchResult;
  rank: number;
  animationDelay?: number;
  onClick: (product: SearchResult) => void;
}

export function ProductCard({
  product,
  rank,
  animationDelay = 0,
  onClick,
}: ProductCardProps) {
  return (
    <button
      onClick={() => onClick(product)}
      className="animate-slide-up bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 flex items-center gap-4 text-left hover:border-[var(--accent)] hover:shadow-[var(--shadow-md)] transition-all group cursor-pointer"
      style={{ animationDelay: `${animationDelay}ms`, opacity: 0 }}
    >
      {/* Rank */}
      <div className="w-7 h-7 rounded-full bg-[var(--bg)] flex items-center justify-center shrink-0">
        <span className="text-xs font-semibold text-[var(--text-muted)]">
          {rank}
        </span>
      </div>

      {/* Image */}
      {product.media ? (
        <img
          src={product.media}
          alt={product.name}
          className="w-14 h-14 rounded-lg object-contain bg-[var(--bg)]"
        />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-[var(--bg)] flex items-center justify-center">
          <Package className="w-5 h-5 text-[var(--text-muted)]" />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text)] truncate">
          {product.name}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          {product.brandName || "Unknown brand"}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {product.category && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--accent-soft)] text-[var(--accent)]">
              {product.category}
            </span>
          )}
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${similarityColor(product.similarity)}`}
          >
            {(product.similarity * 100).toFixed(0)}% match
          </span>
        </div>
      </div>

      {/* Price & Margin */}
      <div className="text-right shrink-0 hidden sm:block">
        {product.msrp ? (
          <>
            <p className="text-sm font-semibold text-[var(--text)]">
              ${product.msrp.toFixed(2)}
            </p>
            <p className="text-[10px] text-[var(--text-muted)]">MSRP</p>
            {product.margin != null && product.margin > 0 && (
              <p
                className={`text-[10px] font-medium mt-0.5 ${
                  product.margin >= 50
                    ? "text-[var(--success)]"
                    : product.margin >= 35
                      ? "text-amber-600"
                      : "text-[var(--text-muted)]"
                }`}
              >
                {product.margin}% margin
              </p>
            )}
          </>
        ) : null}
      </div>

      {/* Arrow */}
      <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors shrink-0" />
    </button>
  );
}
