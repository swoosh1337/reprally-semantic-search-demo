import { NextRequest, NextResponse } from 'next/server';

// GET /api/places-photo?name=places/xxx/photos/yyy&maxWidth=400
// Proxies Google Places photo through the server so the API key stays server-side
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const name = searchParams.get('name');
  const maxWidth = parseInt(searchParams.get('maxWidth') || '600');

  if (!name) {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'No API key' }, { status: 500 });
  }

  const url = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${maxWidth}&key=${apiKey}&skipHttpRedirect=false`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // cache photos 24h
      },
    });
  } catch (err: any) {
    console.error('Photo proxy error:', err);
    return new NextResponse(null, { status: 502 });
  }
}
