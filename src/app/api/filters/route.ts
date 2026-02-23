import { NextResponse } from "next/server";
import { getFilterOptions } from "@/lib/chroma";

export const dynamic = "force-dynamic";

// Cache the filters in memory — they don't change often
let cachedFilters: { categories: string[]; brands: string[] } | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    const now = Date.now();

    if (!cachedFilters || now - cacheTime > CACHE_TTL) {
      cachedFilters = await getFilterOptions();
      cacheTime = now;
    }

    return NextResponse.json(cachedFilters);
  } catch (err: any) {
    console.error("[filters] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
