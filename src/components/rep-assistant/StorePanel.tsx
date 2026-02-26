'use client';

import { useEffect, useState } from 'react';
import StoreChat from './StoreChat';
import PhotoCarousel from './PhotoCarousel';
import type { StorePin } from '@/app/api/stores/route';
import type { StoreDetail } from '@/app/api/stores/[id]/route';
import type { PlacesData } from '@/lib/places';
import type { SimilarStoresData } from '@/app/api/stores/[id]/similar/route';

const STATUS_COLORS: Record<string, string> = {
  open: '#9ca3af',
  warm: '#f97316',
  lead: '#3b82f6',
  sold: '#22c55e',
  reorder: '#a855f7',
  requested: '#eab308',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Cold',
  warm: 'Warm Lead',
  lead: 'Active Lead',
  sold: 'Customer',
  reorder: 'Reorder',
  requested: 'Requested',
};

const STORE_TYPE_ICONS: Record<string, string> = {
  convenience: '🏪',
  gas: '⛽',
  tobacco_smoke: '🚬',
  liquor: '🍷',
  grocery: '🛒',
  foodservice: '🍽️',
  gym: '💪',
  other: '🏬',
};

const STORE_TYPE_LABELS: Record<string, string> = {
  convenience: 'Convenience Store',
  gas: 'Gas Station',
  tobacco_smoke: 'Tobacco / Smoke Shop',
  liquor: 'Liquor Store',
  grocery: 'Grocery Store',
  foodservice: 'Foodservice',
  gym: 'Gym / Fitness',
  other: 'Retail Store',
};

function Skeleton({ w = '100%', h = 16, radius = 6 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease-in-out infinite',
    }} />
  );
}

function StarRating({ rating, count }: { rating: number; count: number }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ color: '#f59e0b', fontSize: 14 }}>
        {'★'.repeat(full)}{half ? '½' : ''}{'☆'.repeat(empty)}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{rating.toFixed(1)}</span>
      <span style={{ fontSize: 12, color: '#6b7280' }}>({count.toLocaleString()})</span>
    </div>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#9ca3af',
        letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

interface Props {
  store: StorePin;
  onClose: () => void;
}

type PanelTab = 'info' | 'chat';

export default function StorePanel({ store, onClose }: Props) {
  const [tab, setTab] = useState<PanelTab>('info');
  const [detail, setDetail] = useState<StoreDetail | null>(null);
  const [places, setPlaces] = useState<PlacesData | null>(null);
  const [similar, setSimilar] = useState<SimilarStoresData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [loadingPlaces, setLoadingPlaces] = useState(!!store.placeId);
  const [loadingSimilar, setLoadingSimilar] = useState(true);

  useEffect(() => {
    // Reset state on store change
    setDetail(null);
    setPlaces(null);
    setSimilar(null);
    setLoadingDetail(true);
    setLoadingPlaces(!!store.placeId);
    setLoadingSimilar(true);
    setTab('info');

    // Fetch all three in parallel
    const fetchAll = async () => {
      const [detailRes, placesRes, similarRes] = await Promise.allSettled([
        fetch(`/api/stores/${store.id}`).then(r => r.json()),
        store.placeId ? fetch(`/api/stores/${store.id}/places`).then(r => r.ok ? r.json() : null) : Promise.resolve(null),
        fetch(`/api/stores/${store.id}/similar`).then(r => r.json()),
      ]);

      if (detailRes.status === 'fulfilled') setDetail(detailRes.value);
      setLoadingDetail(false);

      if (placesRes.status === 'fulfilled') setPlaces(placesRes.value);
      setLoadingPlaces(false);

      if (similarRes.status === 'fulfilled') setSimilar(similarRes.value);
      setLoadingSimilar(false);
    };

    fetchAll();
  }, [store.id, store.placeId]);

  const statusColor = STATUS_COLORS[store.status] || '#9ca3af';
  const storeIcon = STORE_TYPE_ICONS[store.storeType || ''] || '🏬';
  const storeTypeLabel = STORE_TYPE_LABELS[store.storeType || ''] || 'Store';
  const hasOrders = detail?.stats.completedOrders ? detail.stats.completedOrders > 0 : false;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#fff', overflow: 'hidden',
    }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '1px solid #f0f0f0',
        background: '#fff',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: '#f3f4f6', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 20,
            }}>
              {storeIcon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 15, fontWeight: 700, color: '#111',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {store.company || 'Unknown Store'}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                {store.address}, {store.city}, {store.locality}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: `${statusColor}15`, color: statusColor,
                  fontSize: 11, fontWeight: 600, padding: '2px 8px',
                  borderRadius: 20, border: `1px solid ${statusColor}40`,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
                  {STATUS_LABELS[store.status] || store.status}
                </span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{storeTypeLabel}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: '50%', border: 'none',
              background: '#f3f4f6', cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: '#6b7280', fontFamily: 'inherit',
            }}
          >
            ×
          </button>
        </div>

        {/* Google Places quick stats */}
        {!loadingPlaces && places && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {places.rating && <StarRating rating={places.rating} count={places.userRatingCount || 0} />}
            {places.isOpenNow !== null && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                background: places.isOpenNow ? '#dcfce7' : '#fee2e2',
                color: places.isOpenNow ? '#16a34a' : '#dc2626',
              }}>
                {places.isOpenNow ? '● OPEN' : '● CLOSED'}
              </span>
            )}
            {places.priceLevel && (
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                {places.priceLevel === 'PRICE_LEVEL_INEXPENSIVE' ? '$'
                  : places.priceLevel === 'PRICE_LEVEL_MODERATE' ? '$$'
                  : places.priceLevel === 'PRICE_LEVEL_EXPENSIVE' ? '$$$'
                  : ''}
              </span>
            )}
          </div>
        )}
        {loadingPlaces && (
          <div style={{ marginTop: 8 }}>
            <Skeleton h={14} w="60%" />
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', borderBottom: '1px solid #f0f0f0',
        flexShrink: 0, background: '#fff',
      }}>
        {(['info', 'chat'] as PanelTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '10px 0', border: 'none', background: 'none',
              fontSize: 13, fontWeight: tab === t ? 700 : 400,
              color: tab === t ? '#229c62' : '#6b7280',
              borderBottom: tab === t ? '2px solid #229c62' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}
          >
            {t === 'info' ? '📋 Store Info' : '🤖 AI Chat'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: tab === 'info' ? 'auto' : 'hidden', minHeight: 0 }}>
        {tab === 'info' ? (
          <div style={{ padding: '0 0 24px' }}>

            {/* Photo carousel */}
            {!loadingPlaces && places?.photoNames && places.photoNames.length > 0 && (
              <PhotoCarousel
                photoNames={places.photoNames}
                storeName={store.company}
              />
            )}
            {/* Photo skeleton */}
            {loadingPlaces && (
              <div style={{ height: 150, marginBottom: 16, backgroundImage: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
            )}

            <div style={{ padding: '0 16px' }}>
            {/* Order history */}
            <Section title="Order History">
              {loadingDetail ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Skeleton h={14} />
                  <Skeleton h={14} w="70%" />
                </div>
              ) : !hasOrders ? (
                <div style={{
                  background: '#fffbeb', border: '1px solid #fde68a',
                  borderRadius: 8, padding: '10px 12px',
                  fontSize: 13, color: '#92400e',
                }}>
                  🧊 No purchases yet — this is a cold store. Use the AI Chat tab to get a pitch strategy.
                </div>
              ) : (
                <div>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12,
                  }}>
                    {[
                      { label: 'Total Orders', value: detail?.stats.completedOrders.toString() || '0' },
                      { label: 'Total Revenue', value: `$${(detail?.stats.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` },
                      { label: 'Avg Order', value: `$${(detail?.stats.avgOrderValue || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` },
                      { label: 'Last Order', value: detail?.stats.lastOrderDate ? new Date(detail.stats.lastOrderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—' },
                    ].map(stat => (
                      <div key={stat.label} style={{
                        background: '#f9fafb', borderRadius: 8, padding: '10px 12px',
                        border: '1px solid #f0f0f0',
                      }}>
                        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {stat.label}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginTop: 3 }}>
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Top products */}
                  {detail?.topProducts && detail.topProducts.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>
                        TOP PRODUCTS ORDERED
                      </div>
                      {detail.topProducts.slice(0, 6).map((p, i) => (
                        <div key={p.productId} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 0', borderBottom: i < Math.min(detail.topProducts.length, 6) - 1 ? '1px solid #f3f4f6' : 'none',
                        }}>
                          <span style={{ fontSize: 11, color: '#9ca3af', width: 16, flexShrink: 0 }}>
                            {i + 1}.
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.name}
                            </div>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>{p.brand}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
                              ${p.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </div>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>{p.totalQuantity} units</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Section>

            {/* Google Places */}
            {(loadingPlaces || places) && (
              <Section title="Google Places Intel">
                {loadingPlaces ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Skeleton h={14} />
                    <Skeleton h={14} w="80%" />
                    <Skeleton h={14} w="60%" />
                  </div>
                ) : places ? (
                  <div>
                    {/* Hours */}
                    {places.openingHours && places.openingHours.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 5 }}>HOURS</div>
                        {places.openingHours.map((h, i) => (
                          <div key={i} style={{ fontSize: 12, color: '#374151', lineHeight: 1.7 }}>{h}</div>
                        ))}
                      </div>
                    )}

                    {/* Phone / Website */}
                    {(places.phoneNumber || places.website) && (
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                        {places.phoneNumber && (
                          <a href={`tel:${places.phoneNumber}`} style={{
                            fontSize: 12, color: '#229c62', textDecoration: 'none',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            📞 {places.phoneNumber}
                          </a>
                        )}
                        {places.website && (
                          <a href={places.website} target="_blank" rel="noreferrer" style={{
                            fontSize: 12, color: '#229c62', textDecoration: 'none',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            🌐 Website ↗
                          </a>
                        )}
                      </div>
                    )}

                    {/* Google categories */}
                    {places.types && places.types.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                        {places.types.slice(0, 6).filter(t => !t.includes('establishment') && !t.includes('point_of_interest')).map(t => (
                          <span key={t} style={{
                            fontSize: 10, background: '#f3f4f6', color: '#6b7280',
                            padding: '2px 7px', borderRadius: 20, border: '1px solid #e5e7eb',
                          }}>
                            {t.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Reviews */}
                    {places.reviews && places.reviews.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>RECENT REVIEWS</div>
                        {places.reviews.slice(0, 3).map((r, i) => (
                          <div key={i} style={{
                            background: '#f9fafb', borderRadius: 8, padding: '8px 10px',
                            marginBottom: 6, border: '1px solid #f0f0f0',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ color: '#f59e0b', fontSize: 12 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                              <span style={{ fontSize: 10, color: '#9ca3af' }}>{r.relativeTime}</span>
                            </div>
                            <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.5 }}>
                              {r.text.length > 150 ? r.text.slice(0, 150) + '...' : r.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </Section>
            )}

            {/* Similar stores */}
            {(loadingSimilar || (similar && similar.products.length > 0)) && (
              <Section title={similar && similar.similarStoreCount > 0 ? `Nearby ${similar.storeType?.replace('_', ' ')} stores buy` : `Top sellers for ${similar?.storeType?.replace('_', ' ') || 'this store type'}`}>
                {loadingSimilar ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[1, 2, 3].map(i => <Skeleton key={i} h={14} />)}
                  </div>
                ) : similar ? (
                  <div>
                    {similar.similarStoreCount > 0 && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                        Based on {similar.similarStoreCount} similar stores within {similar.radiusMiles} miles:
                      </div>
                    )}
                    {similar.products.slice(0, 8).map((p, i) => (
                      <div key={p.productId} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '5px 0', borderBottom: i < similar.products.slice(0, 8).length - 1 ? '1px solid #f3f4f6' : 'none',
                      }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.name}
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.brand}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                          {p.storeCount > 1 && (
                            <div style={{ fontSize: 11, color: '#6b7280' }}>{p.storeCount} stores</div>
                          )}
                          <div style={{ fontSize: 11, color: '#229c62', fontWeight: 500 }}>
                            ${p.avgRevenuePerStore.toFixed(0)} avg
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </Section>
            )}

            </div> {/* end inner padding div */}
          </div>
        ) : (
          /* Chat tab */
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <StoreChat
              storeId={store.id}
              storeType={store.storeType}
              hasOrders={hasOrders}
              storeName={store.company}
            />
          </div>
        )}
      </div>
    </div>
  );
}
