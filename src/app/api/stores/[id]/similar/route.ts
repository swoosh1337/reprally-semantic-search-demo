import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export interface SimilarStoreProduct {
  productId: number;
  name: string;
  brand: string;
  category: string | null;
  media: string | null;
  storeCount: number;       // how many similar stores bought this
  totalQuantity: number;
  totalRevenue: number;
  avgRevenuePerStore: number;
}

export interface SimilarStoresData {
  storeType: string;
  radiusMiles: number;
  similarStoreCount: number;
  products: SimilarStoreProduct[];
}

// GET /api/stores/:id/similar
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const storeId = parseInt(id);

  if (isNaN(storeId)) {
    return NextResponse.json({ error: 'Invalid store ID' }, { status: 400 });
  }

  try {
    // Get this store's type and coordinates
    const [store] = await query<any>(`
      SELECT l.storeType, a.latitude, a.longitude
      FROM leads l
      JOIN addresses a ON a.id = l.addressId
      WHERE l.id = ?
      LIMIT 1
    `, [storeId]);

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const { storeType, latitude, longitude } = store;
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (!storeType || isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: 'Store has no type or location' }, { status: 422 });
    }

    // ~10 mile bounding box: 1 degree lat ≈ 69 miles, 1 degree lng ≈ 69*cos(lat) miles
    const latDelta = 10 / 69;
    const lngDelta = 10 / (69 * Math.cos((lat * Math.PI) / 180));

    // Find similar stores (same type, within ~10 miles, have completed orders, not this store)
    const similarStores = await query<any>(`
      SELECT DISTINCT l.id
      FROM leads l
      JOIN addresses a ON a.id = l.addressId
      JOIN orders o ON o.leadId = l.id AND o.status = 'complete'
      WHERE l.storeType = ?
        AND l.id != ?
        AND a.latitude BETWEEN ? AND ?
        AND a.longitude BETWEEN ? AND ?
    `, [
      storeType,
      storeId,
      lat - latDelta, lat + latDelta,
      lng - lngDelta, lng + lngDelta,
    ]);

    if (similarStores.length === 0) {
      // Fallback: statewide similar stores (use top products by store type nationally)
      const fallbackProducts = await query<any>(`
        SELECT
          p.id AS productId,
          p.name,
          b.name AS brand,
          p.category,
          p.mediaCDN AS media,
          COUNT(DISTINCT o.leadId) AS storeCount,
          SUM(op.quantity) AS totalQuantity,
          SUM(op.totalSaleMoney) AS totalRevenueCents
        FROM leads l
        JOIN orders o ON o.leadId = l.id AND o.status = 'complete'
        JOIN orderProducts op ON op.orderId = o.id
        JOIN productVariations pv ON pv.id = op.productVariationId
        JOIN products p ON p.id = pv.productId AND p.isArchived = 0
        JOIN brands b ON b.id = p.brandId
        WHERE l.storeType = ?
          AND op.totalSaleMoney > 0
        GROUP BY p.id, p.name, b.name, p.category, p.mediaCDN
        ORDER BY storeCount DESC, totalRevenueCents DESC
        LIMIT 15
      `, [storeType]);

      return NextResponse.json({
        storeType,
        radiusMiles: 0, // national fallback
        similarStoreCount: 0,
        fallback: true,
        products: fallbackProducts.map(p => ({
          productId: p.productId,
          name: p.name,
          brand: p.brand,
          category: p.category,
          media: p.media,
          storeCount: parseInt(p.storeCount || 0),
          totalQuantity: parseInt(p.totalQuantity || 0),
          totalRevenue: parseInt(p.totalRevenueCents || 0) / 100,
          avgRevenuePerStore: parseInt(p.storeCount || 1) > 0
            ? (parseInt(p.totalRevenueCents || 0) / 100) / parseInt(p.storeCount || 1)
            : 0,
        })),
      } satisfies SimilarStoresData & { fallback: boolean });
    }

    const similarIds = similarStores.map((s: any) => s.id);

    // Top products across those similar stores
    const products = await query<any>(`
      SELECT
        p.id AS productId,
        p.name,
        b.name AS brand,
        p.category,
        p.mediaCDN AS media,
        COUNT(DISTINCT o.leadId) AS storeCount,
        SUM(op.quantity) AS totalQuantity,
        SUM(op.totalSaleMoney) AS totalRevenueCents
      FROM orders o
      JOIN orderProducts op ON op.orderId = o.id
      JOIN productVariations pv ON pv.id = op.productVariationId
      JOIN products p ON p.id = pv.productId AND p.isArchived = 0
      JOIN brands b ON b.id = p.brandId
      WHERE o.leadId IN (${similarIds.map(() => '?').join(',')})
        AND o.status = 'complete'
        AND op.totalSaleMoney > 0
      GROUP BY p.id, p.name, b.name, p.category, p.mediaCDN
      ORDER BY storeCount DESC, totalRevenueCents DESC
      LIMIT 15
    `, similarIds);

    return NextResponse.json({
      storeType,
      radiusMiles: 10,
      similarStoreCount: similarStores.length,
      products: products.map(p => ({
        productId: p.productId,
        name: p.name,
        brand: p.brand,
        category: p.category,
        media: p.media,
        storeCount: parseInt(p.storeCount || 0),
        totalQuantity: parseInt(p.totalQuantity || 0),
        totalRevenue: parseInt(p.totalRevenueCents || 0) / 100,
        avgRevenuePerStore: parseInt(p.storeCount || 1) > 0
          ? (parseInt(p.totalRevenueCents || 0) / 100) / parseInt(p.storeCount || 1)
          : 0,
      })),
    } satisfies SimilarStoresData);
  } catch (err: any) {
    console.error('Similar stores API error:', err);
    return NextResponse.json({ error: 'Database error', detail: err.message }, { status: 500 });
  }
}
