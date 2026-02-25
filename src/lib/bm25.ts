/**
 * BM25 + N-gram fuzzy search for hybrid search with typo tolerance.
 *
 * BM25 scores documents by:
 *   score = Σ IDF(term) * (TF * (k1+1)) / (TF + k1 * (1 - b + b * docLen/avgDocLen))
 *
 * N-gram fuzzy search uses character trigrams to match misspelled terms
 * against the corpus, providing typo tolerance as a complement to exact BM25.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const K1 = 1.5;
const B = 0.75;
const NGRAM_SIZE = 3;
const CACHE_TTL = 10 * 60 * 1000; // 10 min

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
  "as", "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "why", "how", "all", "both",
  "each", "few", "more", "most", "other", "some", "such", "no", "nor",
  "not", "only", "own", "same", "so", "than", "too", "very", "just",
  "and", "but", "or", "if", "while", "this", "that", "these", "those",
  "it", "its", "product", "brand", "category", "tags",
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BM25Index {
  docCount: number;
  avgDocLen: number;
  docLens: number[];
  docIds: string[];
  /** Term → document frequency */
  df: Map<string, number>;
  /** Per-document term frequencies */
  tfs: Map<string, number>[];
  /** N-gram → document frequency (for fuzzy matching) */
  ngramDf: Map<string, number>;
  /** Per-document n-gram frequencies (for fuzzy matching) */
  ngramTfs: Map<string, number>[];
}

// ---------------------------------------------------------------------------
// Tokenization & N-gram helpers
// ---------------------------------------------------------------------------

/** Lowercase, strip non-alphanumeric, remove stopwords, drop single-char tokens */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Generate character n-grams for a token (e.g. "fritos" → ["fri","rit","ito","tos"]) */
function toNgrams(token: string): string[] {
  if (token.length < NGRAM_SIZE) return [token];
  const ngrams: string[] = [];
  for (let i = 0; i <= token.length - NGRAM_SIZE; i++) {
    ngrams.push(token.slice(i, i + NGRAM_SIZE));
  }
  return ngrams;
}

// ---------------------------------------------------------------------------
// Shared BM25-style scorer
// ---------------------------------------------------------------------------

/**
 * Generic BM25-style scoring loop used by both exact and fuzzy search.
 * Decouples the scoring math from how terms are derived.
 */
function scoreDocs(
  index: BM25Index,
  queryTerms: string[],
  getDf: (term: string) => number,
  getTf: (docIdx: number, term: string) => number,
  tfCap?: number,
): { id: string; score: number }[] {
  const scores: { id: string; score: number }[] = [];

  for (let i = 0; i < index.docCount; i++) {
    let score = 0;
    const docLen = index.docLens[i];

    for (const term of queryTerms) {
      const termFreq = getTf(i, term);
      if (termFreq === 0) continue;

      const docFreq = getDf(term);
      const idf = Math.log(
        (index.docCount - docFreq + 0.5) / (docFreq + 0.5) + 1
      );
      const cappedTf = tfCap ? Math.min(termFreq, tfCap) : termFreq;
      const tfNorm =
        (cappedTf * (K1 + 1)) /
        (cappedTf + K1 * (1 - B + B * (docLen / index.avgDocLen)));

      score += idf * tfNorm;
    }

    if (score > 0) {
      scores.push({ id: index.docIds[i], score });
    }
  }

  scores.sort((a, b) => b.score - a.score);
  return scores;
}

// ---------------------------------------------------------------------------
// Index building
// ---------------------------------------------------------------------------

/** Build combined BM25 + n-gram index from document corpus */
export function buildIndex(docIds: string[], documents: string[]): BM25Index {
  const docCount = documents.length;
  const tfs: Map<string, number>[] = [];
  const ngramTfs: Map<string, number>[] = [];
  const docLens: number[] = [];
  const df = new Map<string, number>();
  const ngramDf = new Map<string, number>();

  let totalTokens = 0;

  for (let i = 0; i < docCount; i++) {
    const tokens = tokenize(documents[i] || "");
    docLens.push(tokens.length);
    totalTokens += tokens.length;

    // --- Exact term frequencies ---
    const tfMap = new Map<string, number>();
    const seenTerms = new Set<string>();

    for (const token of tokens) {
      tfMap.set(token, (tfMap.get(token) || 0) + 1);
      if (!seenTerms.has(token)) {
        seenTerms.add(token);
        df.set(token, (df.get(token) || 0) + 1);
      }
    }
    tfs.push(tfMap);

    // --- N-gram frequencies ---
    const ngMap = new Map<string, number>();
    const seenNgrams = new Set<string>();

    for (const token of tokens) {
      for (const ng of toNgrams(token)) {
        ngMap.set(ng, (ngMap.get(ng) || 0) + 1);
        if (!seenNgrams.has(ng)) {
          seenNgrams.add(ng);
          ngramDf.set(ng, (ngramDf.get(ng) || 0) + 1);
        }
      }
    }
    ngramTfs.push(ngMap);
  }

  return {
    docCount,
    avgDocLen: totalTokens / docCount,
    docLens,
    docIds,
    df,
    tfs,
    ngramDf,
    ngramTfs,
  };
}

// ---------------------------------------------------------------------------
// Search functions
// ---------------------------------------------------------------------------

/** Exact BM25 keyword search */
export function search(
  index: BM25Index,
  query: string,
  topK: number = 50,
): { id: string; score: number }[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  return scoreDocs(
    index,
    queryTokens,
    (term) => index.df.get(term) || 0,
    (docIdx, term) => index.tfs[docIdx].get(term) || 0,
  ).slice(0, topK);
}

/** Fuzzy n-gram search for typo tolerance */
export function fuzzySearch(
  index: BM25Index,
  query: string,
  topK: number = 50,
): { id: string; score: number }[] {
  const queryTokens = tokenize(query);
  const queryNgrams: string[] = [];
  for (const token of queryTokens) {
    queryNgrams.push(...toNgrams(token));
  }
  if (queryNgrams.length === 0) return [];

  return scoreDocs(
    index,
    queryNgrams,
    (ng) => index.ngramDf.get(ng) || 0,
    (docIdx, ng) => index.ngramTfs[docIdx].get(ng) || 0,
    3, // Cap TF to avoid over-weighting common n-grams
  ).slice(0, topK);
}

// ---------------------------------------------------------------------------
// Index cache
// ---------------------------------------------------------------------------

let cachedIndex: BM25Index | null = null;
let cacheTime = 0;

export function getCachedIndex(): BM25Index | null {
  if (cachedIndex && Date.now() - cacheTime < CACHE_TTL) {
    return cachedIndex;
  }
  return null;
}

export function setCachedIndex(index: BM25Index): void {
  cachedIndex = index;
  cacheTime = Date.now();
}
