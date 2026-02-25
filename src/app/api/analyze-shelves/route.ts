import { NextRequest, NextResponse } from "next/server";
import { analyzeShelfImages } from "@/lib/gemini";
import { executeSearch } from "@/lib/search";
import type { StoreVisitData, RecommendationGroup } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body: { images: string[]; storeData: StoreVisitData } =
      await request.json();

    if (!body.images?.length) {
      return NextResponse.json(
        { error: "No images provided" },
        { status: 400 },
      );
    }

    if (body.images.length > 10) {
      return NextResponse.json(
        { error: "Maximum 10 images allowed" },
        { status: 400 },
      );
    }

    const startTime = Date.now();

    // 1. Convert data URIs to { mimeType, data } for Gemini
    const geminiImages = body.images.map((dataUri) => {
      const match = dataUri.match(/^data:(.+?);base64,(.+)$/);
      if (!match) throw new Error("Invalid image data URI");
      return { mimeType: match[1], data: match[2] };
    });

    // 2. Analyze with Gemini Vision
    const analysis = await analyzeShelfImages(geminiImages, body.storeData);
    console.log(
      `[analyze-shelves] Analysis: ${analysis.shelfAnalysis.productsIdentified.length} products, ${analysis.shelfAnalysis.gaps.length} gaps, ${analysis.queryGroups.length} queries`,
    );

    // 3. Run generated queries through search pipeline
    const storeContext = `${body.storeData.profile.storeType} store, ${body.storeData.profile.storeSize} size, ${body.storeData.profile.priceMix} price mix`;

    const searchResults = await Promise.all(
      analysis.queryGroups.map((group) =>
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

    // 4. Build recommendation groups
    const recommendations: RecommendationGroup[] = analysis.queryGroups
      .map((group, i) => ({
        title: group.title,
        rationale: group.rationale,
        searchQuery: group.searchQuery,
        products: searchResults[i].products,
      }))
      .filter((g) => g.products.length > 0);

    const elapsed = Date.now() - startTime;
    console.log(
      `[analyze-shelves] ${recommendations.length} groups in ${elapsed}ms`,
    );

    return NextResponse.json({
      shelfAnalysis: analysis.shelfAnalysis,
      recommendations,
      elapsed_ms: elapsed,
    });
  } catch (err: any) {
    console.error("[analyze-shelves] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
