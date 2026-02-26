import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export interface StorePin {
  id: number;
  status: string;
  storeType: string | null;
  company: string | null;
  address: string | null;
  city: string | null;
  locality: string | null;
  latitude: number;
  longitude: number;
  placeId: string | null;
  hasOrders: boolean;
}

// GET /api/stores?swLat=&swLng=&neLat=&neLng=&status=&limit=
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const swLat = parseFloat(searchParams.get('swLat') || '');
  const swLng = parseFloat(searchParams.get('swLng') || '');
  const neLat = parseFloat(searchParams.get('neLat') || '');
  const neLng = parseFloat(searchParams.get('neLng') || '');

  if (isNaN(swLat) || isNaN(swLng) || isNaN(neLat) || isNaN(neLng)) {
    return NextResponse.json({ error: 'Missing bounds: swLat, swLng, neLat, neLng required' }, { status: 400 });
  }

  const statusFilter = searchParams.get('status'); // comma-separated or single
  const limit = Math.min(parseInt(searchParams.get('limit') || '2000'), 5000);

  const statuses = statusFilter ? statusFilter.split(',').map(s => s.trim()).filter(Boolean) : null;

  let sql = `
    SELECT
      l.id,
      l.status,
      l.storeType,
      a.company,
      a.address,
      a.city,
      a.locality,
      a.latitude,
      a.longitude,
      a.placeId,
      IF(o.id IS NOT NULL, 1, 0) AS hasOrders
    FROM leads l
    JOIN addresses a ON a.id = l.addressId
    LEFT JOIN (
      SELECT DISTINCT leadId AS id FROM orders WHERE status = 'complete'
    ) o ON o.id = l.id
    WHERE a.latitude BETWEEN ? AND ?
      AND a.longitude BETWEEN ? AND ?
      AND a.latitude != 0
      AND a.longitude != 0
  `;

  const params: any[] = [swLat, neLat, swLng, neLng];

  if (statuses && statuses.length > 0) {
    sql += ` AND l.status IN (${statuses.map(() => '?').join(',')})`;
    params.push(...statuses);
  }

  sql += ` LIMIT ?`;
  params.push(limit);

  try {
    const rows = await query<any>(sql, params);

    const stores: StorePin[] = rows.map(row => ({
      id: row.id,
      status: row.status,
      storeType: row.storeType,
      company: row.company,
      address: row.address,
      city: row.city,
      locality: row.locality,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      placeId: row.placeId,
      hasOrders: row.hasOrders === 1,
    }));

    return NextResponse.json({ stores, count: stores.length });
  } catch (err: any) {
    console.error('Stores API error:', err);
    return NextResponse.json({ error: 'Database error', detail: err.message }, { status: 500 });
  }
}
