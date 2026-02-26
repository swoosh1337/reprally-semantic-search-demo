'use client';

import { useEffect, useState } from 'react';
import { X, Package, Loader2, Lightbulb, MessageSquareQuote, TrendingUp, MapPin } from 'lucide-react';
import type { ProductCardData } from './ProductRecommendationCard';

interface SocialProof {
  nearbyStoreCount: number;
  nationalStoreCount: number;
  avgRevenueNearby: number;
  totalRevenueNational: number;
}

interface PitchData {
  reasoning: string;
  salesPitch: string;
  socialProof: SocialProof;
}

interface Props {
  product: ProductCardData | null;
  storeId: number;
  onClose: () => void;
}

// Parse the embedded document string from ChromaDB into key/value pairs
function parseDocument(doc: string | undefined): { label: string; value: string }[] {
  if (!doc) return [];
  const skipKeys = ['Product', 'Brand', 'Category', 'Tags'];
  return doc.split('\n')
    .filter(Boolean)
    .map(line => {
      const idx = line.indexOf(': ');
      if (idx === -1) return null;
      return { label: line.slice(0, idx).trim(), value: line.slice(idx + 2).trim() };
    })
    .filter((d): d is { label: string; value: string } => d !== null && !skipKeys.includes(d.label));
}

export default function RepProductModal({ product, storeId, onClose }: Props) {
  const [pitch, setPitch] = useState<PitchData | null>(null);
  const [loadingPitch, setLoadingPitch] = useState(false);

  useEffect(() => {
    if (!product) return;
    setPitch(null);
    setLoadingPitch(true);

    fetch('/api/rep-pitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId, product }),
    })
      .then(r => r.json())
      .then(data => setPitch(data))
      .catch(err => {
        console.error('pitch fetch failed:', err);
        setPitch({
          reasoning: 'Could not generate pitch at this time.',
          salesPitch: '',
          socialProof: { nearbyStoreCount: 0, nationalStoreCount: 0, avgRevenueNearby: 0, totalRevenueNational: 0 },
        });
      })
      .finally(() => setLoadingPitch(false));
  }, [product?.id, storeId]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!product) return null;

  const wholesaleDisplay = product.wholesalePrice
    ? `$${(product.wholesalePrice / 100).toFixed(2)}`
    : null;
  const msrpDisplay = product.msrp && product.msrp > 0
    ? `$${(product.msrp / 100).toFixed(2)}`
    : null;
  const marginPct = product.margin ? Math.round(product.margin * 100) : null;
  const details = parseDocument((product as any).document);

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 animate-fade-in" />

      {/* Modal */}
      <div
        className="relative bg-[var(--surface)] rounded-2xl shadow-[var(--shadow-lg)] max-w-lg w-full max-h-[88vh] overflow-y-auto animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--bg)] hover:bg-[var(--border)] flex items-center justify-center transition-colors z-10"
        >
          <X className="w-4 h-4 text-[var(--text-muted)]" />
        </button>

        {/* Product image */}
        <div className="bg-[var(--bg)] rounded-t-2xl p-8 flex items-center justify-center min-h-[200px]">
          {product.media ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.media}
              alt={product.name}
              className="max-h-[180px] object-contain"
            />
          ) : (
            <Package className="w-16 h-16 text-[var(--text-muted)]" />
          )}
        </div>

        <div className="p-6">
          {/* Category badge */}
          <div className="flex items-center gap-2 mb-3">
            {product.category && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--accent-soft)] text-[var(--accent)]">
                {product.category}
              </span>
            )}
            {marginPct !== null && (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${marginPct > 40 ? 'text-green-700 bg-green-50' : 'text-orange-700 bg-orange-50'}`}>
                {marginPct}% margin
              </span>
            )}
          </div>

          <h2 className="text-xl font-semibold text-[var(--text)]">{product.name}</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">by {product.brandName}</p>

          {/* Pricing row */}
          {(wholesaleDisplay || msrpDisplay) && (
            <div className="mt-4 flex gap-4">
              {wholesaleDisplay && (
                <div className="bg-[var(--bg)] rounded-lg px-4 py-2.5 border border-[var(--border-subtle)]">
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Wholesale</p>
                  <p className="text-lg font-bold text-[var(--text)]">{wholesaleDisplay}</p>
                </div>
              )}
              {msrpDisplay && (
                <div className="bg-[var(--bg)] rounded-lg px-4 py-2.5 border border-[var(--border-subtle)]">
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">MSRP</p>
                  <p className="text-lg font-bold text-[var(--text)]">{msrpDisplay}</p>
                </div>
              )}
            </div>
          )}

          {/* Sales pitch section */}
          <div className="mt-5">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">
              Pitch Intelligence
            </p>

            {loadingPitch ? (
              <div className="flex items-center gap-2 py-5 justify-center">
                <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin" />
                <span className="text-xs text-[var(--text-muted)]">Generating pitch for this store…</span>
              </div>
            ) : pitch ? (
              <div className="space-y-3">
                {/* Social proof banner — show if we have data */}
                {(pitch.socialProof.nearbyStoreCount > 0 || pitch.socialProof.nationalStoreCount > 0) && (
                  <div className="rounded-xl p-3 bg-emerald-50 border border-emerald-200 flex flex-wrap gap-3">
                    {pitch.socialProof.nearbyStoreCount > 0 && (
                      <div className="flex items-center gap-1.5 text-emerald-700">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-xs font-semibold">
                          {pitch.socialProof.nearbyStoreCount} nearby stores carry this
                          {pitch.socialProof.avgRevenueNearby > 0 && ` · avg $${pitch.socialProof.avgRevenueNearby.toFixed(0)}/order`}
                        </span>
                      </div>
                    )}
                    {pitch.socialProof.nationalStoreCount > 0 && (
                      <div className="flex items-center gap-1.5 text-emerald-700">
                        <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-xs font-semibold">
                          {pitch.socialProof.nationalStoreCount} stores nationally
                          {pitch.socialProof.totalRevenueNational > 0 && ` · $${pitch.socialProof.totalRevenueNational.toLocaleString('en-US', { maximumFractionDigits: 0 })} total revenue`}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Why this product */}
                {pitch.reasoning && (
                  <div className="rounded-xl p-3.5 bg-purple-50 border border-purple-200">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 mt-0.5 shrink-0 text-purple-600" />
                      <div>
                        <p className="text-[10px] font-semibold text-purple-700 uppercase tracking-wider mb-1">
                          Why This Product
                        </p>
                        <p className="text-sm text-purple-800 leading-relaxed">{pitch.reasoning}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Say this */}
                {pitch.salesPitch && (
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
                )}
              </div>
            ) : null}
          </div>

          {/* Product details from embedded doc */}
          {details.length > 0 && (
            <div className="mt-5 space-y-3">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                Product Details
              </p>
              {details.map((d, i) => (
                <div key={i} className="bg-[var(--bg)] rounded-lg p-3 border border-[var(--border-subtle)]">
                  <p className="text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wider mb-1">
                    {d.label}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{d.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
