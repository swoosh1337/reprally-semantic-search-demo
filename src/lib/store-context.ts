import type { StoreDetail } from '@/app/api/stores/[id]/route';
import type { PlacesData } from './places';
import type { SimilarStoresData } from '@/app/api/stores/[id]/similar/route';

const STATUS_LABELS: Record<string, string> = {
  open: 'Cold (no orders yet)',
  warm: 'Warm lead (visited, not ordered)',
  lead: 'Active lead',
  sold: 'Customer (has ordered)',
  reorder: 'Repeat customer',
  requested: 'Requested contact',
};

const STORE_TYPE_LABELS: Record<string, string> = {
  convenience: 'Convenience store',
  gas: 'Gas station / C-store',
  tobacco_smoke: 'Tobacco / Smoke shop',
  liquor: 'Liquor store',
  grocery: 'Grocery store',
  foodservice: 'Foodservice / Restaurant',
  gym: 'Gym / Fitness',
  other: 'Retail store',
};

const PRICE_MIX_LABELS: Record<string, string> = {
  budget: 'Budget-focused (price-sensitive customers)',
  midrange: 'Mid-range pricing',
  premium: 'Premium / upscale pricing',
};

const BRAND_MIX_LABELS: Record<string, string> = {
  commodities: 'Commodity brands (value-focused)',
  mixed: 'Mixed brand portfolio',
  premium: 'Premium / boutique brands',
};

export function buildStoreContext(
  store: StoreDetail,
  places: PlacesData | null,
  similar: SimilarStoresData | null
): string {
  const lines: string[] = [];

  // === STORE IDENTITY ===
  lines.push('## STORE INFORMATION');
  lines.push(`Name: ${store.company || 'Unknown'}`);
  lines.push(`Address: ${store.address}, ${store.city}, ${store.locality} ${store.zipCode}`);
  lines.push(`Type: ${STORE_TYPE_LABELS[store.storeType || ''] || store.storeType || 'Unknown'}`);
  lines.push(`CRM Status: ${STATUS_LABELS[store.status] || store.status}`);
  if (store.storeSize) lines.push(`Size: ${store.storeSize}`);
  if (store.priceMix) lines.push(`Price positioning: ${PRICE_MIX_LABELS[store.priceMix] || store.priceMix}`);
  if (store.brandMix) lines.push(`Brand mix: ${BRAND_MIX_LABELS[store.brandMix] || store.brandMix}`);

  // === GOOGLE PLACES DATA ===
  if (places) {
    lines.push('\n## GOOGLE PLACES DATA');
    if (places.rating !== null) {
      lines.push(`Google rating: ${places.rating}/5 (${places.userRatingCount?.toLocaleString() || 0} reviews)`);
    }
    if (places.isOpenNow !== null) {
      lines.push(`Currently: ${places.isOpenNow ? 'OPEN' : 'CLOSED'}`);
    }
    if (places.openingHours && places.openingHours.length > 0) {
      lines.push('Hours:');
      places.openingHours.forEach(h => lines.push(`  ${h}`));
    }
    if (places.priceLevel) {
      const priceLevelMap: Record<string, string> = {
        PRICE_LEVEL_FREE: 'Free',
        PRICE_LEVEL_INEXPENSIVE: '$ (Inexpensive)',
        PRICE_LEVEL_MODERATE: '$$ (Moderate)',
        PRICE_LEVEL_EXPENSIVE: '$$$ (Expensive)',
        PRICE_LEVEL_VERY_EXPENSIVE: '$$$$ (Very expensive)',
      };
      lines.push(`Price level: ${priceLevelMap[places.priceLevel] || places.priceLevel}`);
    }
    if (places.phoneNumber) lines.push(`Phone: ${places.phoneNumber}`);
    if (places.types && places.types.length > 0) {
      lines.push(`Google categories: ${places.types.slice(0, 5).join(', ')}`);
    }
    if (places.reviews && places.reviews.length > 0) {
      lines.push('\nCustomer reviews (excerpts):');
      places.reviews.slice(0, 3).forEach(r => {
        const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
        const excerpt = r.text.length > 200 ? r.text.slice(0, 200) + '...' : r.text;
        lines.push(`  ${stars} "${excerpt}" — ${r.relativeTime}`);
      });
    }
  }

  // === ORDER HISTORY ===
  lines.push('\n## ORDER HISTORY WITH REPRALLY');
  if (store.stats.completedOrders === 0) {
    lines.push('This is a COLD STORE — no purchase history with RepRally yet.');
    lines.push('This is the rep\'s opportunity to convert them to a customer.');
  } else {
    lines.push(`Total completed orders: ${store.stats.completedOrders}`);
    lines.push(`Total revenue: $${store.stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    lines.push(`Average order value: $${store.stats.avgOrderValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    if (store.stats.firstOrderDate) {
      lines.push(`First order: ${new Date(store.stats.firstOrderDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    }
    if (store.stats.lastOrderDate) {
      lines.push(`Last order: ${new Date(store.stats.lastOrderDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    }
  }

  if (store.topProducts && store.topProducts.length > 0) {
    lines.push('\nTop products ordered from RepRally:');
    store.topProducts.slice(0, 8).forEach((p, i) => {
      lines.push(`  ${i + 1}. ${p.name} (${p.brand}) — $${p.totalRevenue.toFixed(2)} total, ${p.totalQuantity} units`);
    });
  }

  // === SIMILAR STORE INTELLIGENCE ===
  if (similar && similar.products && similar.products.length > 0) {
    lines.push('\n## NEARBY SIMILAR STORE INTELLIGENCE');
    const storeTypeLabel = STORE_TYPE_LABELS[similar.storeType] || similar.storeType;
    if (similar.similarStoreCount > 0) {
      lines.push(`${similar.similarStoreCount} nearby ${storeTypeLabel} stores (within ${similar.radiusMiles} miles) buy these products most:`);
    } else {
      lines.push(`Top products sold to ${storeTypeLabel} stores nationally on RepRally:`);
    }
    similar.products.slice(0, 10).forEach((p, i) => {
      lines.push(`  ${i + 1}. ${p.name} (${p.brand})${p.storeCount > 1 ? ` — sold in ${p.storeCount} similar stores` : ''}, avg $${p.avgRevenuePerStore.toFixed(0)}/store`);
    });
  }

  // === INSTRUCTIONS FOR AI ===
  lines.push('\n## YOUR ROLE');
  lines.push('You are an AI sales assistant helping a RepRally sales rep prepare for or follow up on a store visit.');
  lines.push('You have access to the store context above. Use it to give specific, actionable advice.');
  lines.push('When recommending products, be specific about WHY they fit this store (type, rating, reviews, what nearby stores buy).');
  lines.push('Keep responses concise and practical — the rep may be standing outside the store right now.');
  lines.push('If you need to search for specific products, say so and the system will run a vector search.');
  lines.push('Format product recommendations as a numbered list with product name, brand, and a one-line pitch.');

  return lines.join('\n');
}
