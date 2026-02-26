'use client';

import { useState } from 'react';
import Image from 'next/image';

export interface ProductCardData {
  id: number;
  name: string;
  brandName: string;
  category: string;
  media: string | null;
  wholesalePrice?: number;
  msrp?: number;
  margin?: number;
  similarity?: number;
  document?: string;
}

interface Props {
  product: ProductCardData;
  clickable?: boolean;
}

export default function ProductRecommendationCard({ product, clickable }: Props) {
  const [hovered, setHovered] = useState(false);

  const wholesaleDisplay = product.wholesalePrice
    ? `$${(product.wholesalePrice / 100).toFixed(2)}`
    : null;
  const marginDisplay = product.margin
    ? `${Math.round(product.margin * 100)}%`
    : null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: hovered && clickable ? '#f0fdf4' : '#f8fafb',
        border: `1px solid ${hovered && clickable ? '#86efac' : '#e5e7eb'}`,
        borderRadius: 8, padding: '8px 10px',
        marginBottom: 6, minWidth: 0,
        transition: 'background 0.15s, border-color 0.15s',
        position: 'relative',
      }}
    >
      {/* Image */}
      <div style={{
        width: 40, height: 40, borderRadius: 6, overflow: 'hidden',
        background: '#e5e7eb', flexShrink: 0, position: 'relative',
      }}>
        {product.media ? (
          <Image
            src={product.media}
            alt={product.name}
            fill
            style={{ objectFit: 'cover' }}
            unoptimized
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>
            📦
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: '#111',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {product.name}
        </div>
        <div style={{ fontSize: 11, color: '#6b7280' }}>
          {product.brandName} · {product.category}
        </div>
        {/* Tap hint on hover */}
        {clickable && hovered && (
          <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, marginTop: 2 }}>
            Tap for pitch →
          </div>
        )}
      </div>

      {/* Price + margin */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {wholesaleDisplay && (
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
            {wholesaleDisplay}
          </div>
        )}
        {marginDisplay && (
          <div style={{
            fontSize: 11,
            color: (product.margin || 0) > 0.4 ? '#22c55e' : '#f97316',
            fontWeight: 500,
          }}>
            {marginDisplay} margin
          </div>
        )}
      </div>
    </div>
  );
}
