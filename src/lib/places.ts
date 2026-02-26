export interface PlacesData {
  name: string | null;
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: string | null;
  types: string[];
  phoneNumber: string | null;
  website: string | null;
  isOpenNow: boolean | null;
  openingHours: string[] | null;
  reviews: {
    text: string;
    rating: number;
    authorName: string;
    relativeTime: string;
  }[];
  photoNames: string[];
}

// In-memory cache: placeId -> { data, fetchedAt }
const cache = new Map<string, { data: PlacesData; fetchedAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function getPlaceDetails(placeId: string): Promise<PlacesData | null> {
  const cached = cache.get(placeId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn('GOOGLE_PLACES_API_KEY not set');
    return null;
  }

  const fields = [
    'displayName',
    'rating',
    'userRatingCount',
    'priceLevel',
    'types',
    'nationalPhoneNumber',
    'websiteUri',
    'currentOpeningHours',
    'regularOpeningHours',
    'reviews',
    'photos',
  ].join(',');

  const url = `https://places.googleapis.com/v1/places/${placeId}?fields=${fields}&key=${apiKey}&languageCode=en`;

  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Places API error for ${placeId}:`, res.status, errText);
      return null;
    }

    const data = await res.json();

    const result: PlacesData = {
      name: data.displayName?.text ?? null,
      rating: data.rating ?? null,
      userRatingCount: data.userRatingCount ?? null,
      priceLevel: data.priceLevel ?? null,
      types: data.types ?? [],
      phoneNumber: data.nationalPhoneNumber ?? null,
      website: data.websiteUri ?? null,
      isOpenNow: data.currentOpeningHours?.openNow ?? null,
      openingHours: data.regularOpeningHours?.weekdayDescriptions ?? null,
      reviews: (data.reviews ?? []).slice(0, 5).map((r: any) => ({
        text: r.text?.text ?? '',
        rating: r.rating ?? 0,
        authorName: r.authorAttribution?.displayName ?? 'Anonymous',
        relativeTime: r.relativePublishTimeDescription ?? '',
      })),
      photoNames: (data.photos ?? []).slice(0, 3).map((p: any) => p.name),
    };

    cache.set(placeId, { data: result, fetchedAt: Date.now() });
    return result;
  } catch (err) {
    console.error('Places API fetch error:', err);
    return null;
  }
}

export function getPhotoUrl(photoName: string, maxWidth = 400): string {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || '';
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${apiKey}`;
}
