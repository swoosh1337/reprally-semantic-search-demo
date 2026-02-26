'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
} from '@vis.gl/react-google-maps';
import type { StorePin } from '@/app/api/stores/route';

// Status → color
const STATUS_COLORS: Record<string, string> = {
  open: '#9ca3af',      // gray — cold
  warm: '#f97316',      // orange
  lead: '#3b82f6',      // blue
  sold: '#22c55e',      // green
  reorder: '#a855f7',   // purple
  requested: '#eab308', // yellow
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Cold',
  warm: 'Warm',
  lead: 'Lead',
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
  convenience: 'Convenience',
  gas: 'Gas Station',
  tobacco_smoke: 'Smoke Shop',
  liquor: 'Liquor Store',
  grocery: 'Grocery',
  foodservice: 'Foodservice',
  gym: 'Gym',
  other: 'Store',
};

// Default fallback if geolocation is denied/unavailable
const DEFAULT_CENTER = { lat: 29.76, lng: -95.37 }; // Houston (biggest store cluster)
const DEFAULT_ZOOM = 13;

const LIMIT_OPTIONS = [25, 50, 100, 250];

interface Props {
  onStoreSelect: (store: StorePin) => void;
  selectedStoreId: number | null;
  activeFilters: string[];
}

function MapPins({ onStoreSelect, selectedStoreId, activeFilters, limit }: Props & { limit: number }) {
  const map = useMap();
  const [stores, setStores] = useState<StorePin[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBoundsRef = useRef<string>('');

  const fetchStores = useCallback(async () => {
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;

    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    // include limit in key so changing limit forces a re-fetch
    const boundsKey = `${sw.lat().toFixed(4)},${sw.lng().toFixed(4)},${ne.lat().toFixed(4)},${ne.lng().toFixed(4)},${limit}`;

    if (boundsKey === lastBoundsRef.current) return;
    lastBoundsRef.current = boundsKey;

    setLoading(true);
    try {
      const statusParam = activeFilters.length > 0 ? `&status=${activeFilters.join(',')}` : '';
      const url = `/api/stores?swLat=${sw.lat()}&swLng=${sw.lng()}&neLat=${ne.lat()}&neLng=${ne.lng()}${statusParam}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch stores');
      const data = await res.json();
      setStores(data.stores || []);
    } catch (e) {
      console.error('Failed to load stores:', e);
    } finally {
      setLoading(false);
    }
  }, [map, activeFilters, limit]);

  // Debounced fetch on map move
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('bounds_changed', () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      fetchTimer.current = setTimeout(fetchStores, 400);
    });
    fetchTimer.current = setTimeout(fetchStores, 300);
    return () => {
      google.maps.event.removeListener(listener);
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
    };
  }, [map, fetchStores]);

  // Re-fetch when filters change
  useEffect(() => {
    lastBoundsRef.current = '';
    fetchStores();
  }, [activeFilters, fetchStores]);

  return (
    <>
      {loading && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '4px 14px',
          borderRadius: 20, fontSize: 12, zIndex: 10, pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}>
          Loading stores...
        </div>
      )}
      {!loading && stores.length > 0 && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.65)', color: '#fff', padding: '4px 14px',
          borderRadius: 20, fontSize: 12, zIndex: 10, pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}>
          {stores.length.toLocaleString()} stores in view
        </div>
      )}
      {stores.map(store => {
        const color = STATUS_COLORS[store.status] || '#9ca3af';
        const isSelected = store.id === selectedStoreId;
        const icon = STORE_TYPE_ICONS[store.storeType || ''] || '🏬';
        const name = store.company && store.company !== '<MISSING COMPANY>'
          ? store.company
          : (STORE_TYPE_LABELS[store.storeType || ''] || 'Store');
        const displayName = name.length > 20 ? name.slice(0, 18) + '…' : name;

        return (
          <AdvancedMarker
            key={store.id}
            position={{ lat: store.latitude, lng: store.longitude }}
            onClick={() => onStoreSelect(store)}
            zIndex={isSelected ? 100 : 1}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer',
              transform: isSelected ? 'scale(1.15)' : 'scale(1)',
              transition: 'transform 0.15s ease',
              transformOrigin: 'bottom center',
            }}>
              {/* Circle icon */}
              <div style={{
                width: isSelected ? 36 : 28,
                height: isSelected ? 36 : 28,
                borderRadius: '50%',
                background: color,
                border: `2px solid #fff`,
                boxShadow: isSelected
                  ? `0 0 0 2.5px ${color}, 0 3px 10px rgba(0,0,0,0.3)`
                  : '0 1px 5px rgba(0,0,0,0.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isSelected ? 17 : 14,
                transition: 'all 0.15s ease',
              }}>
                {icon}
              </div>
              {/* Name label — plain text like Google Maps POI labels */}
              <div style={{
                marginTop: 3,
                fontSize: 10.5,
                fontWeight: isSelected ? 700 : 600,
                color: isSelected ? '#111' : '#333',
                textShadow: '0 1px 2px #fff, 0 -1px 2px #fff, 1px 0 2px #fff, -1px 0 2px #fff',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.01em',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Roboto", sans-serif',
                lineHeight: 1.2,
                maxWidth: 90,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                pointerEvents: 'none',
              }}>
                {displayName}
              </div>
            </div>
          </AdvancedMarker>
        );
      })}
    </>
  );
}

// "Locate me" button — re-centers map on user's position
function LocateButton({ onLocate }: { onLocate: () => void }) {
  return (
    <button
      onClick={onLocate}
      title="Go to my location"
      style={{
        position: 'absolute', bottom: 120, right: 12, zIndex: 10,
        width: 40, height: 40, borderRadius: 8,
        background: '#fff', border: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
      }}
    >
      ◎
    </button>
  );
}

// Legend + filter
function MapLegend({ activeFilters, onToggleFilter, limit, onLimitChange }: {
  activeFilters: string[];
  onToggleFilter: (status: string) => void;
  limit: number;
  onLimitChange: (n: number) => void;
}) {
  const statuses = ['open', 'warm', 'lead', 'sold', 'reorder'];
  return (
    <div style={{
      position: 'absolute', bottom: 32, left: 12, zIndex: 10,
      background: 'rgba(255,255,255,0.96)', borderRadius: 10,
      padding: '10px 14px', boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      {/* Status filters */}
      <div style={{ fontSize: 10, fontWeight: 700, color: '#888', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Status
      </div>
      {statuses.map(status => {
        const active = activeFilters.length === 0 || activeFilters.includes(status);
        return (
          <div
            key={status}
            onClick={() => onToggleFilter(status)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              cursor: 'pointer', opacity: active ? 1 : 0.3,
              transition: 'opacity 0.15s',
            }}
          >
            <div style={{
              width: 11, height: 11, borderRadius: '50%',
              background: STATUS_COLORS[status], flexShrink: 0,
            }} />
            <span style={{ fontSize: 12, color: '#333' }}>{STATUS_LABELS[status]}</span>
          </div>
        );
      })}
      {activeFilters.length > 0 && (
        <div
          onClick={() => onToggleFilter('__clear__')}
          style={{ fontSize: 11, color: '#229c62', cursor: 'pointer', fontWeight: 600 }}
        >
          Clear
        </div>
      )}

      {/* Divider */}
      <div style={{ borderTop: '1px solid #f0f0f0', margin: '2px 0' }} />

      {/* Limit selector */}
      <div style={{ fontSize: 10, fontWeight: 700, color: '#888', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Show nearby
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {LIMIT_OPTIONS.map(n => (
          <button
            key={n}
            onClick={() => onLimitChange(n)}
            style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              border: `1.5px solid ${limit === n ? '#229c62' : '#e5e7eb'}`,
              background: limit === n ? '#229c62' : '#f9fafb',
              color: limit === n ? '#fff' : '#555',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.1s',
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function StoreMap({ onStoreSelect, selectedStoreId }: Props) {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [limit, setLimit] = useState(50);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const mapRef = useRef<google.maps.Map | null>(null);

  // Ask for geolocation on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setCenter(DEFAULT_CENTER);
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        // Permission denied or error — fall back to Houston
        setCenter(DEFAULT_CENTER);
        setLocating(false);
      },
      { timeout: 6000, maximumAge: 60000 }
    );
  }, []);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        mapRef.current?.setZoom(DEFAULT_ZOOM);
      },
      () => {},
      { timeout: 6000 }
    );
  }, []);

  const handleToggleFilter = useCallback((status: string) => {
    if (status === '__clear__') {
      setActiveFilters([]);
      return;
    }
    setActiveFilters(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  }, []);

  // Show a loading state until we know the center
  if (locating || !center) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#f3f4f6', gap: 10,
      }}>
        <div style={{ fontSize: 28 }}>📍</div>
        <div style={{ fontSize: 14, color: '#6b7280' }}>Getting your location...</div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>Allow location access for best experience</div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
        <Map
          mapId="rep-assistant-map"
          defaultCenter={center}
          defaultZoom={DEFAULT_ZOOM}
          gestureHandling="greedy"
          disableDefaultUI={false}
          style={{ width: '100%', height: '100%' }}
          onCameraChanged={(ev) => {
            // keep mapRef in sync so LocateButton can pan
            if (ev.map) mapRef.current = ev.map as unknown as google.maps.Map;
          }}
        >
          <MapPins
            onStoreSelect={onStoreSelect}
            selectedStoreId={selectedStoreId}
            activeFilters={activeFilters}
            limit={limit}
          />
        </Map>
        <MapLegend
          activeFilters={activeFilters}
          onToggleFilter={handleToggleFilter}
          limit={limit}
          onLimitChange={setLimit}
        />
        <LocateButton onLocate={handleLocate} />
      </APIProvider>
    </div>
  );
}
