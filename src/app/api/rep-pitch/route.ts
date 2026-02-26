import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { query } from '@/lib/db';
import { getPlaceDetails } from '@/lib/places';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// POST /api/rep-pitch
// Body: { storeId, product: { id, name, brandName, category, wholesalePrice, msrp, margin, document } }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { storeId, product } = body;

    if (!storeId || !product?.name) {
      return NextResponse.json({ error: 'storeId and product required' }, { status: 400 });
    }

    // Fetch store info
    const [store] = await query<any>(`
      SELECT l.id, l.status, l.storeType, l.storeSize, l.priceMix, l.brandMix,
             a.company, a.city, a.locality, a.zipCode, a.latitude, a.longitude, a.placeId
      FROM leads l JOIN addresses a ON a.id = l.addressId
      WHERE l.id = ? LIMIT 1
    `, [storeId]);

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Fetch order count for this store
    const [stats] = await query<any>(`
      SELECT COUNT(DISTINCT o.id) AS completedOrders,
             COALESCE(SUM(op.totalSaleMoney), 0) AS totalRevenueCents
      FROM orders o
      LEFT JOIN orderProducts op ON op.orderId = o.id
      WHERE o.leadId = ? AND o.status = 'complete'
    `, [storeId]);

    const completedOrders = parseInt(stats?.completedOrders || 0);
    const isCold = completedOrders === 0;

    // Fetch how many similar stores sell this product and for how much
    const lat = parseFloat(store.latitude);
    const lng = parseFloat(store.longitude);
    const latDelta = 15 / 69;
    const lngDelta = 15 / (69 * Math.cos((lat * Math.PI) / 180));

    const [similarData] = await query<any>(`
      SELECT COUNT(DISTINCT o.leadId) AS storeCount,
             SUM(op.quantity) AS totalQty,
             SUM(op.totalSaleMoney) AS totalRevCents,
             AVG(op.totalSaleMoney) AS avgRevCents
      FROM orders o
      JOIN orderProducts op ON op.orderId = o.id
      JOIN productVariations pv ON pv.id = op.productVariationId
      JOIN products p ON p.id = pv.productId
      JOIN leads l ON l.id = o.leadId
      JOIN addresses a ON a.id = l.addressId
      WHERE p.name = ?
        AND l.storeType = ?
        AND l.id != ?
        AND o.status = 'complete'
        AND a.latitude BETWEEN ? AND ?
        AND a.longitude BETWEEN ? AND ?
    `, [
      product.name, store.storeType, storeId,
      lat - latDelta, lat + latDelta,
      lng - lngDelta, lng + lngDelta,
    ]);

    // Also check nationally
    const [nationalData] = await query<any>(`
      SELECT COUNT(DISTINCT o.leadId) AS storeCount,
             SUM(op.quantity) AS totalQty,
             SUM(op.totalSaleMoney) AS totalRevCents
      FROM orders o
      JOIN orderProducts op ON op.orderId = o.id
      JOIN productVariations pv ON pv.id = op.productVariationId
      JOIN products p ON p.id = pv.productId
      JOIN leads l ON l.id = o.leadId
      WHERE p.name = ? AND l.storeType = ? AND o.status = 'complete'
    `, [product.name, store.storeType]);

    // Fetch Google Places for store context
    const places = store.placeId ? await getPlaceDetails(store.placeId) : null;

    // Build a rich context prompt
    const storeTypeLabels: Record<string, string> = {
      convenience: 'convenience store', gas: 'gas station', tobacco_smoke: 'smoke/tobacco shop',
      liquor: 'liquor store', grocery: 'grocery store', foodservice: 'food service/restaurant',
      gym: 'gym/fitness', other: 'retail store',
    };
    const storeLabel = storeTypeLabels[store.storeType || ''] || 'store';
    const nearbyCount = parseInt(similarData?.storeCount || 0);
    const nationalCount = parseInt(nationalData?.storeCount || 0);
    const avgRev = nearbyCount > 0 ? (parseInt(similarData.avgRevCents || 0) / 100) : 0;
    const nationalRev = nationalCount > 0 ? (parseInt(nationalData.totalRevCents || 0) / 100) : 0;

    // Build Google Places insight
    let placesInsight = '';
    if (places) {
      if (places.rating) placesInsight += `Google rating: ${places.rating}/5 (${places.userRatingCount} reviews). `;
      if (places.reviews?.length) {
        const reviewText = places.reviews.slice(0, 2).map(r => r.text.slice(0, 100)).join(' | ');
        placesInsight += `Customer reviews mention: "${reviewText}". `;
      }
    }

    const prompt = `You are a B2B wholesale sales expert helping a sales rep pitch a product to a store owner.

STORE: ${store.company || 'Unknown'} — ${storeLabel} in ${store.city}, ${store.locality}
STATUS: ${isCold ? 'Cold store (no orders yet)' : `Active customer (${completedOrders} completed orders)`}
${placesInsight ? `GOOGLE INTEL: ${placesInsight}` : ''}

PRODUCT TO PITCH:
- Name: ${product.name}
- Brand: ${product.brandName}
- Category: ${product.category}
- Wholesale price: $${((product.wholesalePrice || 0) / 100).toFixed(2)}
- Margin: ${Math.round((product.margin || 0) * 100)}%
${product.document ? `- Product details: ${product.document.slice(0, 400)}` : ''}

SALES DATA FROM REPRALLY NETWORK:
${nearbyCount > 0
  ? `- ${nearbyCount} nearby ${storeLabel}s (within 15 miles) carry this product, averaging $${avgRev.toFixed(0)}/order`
  : `- Not yet carried by nearby stores — first-mover opportunity`}
${nationalCount > 0
  ? `- ${nationalCount} ${storeLabel}s nationally carry it — $${nationalRev.toLocaleString()} total revenue`
  : ''}

Write two things (be specific and concise, 2-3 sentences each):

1. WHY_THIS_PRODUCT: Why this specific product fits this specific store. Reference the store type, location context, Google reviews if available, and the sales data from similar stores.

2. SAY_THIS: The exact pitch the rep should say to the store owner. Make it conversational, confident, reference social proof from nearby stores if available, and mention the margin opportunity.

Respond as JSON: {"reasoning": "...", "salesPitch": "..."}`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    let text = result.response.text().trim()
      .replace(/^```json\n?/, '').replace(/\n?```$/, '');

    let parsed: { reasoning: string; salesPitch: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { reasoning: text, salesPitch: '' };
    }

    return NextResponse.json({
      ...parsed,
      socialProof: {
        nearbyStoreCount: nearbyCount,
        nationalStoreCount: nationalCount,
        avgRevenueNearby: avgRev,
        totalRevenueNational: nationalRev,
      },
    });
  } catch (err: any) {
    console.error('rep-pitch error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
