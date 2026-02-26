import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { query } from '@/lib/db';
import { getPlaceDetails } from '@/lib/places';
import { buildStoreContext } from '@/lib/store-context';
import { executeSearch } from '@/lib/search';
import type { StoreDetail } from '@/app/api/stores/[id]/route';
import type { SimilarStoresData } from '@/app/api/stores/[id]/similar/route';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Detect if the user message likely wants product search
function wantsProductSearch(message: string): boolean {
  const lower = message.toLowerCase();
  const triggers = [
    'product', 'pitch', 'sell', 'recommend', 'suggest', 'find', 'show me',
    'what should', 'what to', 'carry', 'stock', 'item', 'brand', 'category',
    'energy drink', 'snack', 'tobacco', 'vape', 'cbd', 'drink', 'food',
    'nicotine', 'candy', 'chip', 'beverage', 'supplement',
  ];
  return triggers.some(t => lower.includes(t));
}

// Build search query from user message + store context
function buildSearchQuery(message: string, storeType: string | null): string {
  // Clean up the user message for search
  const clean = message
    .replace(/what should (i|we) (pitch|sell|recommend|suggest)/gi, '')
    .replace(/find (me |us )?products? (for|that)/gi, '')
    .replace(/show me/gi, '')
    .replace(/\?/g, '')
    .trim();

  if (clean.length > 5) return clean;

  // Fallback: build from store type
  const typeQueries: Record<string, string> = {
    convenience: 'high margin snacks beverages impulse buy convenience store',
    gas: 'energy drinks snacks tobacco gas station convenience',
    tobacco_smoke: 'tobacco vape nicotine smoke shop products',
    liquor: 'spirits accessories mixers bar products liquor store',
    grocery: 'specialty food beverage grocery organic health',
    foodservice: 'food service restaurant supplies condiments',
    gym: 'supplements protein bars energy fitness gym',
    other: 'high margin wholesale retail products',
  };
  return typeQueries[storeType || ''] || 'best selling wholesale products high margin';
}

// POST /api/chat
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { storeId, messages }: { storeId: number; messages: ChatMessage[] } = body;

    if (!storeId || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'storeId and messages are required' }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return NextResponse.json({ error: 'Last message must be from user' }, { status: 400 });
    }

    // Fetch store data
    const [storeRow] = await query<any>(`
      SELECT l.id, l.status, l.storeType, l.storeSize, l.priceMix, l.brandMix,
             a.company, a.address, a.city, a.locality, a.zipCode,
             a.latitude, a.longitude, a.placeId
      FROM leads l
      JOIN addresses a ON a.id = l.addressId
      WHERE l.id = ? LIMIT 1
    `, [storeId]);

    if (!storeRow) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Fetch order stats + top products
    const [statsRow] = await query<any>(`
      SELECT
        COUNT(DISTINCT o.id) AS totalOrders,
        SUM(CASE WHEN o.status='complete' THEN 1 ELSE 0 END) AS completedOrders,
        COALESCE(SUM(CASE WHEN o.status='complete' THEN op.totalSaleMoney ELSE 0 END), 0) AS totalRevenueCents,
        MIN(CASE WHEN o.status='complete' THEN o.createdAt END) AS firstOrderDate,
        MAX(CASE WHEN o.status='complete' THEN o.createdAt END) AS lastOrderDate
      FROM orders o
      LEFT JOIN orderProducts op ON op.orderId = o.id
      WHERE o.leadId = ?
    `, [storeId]);

    const topProducts = await query<any>(`
      SELECT p.id AS productId, p.name, b.name AS brand, p.category, p.mediaCDN AS media,
             SUM(op.quantity) AS totalQuantity,
             SUM(op.totalSaleMoney) AS totalRevenueCents,
             COUNT(DISTINCT o.id) AS orderCount
      FROM orders o
      JOIN orderProducts op ON op.orderId = o.id
      JOIN productVariations pv ON pv.id = op.productVariationId
      JOIN products p ON p.id = pv.productId
      JOIN brands b ON b.id = p.brandId
      WHERE o.leadId = ? AND o.status = 'complete' AND op.totalSaleMoney > 0
      GROUP BY p.id, p.name, b.name, p.category, p.mediaCDN
      ORDER BY totalRevenueCents DESC LIMIT 10
    `, [storeId]);

    const completedOrders = parseInt(statsRow?.completedOrders || 0);
    const totalRevenue = parseInt(statsRow?.totalRevenueCents || 0) / 100;

    const store: StoreDetail = {
      id: storeRow.id,
      status: storeRow.status,
      storeType: storeRow.storeType,
      storeSize: storeRow.storeSize,
      priceMix: storeRow.priceMix,
      brandMix: storeRow.brandMix,
      company: storeRow.company,
      address: storeRow.address,
      city: storeRow.city,
      locality: storeRow.locality,
      zipCode: storeRow.zipCode,
      latitude: parseFloat(storeRow.latitude),
      longitude: parseFloat(storeRow.longitude),
      placeId: storeRow.placeId,
      stats: {
        totalOrders: parseInt(statsRow?.totalOrders || 0),
        completedOrders,
        totalRevenue,
        firstOrderDate: statsRow?.firstOrderDate ? new Date(statsRow.firstOrderDate).toISOString() : null,
        lastOrderDate: statsRow?.lastOrderDate ? new Date(statsRow.lastOrderDate).toISOString() : null,
        avgOrderValue: completedOrders > 0 ? totalRevenue / completedOrders : 0,
      },
      topProducts: topProducts.map((p: any) => ({
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

    // Fetch Places data and similar stores in parallel
    const [places, similarData] = await Promise.allSettled([
      storeRow.placeId ? getPlaceDetails(storeRow.placeId) : Promise.resolve(null),
      fetchSimilarProducts(storeRow.id, storeRow.storeType, parseFloat(storeRow.latitude), parseFloat(storeRow.longitude)),
    ]);

    const placesResult = places.status === 'fulfilled' ? places.value : null;
    const similarResult = similarData.status === 'fulfilled' ? similarData.value : null;

    const systemContext = buildStoreContext(store, placesResult, similarResult);

    // Run product search if the message warrants it
    let searchResults = null;
    if (wantsProductSearch(lastMessage.content)) {
      const searchQuery = buildSearchQuery(lastMessage.content, storeRow.storeType);
      try {
        const searchResponse = await executeSearch({
          query: searchQuery,
          n: 8,
          useAI: false, // skip Gemini rerank for speed in chat
          storeContext: `${storeRow.storeType} store in ${storeRow.city}, ${storeRow.locality}`,
        });
        if (searchResponse.products.length > 0) {
          searchResults = searchResponse.products;
        }
      } catch (e) {
        console.warn('Chat product search failed:', e);
      }
    }

    // Build Gemini chat history
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Inject system context as the first user/model exchange (works with old SDK)
    const systemTurn = [
      { role: 'user' as const, parts: [{ text: `[SYSTEM CONTEXT - READ CAREFULLY]\n\n${systemContext}\n\nAcknowledge you have read this context.` }] },
      { role: 'model' as const, parts: [{ text: 'Understood. I have the store context loaded and am ready to help the sales rep.' }] },
    ];

    // Convert message history (exclude last user message — we'll send it separately)
    const history = [
      ...systemTurn,
      ...messages.slice(0, -1).map(m => ({
        role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
        parts: [{ text: m.content }],
      })),
    ];

    const chat = model.startChat({ history });

    // Build the final user message, optionally injecting search results
    let userMessage = lastMessage.content;
    if (searchResults && searchResults.length > 0) {
      const productList = searchResults
        .map((p, i) =>
          `${i + 1}. **${p.name}** by ${p.brandName} | ${p.category} | $${((p.wholesalePrice || 0) / 100).toFixed(2)} wholesale | ${Math.round((p.margin || 0) * 100)}% margin | Similarity: ${Math.round(p.similarity * 100)}%`
        )
        .join('\n');

      userMessage += `\n\n[SYSTEM: Vector search found these relevant products from the RepRally catalog — use them in your response]\n${productList}`;
    }

    const result = await chat.sendMessage(userMessage);
    const responseText = result.response.text();

    return NextResponse.json({
      message: responseText,
      products: searchResults ?? [],
      storeContext: {
        id: store.id,
        company: store.company,
        status: store.status,
        storeType: store.storeType,
        hasOrders: store.stats.completedOrders > 0,
      },
    });
  } catch (err: any) {
    console.error('Chat API error:', err);
    return NextResponse.json({ error: 'Chat error', detail: err.message }, { status: 500 });
  }
}

async function fetchSimilarProducts(
  storeId: number,
  storeType: string | null,
  lat: number,
  lng: number
): Promise<SimilarStoresData | null> {
  if (!storeType || isNaN(lat) || isNaN(lng)) return null;

  const latDelta = 10 / 69;
  const lngDelta = 10 / (69 * Math.cos((lat * Math.PI) / 180));

  const similarStores = await query<any>(`
    SELECT DISTINCT l.id
    FROM leads l
    JOIN addresses a ON a.id = l.addressId
    JOIN orders o ON o.leadId = l.id AND o.status = 'complete'
    WHERE l.storeType = ? AND l.id != ?
      AND a.latitude BETWEEN ? AND ?
      AND a.longitude BETWEEN ? AND ?
    LIMIT 50
  `, [storeType, storeId, lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta]);

  const ids = similarStores.map((s: any) => s.id);
  if (ids.length === 0) return null;

  const products = await query<any>(`
    SELECT p.id AS productId, p.name, b.name AS brand, p.category, p.mediaCDN AS media,
           COUNT(DISTINCT o.leadId) AS storeCount,
           SUM(op.quantity) AS totalQuantity,
           SUM(op.totalSaleMoney) AS totalRevenueCents
    FROM orders o
    JOIN orderProducts op ON op.orderId = o.id
    JOIN productVariations pv ON pv.id = op.productVariationId
    JOIN products p ON p.id = pv.productId AND p.isArchived = 0
    JOIN brands b ON b.id = p.brandId
    WHERE o.leadId IN (${ids.map(() => '?').join(',')})
      AND o.status = 'complete' AND op.totalSaleMoney > 0
    GROUP BY p.id ORDER BY storeCount DESC, totalRevenueCents DESC LIMIT 15
  `, ids);

  return {
    storeType,
    radiusMiles: 10,
    similarStoreCount: ids.length,
    products: products.map((p: any) => ({
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
  };
}
