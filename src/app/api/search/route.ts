import { NextRequest, NextResponse } from "next/server";
import { embedText } from "@/lib/openai";
import { searchProducts } from "@/lib/chroma";
import { preprocessQuery, type QueryUnderstanding } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  const n = parseInt(request.nextUrl.searchParams.get("n") || "20");
  const useAI = request.nextUrl.searchParams.get("ai") !== "false"; // enabled by default

  // Manual filter params (override AI-extracted filters)
  const manualCategory = request.nextUrl.searchParams.get("category");
  const manualBrand = request.nextUrl.searchParams.get("brand");
  const manualExcludeBrand = request.nextUrl.searchParams.get("excludeBrand");
  const manualNicotine = request.nextUrl.searchParams.get("nicotine");
  const manualEcig = request.nextUrl.searchParams.get("ecig");

  if (!query) {
    return NextResponse.json(
      { error: "Missing query parameter ?q=" },
      { status: 400 }
    );
  }

  try {
    const startTime = Date.now();

    // 1. Query understanding via Gemini (if enabled)
    let understanding: QueryUnderstanding | null = null;
    let searchQuery = query;

    if (useAI && process.env.GEMINI_API_KEY) {
      try {
        understanding = await preprocessQuery(query);
        searchQuery = understanding.semanticQuery;
        console.log("[search] AI understanding:", JSON.stringify(understanding));
      } catch (err: any) {
        console.error("[search] Gemini preprocessing failed:", err.message);
        // Fall back to raw query
      }
    }

    // 2. Embed the (possibly cleaned) query
    const queryEmbedding = await embedText(searchQuery);

    // 3. Build ChromaDB where clause — manual filters take priority, then AI filters
    const aiFilters = understanding?.filters || {};

    function buildWhere(includeAI: boolean) {
      const conditions: Record<string, any>[] = [];

      const category = manualCategory || (includeAI ? aiFilters.category : undefined);
      if (category) conditions.push({ category: { $eq: category } });

      const brand = manualBrand || (includeAI ? aiFilters.brand : undefined);
      if (brand) conditions.push({ brandName: { $eq: brand } });

      const excludeBrand = manualExcludeBrand || (includeAI ? aiFilters.excludeBrand : undefined);
      if (excludeBrand) conditions.push({ brandName: { $ne: excludeBrand } });

      const nicotine = manualNicotine ?? (includeAI && aiFilters.nicotine !== undefined ? String(aiFilters.nicotine) : null);
      if (nicotine === "true") conditions.push({ isNicotine: { $eq: true } });
      else if (nicotine === "false") conditions.push({ isNicotine: { $eq: false } });

      const ecig = manualEcig ?? (includeAI && aiFilters.ecig !== undefined ? String(aiFilters.ecig) : null);
      if (ecig === "true") conditions.push({ isECig: { $eq: true } });
      else if (ecig === "false") conditions.push({ isECig: { $eq: false } });

      if (includeAI) {
        if (aiFilters.maxPrice) conditions.push({ msrp: { $lte: aiFilters.maxPrice } });
        if (aiFilters.minPrice) conditions.push({ msrp: { $gte: aiFilters.minPrice } });
        if (aiFilters.minMargin) conditions.push({ margin: { $gte: aiFilters.minMargin } });
      }

      if (conditions.length === 1) return conditions[0];
      if (conditions.length > 1) return { $and: conditions };
      return undefined;
    }

    // 4. Search Chroma Cloud — with AI filters first, fallback without if 0 results
    let where = buildWhere(true);
    let results = await searchProducts(queryEmbedding, n, where);
    let filtersRelaxed = false;

    if (results.ids.length === 0 && understanding && Object.keys(aiFilters).length > 0) {
      // Retry without AI-extracted filters (keep only manual filters)
      console.log("[search] 0 results with AI filters, retrying without...");
      where = buildWhere(false);
      results = await searchProducts(queryEmbedding, n, where);
      filtersRelaxed = true;
    }

    // 5. Format results (convert distance to similarity)
    const formatResults = (r: typeof results) =>
      r.ids.map((id, i) => ({
        id: r.metadatas[i]?.productId,
        name: r.metadatas[i]?.name,
        brandName: r.metadatas[i]?.brandName,
        category: r.metadatas[i]?.category,
        media: r.metadatas[i]?.media,
        tags: r.metadatas[i]?.tags,
        isNicotine: r.metadatas[i]?.isNicotine || false,
        isECig: r.metadatas[i]?.isECig || false,
        wholesalePrice: r.metadatas[i]?.wholesalePrice,
        msrp: r.metadatas[i]?.msrp,
        margin: r.metadatas[i]?.margin,
        similarity: parseFloat((1 - (r.distances[i] || 0)).toFixed(4)),
        document: r.documents[i],
      }));

    const products = formatResults(results);
    const elapsed = Date.now() - startTime;

    const category = manualCategory || aiFilters.category;
    const brand = manualBrand || aiFilters.brand;
    const excludeBrand = manualExcludeBrand || aiFilters.excludeBrand;
    const nicotine = manualNicotine ?? (aiFilters.nicotine !== undefined ? String(aiFilters.nicotine) : null);
    const ecig = manualEcig ?? (aiFilters.ecig !== undefined ? String(aiFilters.ecig) : null);

    return NextResponse.json({
      query,
      searchQuery: searchQuery !== query ? searchQuery : undefined,
      understanding: understanding || undefined,
      filtersRelaxed,
      count: products.length,
      elapsed_ms: elapsed,
      filters: { category, brand, excludeBrand, nicotine, ecig },
      products,
    });
  } catch (err: any) {
    console.error("[search] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
