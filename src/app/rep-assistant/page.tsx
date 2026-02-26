'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import StorePanel from '@/components/rep-assistant/StorePanel';
import type { StorePin } from '@/app/api/stores/route';

// Dynamic import to avoid SSR issues with Google Maps
const StoreMap = dynamic(() => import('@/components/rep-assistant/StoreMap'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f3f4f6', color: '#9ca3af', fontSize: 14,
    }}>
      Loading map...
    </div>
  ),
});

export default function RepAssistantPage() {
  const [selectedStore, setSelectedStore] = useState<StorePin | null>(null);

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 56px)', // subtract header height
      overflow: 'hidden',
      background: '#f9fafb',
    }}>
      {/* Map — takes full width, shrinks when panel is open */}
      <div style={{
        flex: 1,
        position: 'relative',
        transition: 'flex 0.3s ease',
        minWidth: 0,
      }}>
        <StoreMap
          onStoreSelect={(store) => setSelectedStore(store)}
          selectedStoreId={selectedStore?.id ?? null}
          activeFilters={[]}
        />
      </div>

      {/* Side panel — slides in when a store is selected */}
      <div style={{
        width: selectedStore ? 380 : 0,
        minWidth: selectedStore ? 380 : 0,
        transition: 'width 0.3s ease, min-width 0.3s ease',
        overflow: 'hidden',
        borderLeft: selectedStore ? '1px solid #e5e7eb' : 'none',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}>
        {selectedStore && (
          <StorePanel
            store={selectedStore}
            onClose={() => setSelectedStore(null)}
          />
        )}
      </div>
    </div>
  );
}
