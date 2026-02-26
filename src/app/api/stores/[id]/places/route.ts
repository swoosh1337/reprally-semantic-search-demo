import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getPlaceDetails } from '@/lib/places';

// GET /api/stores/:id/places
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
    const [row] = await query<any>(
      `SELECT a.placeId FROM leads l JOIN addresses a ON a.id = l.addressId WHERE l.id = ? LIMIT 1`,
      [storeId]
    );

    if (!row?.placeId) {
      return NextResponse.json({ error: 'No placeId for this store' }, { status: 404 });
    }

    const data = await getPlaceDetails(row.placeId);
    if (!data) {
      return NextResponse.json({ error: 'Places API returned no data' }, { status: 502 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Places route error:', err);
    return NextResponse.json({ error: 'Error fetching Places data', detail: err.message }, { status: 500 });
  }
}
