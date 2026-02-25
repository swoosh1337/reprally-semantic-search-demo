import { NextRequest, NextResponse } from "next/server";
import { generateRecommendationQueries } from "@/lib/gemini";
import { executeSearch } from "@/lib/search";
import type { StoreVisitData, RecommendationGroup } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body: StoreVisitData = await request.json();

    if (!body.profile?.storeType) {
      return NextResponse.json(
        { error: "Missing store profile" },
        { status: 400 },
      );
    }

    const startTime = Date.now();

    // 1. Ask Gemini for targeted search queries
    const queryGroups = await generateRecommendationQueries(body);
    console.log(
      `[recommend] Gemini generated ${queryGroups.length} query groups`,
    );

    if (queryGroups.length === 0) {
      return NextResponse.json({ groups: [], elapsed_ms: Date.now() - startTime });
    }

    // 2. Run each query through the search pipeline in parallel
    const storeContext = `${body.profile.storeType} store, ${body.profile.storeSize} size, ${body.profile.priceMix} price mix`;

    const searchResults = await Promise.all(
      queryGroups.map((group) =>
        executeSearch({
          query: group.searchQuery,
          n: 6,
          useAI: true,
          filters: group.filters
            ? {
                category: group.filters.category || null,
                brand: group.filters.brand || null,
              }
            : undefined,
          storeContext,
        }),
      ),
    );

    // 3. Build recommendation groups
    const groups: RecommendationGroup[] = queryGroups
      .map((group, i) => ({
        title: group.title,
        rationale: group.rationale,
        searchQuery: group.searchQuery,
        products: searchResults[i].products,
      }))
      .filter((g) => g.products.length > 0);

    const elapsed = Date.now() - startTime;
    console.log(
      `[recommend] ${groups.length} groups, ${groups.reduce((s, g) => s + g.products.length, 0)} total products in ${elapsed}ms`,
    );

    return NextResponse.json({ groups, elapsed_ms: elapsed });
  } catch (err: any) {
    console.error("[recommend] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
