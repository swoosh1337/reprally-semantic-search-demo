import { ChromaClient, IncludeEnum, type IEmbeddingFunction } from "chromadb";

// No-op embedding function — we provide our own embeddings via OpenAI
const noopEmbedding: IEmbeddingFunction = {
  generate: async (texts: string[]) => texts.map(() => []),
};

let client: ChromaClient | null = null;

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
  const chroma = getClient();
  const collection = await chroma.getCollection({
    name: "reprally_products",
    embeddingFunction: noopEmbedding,
  });

  // Get all items (metadata only, no embeddings/documents)
  const results = await collection.get({
    include: [IncludeEnum.Metadatas],
  });

  const categorySet = new Set<string>();
  const brandSet = new Set<string>();

  for (const meta of results.metadatas || []) {
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

export async function getProductCount(): Promise<number> {
  const chroma = getClient();
  const collection = await chroma.getCollection({
    name: "reprally_products",
    embeddingFunction: noopEmbedding,
  });
  return collection.count();
}
