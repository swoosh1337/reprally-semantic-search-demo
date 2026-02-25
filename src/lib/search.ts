import { embedText } from "@/lib/openai";
import { searchProducts, getAllDocuments } from "@/lib/chroma";
import {
  preprocessQuery,
  rerankProducts,
  type QueryUnderstanding,
} from "@/lib/gemini";
import {
  buildIndex,
  search as bm25Search,
  fuzzySearch,
  getCachedIndex,
  setCachedIndex,
} from "@/lib/bm25";
import type { SearchResult } from "@/lib/types";

// ---------------------------------------------------------------------------
// Reciprocal Rank Fusion — merges N ranked lists with configurable weights
// ---------------------------------------------------------------------------

const RRF_K = 60;

interface RankedList {
  results: { id: string; rank: number }[];
  weight: number;
}

function reciprocalRankFusion(
  inputs: RankedList[],
): { id: string; score: number }[] {
  const scores = new Map<string, number>();

  for (const { results, weight } of inputs) {
    for (const r of results) {
      scores.set(r.id, (scores.get(r.id) || 0) + weight / (RRF_K + r.rank));
    }
  }

  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toRanked(items: { id: string }[]): { id: string; rank: number }[] {
  return items.map((r, i) => ({ id: r.id, rank: i + 1 }));
}

function parseFilters(
  manualFilters: Record<string, string | null>,
  aiFilters: QueryUnderstanding["filters"],
  includeAI: boolean,
) {
  const conditions: Record<string, any>[] = [];

  const category =
    manualFilters.category || (includeAI ? aiFilters.category : undefined);
  if (category) conditions.push({ category: { $eq: category } });

  const brand =
    manualFilters.brand || (includeAI ? aiFilters.brand : undefined);
  if (brand) conditions.push({ brandName: { $eq: brand } });

  const excludeBrand =
    manualFilters.excludeBrand ||
    (includeAI ? aiFilters.excludeBrand : undefined);
  if (excludeBrand) conditions.push({ brandName: { $ne: excludeBrand } });

  const nicotine =
    manualFilters.nicotine ??
    (includeAI && aiFilters.nicotine !== undefined
      ? String(aiFilters.nicotine)
      : null);
  if (nicotine === "true") conditions.push({ isNicotine: { $eq: true } });
  else if (nicotine === "false")
    conditions.push({ isNicotine: { $eq: false } });

  const ecig =
    manualFilters.ecig ??
    (includeAI && aiFilters.ecig !== undefined
      ? String(aiFilters.ecig)
      : null);
  if (ecig === "true") conditions.push({ isECig: { $eq: true } });
  else if (ecig === "false") conditions.push({ isECig: { $eq: false } });

  if (includeAI) {
    if (aiFilters.maxPrice)
      conditions.push({ msrp: { $lte: aiFilters.maxPrice } });
    if (aiFilters.minPrice)
      conditions.push({ msrp: { $gte: aiFilters.minPrice } });
    if (aiFilters.minMargin)
      conditions.push({ margin: { $gte: aiFilters.minMargin } });
  }

  if (conditions.length === 1) return conditions[0];
  if (conditions.length > 1) return { $and: conditions };
  return undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SearchOptions {
  query: string;
  n?: number;
  useAI?: boolean;
  filters?: {
    category?: string | null;
    brand?: string | null;
    excludeBrand?: string | null;
    nicotine?: string | null;
    ecig?: string | null;
  };
  /** Extra context appended to the Gemini re-ranking prompt */
  storeContext?: string;
}

export interface SearchResponse {
  query: string;
  searchQuery?: string;
  understanding?: QueryUnderstanding;
  filtersRelaxed: boolean;
  searchMethod: string;
  count: number;
  elapsed_ms: number;
  filters: Record<string, any>;
  products: SearchResult[];
}

export async function executeSearch(
  options: SearchOptions,
): Promise<SearchResponse> {
  const { query, n = 20, useAI = true, filters: manualFilters = {} } = options;

  const startTime = Date.now();

  // 1. Query understanding via Gemini (includes typo correction)
  let understanding: QueryUnderstanding | null = null;
  let searchQuery = query;

  if (useAI && process.env.GEMINI_API_KEY) {
    try {
      understanding = await preprocessQuery(query);
      searchQuery = understanding.semanticQuery;
      console.log(
        "[search] AI understanding:",
        JSON.stringify(understanding),
      );
    } catch (err: any) {
      console.error("[search] Gemini preprocessing failed:", err.message);
    }
  }

  // 2. Build filter clause
  const aiFilters = understanding?.filters || {};
  const safeManualFilters: Record<string, string | null> = {
    category: manualFilters.category ?? null,
    brand: manualFilters.brand ?? null,
    excludeBrand: manualFilters.excludeBrand ?? null,
    nicotine: manualFilters.nicotine ?? null,
    ecig: manualFilters.ecig ?? null,
  };

  let where = parseFilters(safeManualFilters, aiFilters, true);

  // 3. Embedding search — fetch extra candidates for hybrid merging
  const candidateCount = Math.max(n * 3, 50);
  const queryEmbedding = await embedText(searchQuery);

  let embeddingResults = await searchProducts(
    queryEmbedding,
    candidateCount,
    where,
  );
  let filtersRelaxed = false;

  if (
    embeddingResults.ids.length === 0 &&
    understanding &&
    Object.keys(aiFilters).length > 0
  ) {
    console.log("[search] 0 results with AI filters, retrying without...");
    where = parseFilters(safeManualFilters, aiFilters, false);
    embeddingResults = await searchProducts(
      queryEmbedding,
      candidateCount,
      where,
    );
    filtersRelaxed = true;
  }

  // 4. BM25 + fuzzy search — keyword matching with typo tolerance
  let bm25Ranked: { id: string; score: number }[] = [];
  let fuzzyRanked: { id: string; score: number }[] = [];

  try {
    let index = getCachedIndex();
    if (!index) {
      console.log("[search] Building BM25 index...");
      const allDocs = await getAllDocuments();
      index = buildIndex(allDocs.ids, allDocs.documents);
      setCachedIndex(index);
      console.log(`[search] BM25 index built: ${index.docCount} docs`);
    }

    const corrected = understanding?.correctedQuery;
    const hasTrueCorrection =
      corrected && corrected.toLowerCase() !== query.toLowerCase();
    const bm25Query = hasTrueCorrection
      ? corrected
      : (understanding?.semanticQuery || query);
    bm25Ranked = bm25Search(index, bm25Query, candidateCount);

    fuzzyRanked = fuzzySearch(index, query, candidateCount);
  } catch (err: any) {
    console.error("[search] BM25/fuzzy search failed:", err.message);
  }

  // Build lookup of all product data by ChromaDB ID
  const dataById = new Map<
    string,
    {
      chromaId: string;
      similarity: number;
      document: string;
      metadata: Record<string, any>;
    }
  >();

  function addToDataById(results: typeof embeddingResults) {
    for (let i = 0; i < results.ids.length; i++) {
      if (dataById.has(results.ids[i])) continue;
      dataById.set(results.ids[i], {
        chromaId: results.ids[i],
        similarity: parseFloat(
          (1 - (results.distances[i] || 0)).toFixed(4),
        ),
        document: results.documents[i] as string,
        metadata: results.metadatas[i],
      });
    }
  }

  addToDataById(embeddingResults);

  // 4b. Hydrate BM25/fuzzy results that aren't already in dataById
  //     When embedding search returns 0 (restrictive filters), BM25/fuzzy still
  //     find matches — but without hydration those IDs get filtered out in the
  //     RRF merge step because dataById doesn't have their product data.
  {
    const missingIds: string[] = [];
    for (const r of bm25Ranked) {
      if (!dataById.has(r.id)) missingIds.push(r.id);
    }
    for (const r of fuzzyRanked) {
      if (!dataById.has(r.id) && !missingIds.includes(r.id))
        missingIds.push(r.id);
    }

    if (missingIds.length > 0) {
      const allDocs = await getAllDocuments();
      const idToIdx = new Map<string, number>();
      for (let i = 0; i < allDocs.ids.length; i++) {
        idToIdx.set(allDocs.ids[i], i);
      }
      for (const id of missingIds) {
        const idx = idToIdx.get(id);
        if (idx !== undefined) {
          dataById.set(id, {
            chromaId: id,
            similarity: 0, // no embedding similarity for keyword-only matches
            document: allDocs.documents[idx] || "",
            metadata: allDocs.metadatas[idx] || {},
          });
        }
      }
      console.log(
        `[search] Hydrated ${missingIds.length} BM25/fuzzy results into dataById`,
      );
    }
  }

  // 5. Multi-query expansion — parallel searches for vague queries
  const rrfInputs: RankedList[] = [
    {
      results: toRanked(embeddingResults.ids.map((id) => ({ id }))),
      weight: 1.0,
    },
    { results: toRanked(bm25Ranked), weight: 0.8 },
    { results: toRanked(fuzzyRanked), weight: 0.3 },
  ];

  const expandedQueries = understanding?.expandedQueries;
  if (expandedQueries?.length) {
    console.log(`[search] Expanding: ${expandedQueries.length} sub-queries`);

    const expansionResults = await Promise.all(
      expandedQueries.map(async (eq) => {
        const eqEmbedding = await embedText(eq);
        return searchProducts(
          eqEmbedding,
          Math.floor(candidateCount / 2),
          where,
        );
      }),
    );

    for (const result of expansionResults) {
      addToDataById(result);
      rrfInputs.push({
        results: toRanked(result.ids.map((id) => ({ id }))),
        weight: 0.5,
      });
    }
  }

  // 6. Hybrid merge via Reciprocal Rank Fusion
  const merged = reciprocalRankFusion(rrfInputs);

  const topMerged = merged
    .filter((m) => dataById.has(m.id))
    .slice(0, Math.max(n * 2, 30));

  // 7. Re-rank with Gemini
  let finalOrder = topMerged.map((m) => m.id);

  if (useAI && process.env.GEMINI_API_KEY && topMerged.length > 3) {
    try {
      const candidates = topMerged.map((m) => {
        const data = dataById.get(m.id)!;
        return {
          id: m.id,
          name: String(data.metadata?.name || ""),
          brand: String(data.metadata?.brandName || ""),
          category: String(data.metadata?.category || ""),
          price: Number(data.metadata?.msrp || 0),
          margin: Number(data.metadata?.margin || 0),
          score: m.score,
        };
      });

      finalOrder = await rerankProducts(
        query,
        candidates,
        options.storeContext,
      );
      console.log("[search] Re-ranked with Gemini");
    } catch (err: any) {
      console.error("[search] Re-ranking failed:", err.message);
    }
  }

  // 8. Build final product list in re-ranked order
  const seen = new Set<string>();
  const products: SearchResult[] = [];

  for (const id of finalOrder) {
    if (seen.has(id) || !dataById.has(id)) continue;
    seen.add(id);
    if (products.length >= n) break;

    const data = dataById.get(id)!;
    products.push({
      id: data.metadata?.productId,
      name: data.metadata?.name,
      brandName: data.metadata?.brandName,
      category: data.metadata?.category,
      media: data.metadata?.media,
      tags: data.metadata?.tags,
      isNicotine: data.metadata?.isNicotine || false,
      isECig: data.metadata?.isECig || false,
      wholesalePrice: data.metadata?.wholesalePrice,
      msrp: data.metadata?.msrp,
      margin: data.metadata?.margin,
      similarity: data.similarity,
      document: data.document,
    });
  }

  const elapsed = Date.now() - startTime;

  return {
    query,
    searchQuery: searchQuery !== query ? searchQuery : undefined,
    understanding: understanding || undefined,
    filtersRelaxed,
    searchMethod: "hybrid",
    count: products.length,
    elapsed_ms: elapsed,
    filters: {
      category: safeManualFilters.category || aiFilters.category,
      brand: safeManualFilters.brand || aiFilters.brand,
      excludeBrand: safeManualFilters.excludeBrand || aiFilters.excludeBrand,
      nicotine:
        safeManualFilters.nicotine ??
        (aiFilters.nicotine !== undefined
          ? String(aiFilters.nicotine)
          : null),
      ecig:
        safeManualFilters.ecig ??
        (aiFilters.ecig !== undefined ? String(aiFilters.ecig) : null),
    },
    products,
  };
}
