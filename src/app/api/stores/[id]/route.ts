import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export interface StoreDetail {
  id: number;
  status: string;
  storeType: string | null;
  storeSize: string | null;
  priceMix: string | null;
  brandMix: string | null;
  company: string | null;
  address: string | null;
  city: string | null;
  locality: string | null;
  zipCode: string | null;
  latitude: number;
  longitude: number;
  placeId: string | null;
  stats: {
    totalOrders: number;
    completedOrders: number;
    totalRevenue: number;
    firstOrderDate: string | null;
    lastOrderDate: string | null;
    avgOrderValue: number;
  };
  topProducts: {
    productId: number;
    name: string;
    brand: string;
    category: string | null;
    media: string | null;
    totalQuantity: number;
    totalRevenue: number;
    orderCount: number;
  }[];
}

// GET /api/stores/:id
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
    // Core store info
    const [store] = await query<any>(`
      SELECT
        l.id, l.status, l.storeType, l.storeSize, l.priceMix, l.brandMix,
        a.company, a.address, a.city, a.locality, a.zipCode,
        a.latitude, a.longitude, a.placeId
      FROM leads l
      JOIN addresses a ON a.id = l.addressId
      WHERE l.id = ?
      LIMIT 1
    `, [storeId]);

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Order stats
    const [stats] = await query<any>(`
      SELECT
        COUNT(DISTINCT o.id) AS totalOrders,
        SUM(CASE WHEN o.status = 'complete' THEN 1 ELSE 0 END) AS completedOrders,
        COALESCE(SUM(CASE WHEN o.status = 'complete' THEN op.totalSaleMoney ELSE 0 END), 0) AS totalRevenueCents,
        MIN(CASE WHEN o.status = 'complete' THEN o.createdAt END) AS firstOrderDate,
        MAX(CASE WHEN o.status = 'complete' THEN o.createdAt END) AS lastOrderDate
      FROM orders o
      LEFT JOIN orderProducts op ON op.orderId = o.id
      WHERE o.leadId = ?
    `, [storeId]);

    // Top products
    const topProducts = await query<any>(`
      SELECT
        p.id AS productId,
        p.name,
        b.name AS brand,
        p.category,
        p.mediaCDN AS media,
        SUM(op.quantity) AS totalQuantity,
        SUM(op.totalSaleMoney) AS totalRevenueCents,
        COUNT(DISTINCT o.id) AS orderCount
      FROM orders o
      JOIN orderProducts op ON op.orderId = o.id
      JOIN productVariations pv ON pv.id = op.productVariationId
      JOIN products p ON p.id = pv.productId
      JOIN brands b ON b.id = p.brandId
      WHERE o.leadId = ?
        AND o.status = 'complete'
        AND op.totalSaleMoney > 0
      GROUP BY p.id, p.name, b.name, p.category, p.mediaCDN
      ORDER BY totalRevenueCents DESC
      LIMIT 10
    `, [storeId]);

    const completedOrders = parseInt(stats?.completedOrders || 0);
    const totalRevenue = parseInt(stats?.totalRevenueCents || 0) / 100;
    const avgOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;

    const result: StoreDetail = {
      id: store.id,
      status: store.status,
      storeType: store.storeType,
      storeSize: store.storeSize,
      priceMix: store.priceMix,
      brandMix: store.brandMix,
      company: store.company,
      address: store.address,
      city: store.city,
      locality: store.locality,
      zipCode: store.zipCode,
      latitude: parseFloat(store.latitude),
      longitude: parseFloat(store.longitude),
      placeId: store.placeId,
      stats: {
        totalOrders: parseInt(stats?.totalOrders || 0),
        completedOrders,
        totalRevenue,
        firstOrderDate: stats?.firstOrderDate ? new Date(stats.firstOrderDate).toISOString() : null,
        lastOrderDate: stats?.lastOrderDate ? new Date(stats.lastOrderDate).toISOString() : null,
        avgOrderValue,
      },
      topProducts: topProducts.map(p => ({
        productId: p.productId,
        name: p.name,
        brand: p.brand,
        category: p.category,
        media: p.media,
        totalQuantity: parseInt(p.totalQuantity || 0),
        totalRevenue: parseInt(p.totalRevenueCents || 0) / 100,
        orderCount: parseInt(p.orderCount || 0),
      })),
    };

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Store detail API error:', err);
    return NextResponse.json({ error: 'Database error', detail: err.message }, { status: 500 });
  }
}
