import { ChromaClient, IncludeEnum, type IEmbeddingFunction } from "chromadb";

// No-op embedding function — we provide our own embeddings via OpenAI
const noopEmbedding: IEmbeddingFunction = {
  generate: async (texts: string[]) => texts.map(() => []),
};

let client: ChromaClient | null = null;

// Cache all-documents fetch so filters + BM25 share the same data
let _allDocsCache: { ids: string[]; documents: string[]; metadatas: Record<string, any>[] } | null = null;
let _allDocsCacheTime = 0;
const ALL_DOCS_TTL = 10 * 60 * 1000; // 10 min

function getClient(): ChromaClient {
  if (!client) {
    client = new ChromaClient({
      path: "https://api.trychroma.com",
      auth: {
        provider: "token",
        credentials: process.env.CHROMA_API_KEY!,
        tokenHeaderType: "X_CHROMA_TOKEN",
      },
      tenant: process.env.CHROMA_TENANT!,
      database: process.env.CHROMA_DATABASE!,
    });
  }
  return client;
}

export async function searchProducts(
  queryEmbedding: number[],
  nResults: number = 20,
  where?: Record<string, any>
) {
  const chroma = getClient();
  const collection = await chroma.getCollection({
    name: "reprally_products",
    embeddingFunction: noopEmbedding,
  });

  const queryOptions: any = {
    queryEmbeddings: [queryEmbedding],
    nResults,
  };

  if (where && Object.keys(where).length > 0) {
    queryOptions.where = where;
  }

  const results = await collection.query(queryOptions);

  return {
    ids: results.ids[0] || [],
    distances: results.distances?.[0] || [],
    documents: results.documents?.[0] || [],
    metadatas: (results.metadatas?.[0] || []) as Record<string, any>[],
  };
}

/**
 * Get all unique categories and brands from the collection.
 * Fetches all metadata and extracts distinct values.
 */
export async function getFilterOptions(): Promise<{
  categories: string[];
  brands: string[];
}> {
  // Reuse getAllDocuments (cached) — also pre-populates data for BM25 index
  const allData = await getAllDocuments();
  const allMetas = allData.metadatas;

  const categorySet = new Set<string>();
  const brandSet = new Set<string>();

  for (const meta of allMetas) {
    if (meta?.category && typeof meta.category === "string" && meta.category.trim()) {
      categorySet.add(meta.category);
    }
    if (meta?.brandName && typeof meta.brandName === "string" && meta.brandName.trim()) {
      brandSet.add(meta.brandName);
    }
  }

  return {
    categories: Array.from(categorySet).sort(),
    brands: Array.from(brandSet).sort(),
  };
}

/**
 * Get all documents and IDs from the collection (for BM25 index building).
 * Cached for 10 min to avoid re-fetching on every call.
 * Tries multiple strategies to work around ChromaDB Cloud pagination limits.
 */
export async function getAllDocuments(): Promise<{
  ids: string[];
  documents: string[];
  metadatas: Record<string, any>[];
}> {
  // Return cached result if fresh
  if (_allDocsCache && Date.now() - _allDocsCacheTime < ALL_DOCS_TTL) {
    console.log(`[chroma] getAllDocuments: returning cached ${_allDocsCache.ids.length} docs`);
    return _allDocsCache;
  }

  const chroma = getClient();
  const collection = await chroma.getCollection({
    name: "reprally_products",
    embeddingFunction: noopEmbedding,
  });

  const total = await collection.count();
  console.log(`[chroma] getAllDocuments: total count = ${total}`);

  // Strategy 1: Try direct REST API pagination (bypasses client validation issues)
  try {
    const result = await fetchAllViaREST(total);
    if (result && result.ids.length > 0) {
      console.log(`[chroma] REST API fetched ${result.ids.length}/${total} docs`);
      _allDocsCache = result;
      _allDocsCacheTime = Date.now();
      return result;
    }
  } catch (err: any) {
    console.warn(`[chroma] REST API strategy failed: ${err.message}`);
  }

  // Strategy 2: Try client pagination with small pages
  try {
    const allIds: string[] = [];
    const allDocs: string[] = [];
    const allMetas: Record<string, any>[] = [];
    const PAGE = 100;

    for (let offset = 0; offset < total; offset += PAGE) {
      const page = await collection.get({
        include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
        limit: PAGE,
        offset,
      });
      allIds.push(...(page.ids || []));
      allDocs.push(...((page.documents || []) as string[]));
      allMetas.push(...((page.metadatas || []) as Record<string, any>[]));
    }

    if (allIds.length > 0) {
      console.log(`[chroma] Client pagination fetched ${allIds.length}/${total} docs`);
      const result = { ids: allIds, documents: allDocs, metadatas: allMetas };
      _allDocsCache = result;
      _allDocsCacheTime = Date.now();
      return result;
    }
  } catch (err: any) {
    console.warn(`[chroma] Client pagination failed: ${err.message}`);
  }

  // Strategy 3: Fallback — single get() without limit/offset (returns default ~300)
  console.log(`[chroma] Falling back to default get() (partial corpus)`);
  const page = await collection.get({
    include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
  });

  console.log(`[chroma] Default get() returned ${page.ids?.length || 0}/${total} docs`);
  const result = {
    ids: page.ids || [],
    documents: (page.documents || []) as string[],
    metadatas: (page.metadatas || []) as Record<string, any>[],
  };
  _allDocsCache = result;
  _allDocsCacheTime = Date.now();
  return result;
}

/**
 * Fetch all documents via direct REST API calls to ChromaDB Cloud.
 * Uses the v2 API with tenant/database in the path (matching client behavior).
 */
async function fetchAllViaREST(total: number): Promise<{
  ids: string[];
  documents: string[];
  metadatas: Record<string, any>[];
}> {
  const baseUrl = "https://api.trychroma.com";
  const tenant = process.env.CHROMA_TENANT!;
  const database = process.env.CHROMA_DATABASE!;
  const apiKey = process.env.CHROMA_API_KEY!;
  const collectionName = "reprally_products";

  const headers: Record<string, string> = {
    "X-Chroma-Token": apiKey,
    "Content-Type": "application/json",
  };

  // Get the collection (v2 API uses tenant/database in path)
  const colRes = await fetch(
    `${baseUrl}/api/v2/tenants/${encodeURIComponent(tenant)}/databases/${encodeURIComponent(database)}/collections/${encodeURIComponent(collectionName)}`,
    { headers }
  );

  if (!colRes.ok) {
    const errText = await colRes.text().catch(() => "");
    throw new Error(`Collection lookup failed: ${colRes.status} ${errText}`);
  }

  const colData = await colRes.json();
  const collectionId = colData.id;
  if (!collectionId) throw new Error("No collection ID returned");

  console.log(`[chroma] REST: collection ID = ${collectionId}`);

  // Paginate through documents
  const PAGE_SIZE = 100;
  const allIds: string[] = [];
  const allDocs: string[] = [];
  const allMetas: Record<string, any>[] = [];

  for (let offset = 0; offset < total; offset += PAGE_SIZE) {
    const body = {
      include: ["documents", "metadatas"],
      limit: PAGE_SIZE,
      offset,
    };

    const getRes = await fetch(
      `${baseUrl}/api/v2/tenants/${encodeURIComponent(tenant)}/databases/${encodeURIComponent(database)}/collections/${encodeURIComponent(collectionId)}/get`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }
    );

    if (!getRes.ok) {
      const errText = await getRes.text().catch(() => "");
      throw new Error(`GET offset=${offset} failed: ${getRes.status} ${errText}`);
    }

    const pageData = await getRes.json();
    const pageIds = pageData.ids || [];
    allIds.push(...pageIds);
    allDocs.push(...(pageData.documents || []));
    allMetas.push(...(pageData.metadatas || []));

    console.log(`[chroma] REST: page offset=${offset} → ${pageIds.length} docs (total so far: ${allIds.length})`);

    if (pageIds.length < PAGE_SIZE) break;
  }

  return { ids: allIds, documents: allDocs, metadatas: allMetas };
}

export async function getProductCount(): Promise<number> {
  const chroma = getClient();
  const collection = await chroma.getCollection({
    name: "reprally_products",
    embeddingFunction: noopEmbedding,
  });
  return collection.count();
}
