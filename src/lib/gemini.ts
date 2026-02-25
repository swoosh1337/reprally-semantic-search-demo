import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import type { StoreVisitData } from "@/lib/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/** Strip markdown code fences from Gemini output */
function stripFences(text: string): string {
  return text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
}

export interface QueryUnderstanding {
  semanticQuery: string;
  /** Typo-corrected version of the raw query (for BM25 keyword matching) */
  correctedQuery?: string;
  /** Sub-queries for vague/broad searches (multi-query expansion) */
  expandedQueries?: string[];
  filters: {
    category?: string;
    brand?: string;
    excludeBrand?: string;
    nicotine?: boolean;
    ecig?: boolean;
    maxPrice?: number;
    minPrice?: number;
    minMargin?: number;
  };
  explanation: string;
}

const SYSTEM_PROMPT = `You are a query preprocessor for a wholesale product search engine used by sales reps selling to convenience stores, gas stations, and small retailers.

Your job: take the user's raw search query and extract structured filters + a clean semantic query for embedding search.

Available product categories: Display, Food & Beverage, General, HBW, Health & Wellness, Kratom Extracts, Misc, Other, Pet Food, Smoke & Vape, alternative products, pantry, salty snacks, sweet snacks, candy & confections, beverages, jerky & meat snacks, bars & bites, nuts & trail mix, cookies & bakery, Snacks, Smoke

Available filter fields:
- category: must match one of the categories above exactly
- brand: RepRally vendor brand name (NOT consumer brands like "Red Bull" or "Prime" — those are product names, not brand names in our system)
- excludeBrand: brand to exclude
- nicotine: true/false — whether the product contains nicotine
- ecig: true/false — whether it's an e-cigarette/vape product
- maxPrice: max MSRP (retail price) in dollars
- minPrice: min MSRP in dollars
- minMargin: minimum margin percentage (0-100)

Rules:
1. Remove negations from the semantic query. "not like Prime" → exclude the concept, don't include "Prime" in the query
2. Extract price intent: "cheap" → maxPrice: 5, "affordable" → maxPrice: 8, "premium" → minPrice: 15, "luxury" → minPrice: 25
3. Extract margin intent: "high margin" → minMargin: 50, "good margin" → minMargin: 35
4. The semantic query should be CLEAN — only describe what the user WANTS, not what they don't want
5. Keep the semantic query focused on product type, use case, and attributes
6. If the user mentions "vape", "e-cig", set ecig: true. If they say "no nicotine", set nicotine: false
7. Don't set filters you're not confident about — leave them undefined
8. Fix obvious typos and misspellings. If the user's query contains typos, set correctedQuery to the FIXED version of their raw input. Examples: "frtios" → correctedQuery: "fritos", "enegry drnk" → correctedQuery: "energy drink", "choclate bars" → correctedQuery: "chocolate bars". The correctedQuery must contain the CORRECTED spelling, NOT the original misspelled input. If no typos are found, omit correctedQuery entirely.
9. If the query is VAGUE or BROAD — meaning it doesn't name a specific product type — generate 2-4 specific sub-queries in "expandedQueries". Each should target a distinct product category the user might want. Examples:
   - "stuff for summer" → ["cold beverages and energy drinks", "summer snacks and chips", "candy and gum impulse buys", "frozen treats"]
   - "good sellers" → ["popular salty snacks", "top selling beverages", "bestselling candy"]
   - "healthy options" → ["protein bars and health snacks", "functional beverages", "wellness supplements"]
   - "new items" → ["trending snacks", "new beverage brands", "recently added wellness products"]
   Do NOT generate expandedQueries for specific queries like "energy drinks", "chocolate bars", "fritos" — only for genuinely vague/broad queries where the user hasn't named a product type.

Respond with ONLY valid JSON, no markdown:
{
  "semanticQuery": "clean query for embedding",
  "correctedQuery": "spell-corrected version of raw input (ONLY if typos were found, otherwise omit)",
  "expandedQueries": ["sub-query 1", "sub-query 2"] // ONLY for vague queries, otherwise omit
  "filters": { ... },
  "explanation": "brief explanation of what you understood"
}`;

export async function preprocessQuery(
  rawQuery: string
): Promise<QueryUnderstanding> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: SYSTEM_PROMPT },
          { text: `User query: "${rawQuery}"` },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 500,
    },
  });

  const text = result.response.text().trim();
  const cleaned = stripFences(text);

  try {
    const parsed = JSON.parse(cleaned);
    return {
      semanticQuery: parsed.semanticQuery || rawQuery,
      correctedQuery: parsed.correctedQuery || undefined,
      expandedQueries: parsed.expandedQueries?.length ? parsed.expandedQueries : undefined,
      filters: parsed.filters || {},
      explanation: parsed.explanation || "",
    };
  } catch {
    // If Gemini returns invalid JSON, fall back to raw query
    console.error("[gemini] Failed to parse response:", text);
    return {
      semanticQuery: rawQuery,
      filters: {},
      explanation: "Could not parse query — using raw input",
    };
  }
}

/**
 * Re-rank products using Gemini Flash.
 * Takes the original query and candidate products, returns reordered IDs.
 */
export async function rerankProducts(
  query: string,
  candidates: { id: string; name: string; brand: string; category: string; price: number; margin: number; score: number }[],
  storeContext?: string,
): Promise<string[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const candidateList = candidates
    .map(
      (c, i) =>
        `${i + 1}. [${c.id}] ${c.name} | ${c.brand} | ${c.category} | $${c.price} MSRP | ${c.margin}% margin | score: ${c.score.toFixed(3)}`
    )
    .join("\n");

  const storeSection = storeContext
    ? `\nStore context (use this to boost products that fit the store):\n${storeContext}\n`
    : "";

  const prompt = `You are a product search re-ranker for a wholesale platform used by sales reps.

Given the user's search query and a list of candidate products (already roughly sorted by relevance), re-rank them to put the MOST relevant products first.

Consider:
- How well the product matches the user's intent
- Product name relevance (exact name matches should rank very high)
- Category fit
- Price/margin if the user mentioned price preferences
- The existing relevance score (don't completely ignore it)
${storeSection}
User query: "${query}"

Candidates:
${candidateList}

Return ONLY a JSON array of product IDs in the best order, most relevant first. Return ALL IDs.
Example: ["id1", "id2", "id3"]`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 1000 },
    });

    const text = result.response.text().trim();
    const ids = JSON.parse(stripFences(text));

    if (Array.isArray(ids) && ids.length > 0) {
      return ids.map(String);
    }
  } catch (err: any) {
    console.error("[gemini] Re-ranking failed:", err.message);
  }

  // Fallback: return original order
  return candidates.map((c) => c.id);
}

// ---------------------------------------------------------------------------
// Store Intel — recommendation query generation
// ---------------------------------------------------------------------------

interface RecommendationQuery {
  title: string;
  rationale: string;
  searchQuery: string;
  filters?: Record<string, any>;
}

/**
 * Generate personalized search queries based on store visit data.
 * Returns 3-5 targeted query groups that can be run through executeSearch.
 */
export async function generateRecommendationQueries(
  storeData: StoreVisitData,
): Promise<RecommendationQuery[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const { profile, assessment, conversation } = storeData;

  const prompt = `You are a wholesale product recommendation engine for sales reps visiting retail stores.

Given this store profile, generate 3-5 targeted product search queries that would be most valuable for this store. Each query should target a DIFFERENT product category or need.

Store Profile:
- Type: ${profile.storeType}
- Size: ${profile.storeSize}
- Price Mix: ${profile.priceMix}
- Brand Mix: ${profile.brandMix}

Assessment:
- Condition: ${assessment.condition}/5
- Display Quality: ${assessment.displayQuality}/5
- Stock Levels: ${assessment.stockLevels}
- Foot Traffic: ${assessment.footTraffic}
- Owner Engagement: ${assessment.ownerEngagement}
${assessment.notes ? `- Notes: "${assessment.notes}"` : ""}

Owner Conversation:
- Shelf Space: ${conversation.shelfSpace}
- Categories of Interest: ${conversation.categoriesOfInterest.length > 0 ? conversation.categoriesOfInterest.join(", ") : "not specified"}
- Price Range: $${conversation.priceRangeMin}-$${conversation.priceRangeMax} per unit
- Budget: ${conversation.budget}
${conversation.ownerComments ? `- Owner Comments: "${conversation.ownerComments}"` : ""}

Rules:
1. Each query should be a natural product search phrase (e.g. "high margin energy drinks", "premium chocolate bars for impulse buy")
2. Consider the store type: gas stations need impulse buys, smoke shops need vape/nicotine, grocery needs pantry items, etc.
3. Factor in the price mix: budget stores need low MSRP, premium stores need higher-end products
4. If stock levels are low, include restocking essentials
5. If the owner mentioned specific interests, prioritize those
6. If budget is tight, focus on high-margin items
7. Include filters where relevant (maxPrice, minMargin, category)
8. Make the title catchy and the rationale explain WHY these products fit this store

Respond with ONLY valid JSON array:
[
  {
    "title": "Group title",
    "rationale": "Why these products fit this store",
    "searchQuery": "natural search query",
    "filters": { "maxPrice": 10, "minMargin": 40 }
  }
]`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1500 },
    });

    const parsed = JSON.parse(stripFences(result.response.text()));
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((q: any) => ({
        title: String(q.title || ""),
        rationale: String(q.rationale || ""),
        searchQuery: String(q.searchQuery || ""),
        filters: q.filters || {},
      }));
    }
  } catch (err: any) {
    console.error("[gemini] Recommendation query generation failed:", err.message);
  }

  return [];
}

// ---------------------------------------------------------------------------
// Store Intel — shelf image analysis
// ---------------------------------------------------------------------------

interface ShelfAnalysisResult {
  shelfAnalysis: {
    productsIdentified: string[];
    gaps: string[];
    opportunities: string[];
    overallAssessment: string;
  };
  queryGroups: RecommendationQuery[];
}

/**
 * Analyze shelf photos with Gemini Vision and generate search queries.
 */
export async function analyzeShelfImages(
  images: { mimeType: string; data: string }[],
  storeData: StoreVisitData,
): Promise<ShelfAnalysisResult> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const { profile } = storeData;

  const parts: Part[] = [
    {
      text: `You are a wholesale product advisor analyzing store shelf photos for a sales rep.

The rep is visiting a ${profile.storeType} store (${profile.storeSize} size, ${profile.priceMix} price mix, ${profile.brandMix} brand mix).

Analyze the shelf photos below and:
1. Identify products/brands you can see on the shelves
2. Identify gaps — what product categories are missing or underrepresented
3. Identify opportunities — what products would sell well here based on what you see
4. Generate 3-5 search queries for products that would complement what's already on the shelves

Respond with ONLY valid JSON:
{
  "shelfAnalysis": {
    "productsIdentified": ["product/brand 1", "product/brand 2"],
    "gaps": ["missing category 1", "missing category 2"],
    "opportunities": ["opportunity 1", "opportunity 2"],
    "overallAssessment": "Brief assessment of the shelf"
  },
  "queryGroups": [
    {
      "title": "Group title",
      "rationale": "Why these products would work",
      "searchQuery": "search query",
      "filters": {}
    }
  ]
}`,
    },
    ...images.map(
      (img): Part => ({
        inlineData: { mimeType: img.mimeType, data: img.data },
      }),
    ),
  ];

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
    });

    const parsed = JSON.parse(stripFences(result.response.text()));
    return {
      shelfAnalysis: {
        productsIdentified: parsed.shelfAnalysis?.productsIdentified || [],
        gaps: parsed.shelfAnalysis?.gaps || [],
        opportunities: parsed.shelfAnalysis?.opportunities || [],
        overallAssessment:
          parsed.shelfAnalysis?.overallAssessment || "Analysis complete",
      },
      queryGroups: (parsed.queryGroups || []).map((q: any) => ({
        title: String(q.title || ""),
        rationale: String(q.rationale || ""),
        searchQuery: String(q.searchQuery || ""),
        filters: q.filters || {},
      })),
    };
  } catch (err: any) {
    console.error("[gemini] Shelf analysis failed:", err.message);
    return {
      shelfAnalysis: {
        productsIdentified: [],
        gaps: [],
        opportunities: [],
        overallAssessment: "Could not analyze shelf photos",
      },
      queryGroups: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Gap / Opportunity — sales pitch generation
// ---------------------------------------------------------------------------

interface GapSalesPitchResult {
  reasoning: string;
  salesPitch: string;
}

/**
 * Generate reasoning + sales pitch for a shelf gap or opportunity.
 * Tells the rep WHY this would sell well and gives them a script to pitch the owner.
 */
export async function generateGapSalesPitch(
  label: string,
  type: "gap" | "opportunity",
  storeData: StoreVisitData,
  products: { name: string; brand: string; price: number; margin: number }[],
): Promise<GapSalesPitchResult> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const { profile, assessment, conversation } = storeData;

  const productList = products
    .slice(0, 5)
    .map((p, i) => `${i + 1}. ${p.name} by ${p.brand} — $${p.price} MSRP, ${p.margin}% margin`)
    .join("\n");

  const prompt = `You are a wholesale sales coach helping a sales rep pitch products to a store owner.

The rep found a ${type === "gap" ? "GAP (missing product category)" : "OPPORTUNITY (product category that would sell well)"} on this store's shelves:
"${label}"

Store context:
- Type: ${profile.storeType}, Size: ${profile.storeSize}
- Price Mix: ${profile.priceMix}, Brand Mix: ${profile.brandMix}
- Foot Traffic: ${assessment.footTraffic}, Stock Levels: ${assessment.stockLevels}
- Owner Budget: ${conversation.budget}, Shelf Space: ${conversation.shelfSpace}
${conversation.ownerComments ? `- Owner said: "${conversation.ownerComments}"` : ""}

Top matching products from our catalog:
${productList}

Generate TWO things:

1. **reasoning**: 2-3 sentences explaining WHY adding "${label}" products would benefit this specific store. Reference the store type, foot traffic, and what's currently missing. Be specific and data-driven.

2. **salesPitch**: A short conversational script (2-3 sentences) the rep can say directly to the store owner. Make it natural, not salesy. Reference specific products and margins. Use "you" language.

Respond with ONLY valid JSON:
{
  "reasoning": "...",
  "salesPitch": "..."
}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
    });

    const parsed = JSON.parse(stripFences(result.response.text()));
    return {
      reasoning: String(parsed.reasoning || ""),
      salesPitch: String(parsed.salesPitch || ""),
    };
  } catch (err: any) {
    console.error("[gemini] Gap sales pitch failed:", err.message);
    return {
      reasoning: `Adding ${label} products could fill a gap in this ${profile.storeType} store and drive additional sales.`,
      salesPitch: `I noticed you don't have many ${label.toLowerCase()} options. We have some great products that could work well here — want me to show you a few?`,
    };
  }
}

// ---------------------------------------------------------------------------
// Product-level sales pitch (for individual product cards in shelf recs)
// ---------------------------------------------------------------------------

interface ProductSalesPitchResult {
  reasoning: string;
  salesPitch: string;
}

/**
 * Generate a sales pitch for a specific product in the context of a store.
 * Used when a rep clicks on an individual product card in shelf recommendations.
 */
export async function generateProductSalesPitch(
  product: { name: string; brand: string; category: string; price: number; margin: number },
  storeData: StoreVisitData,
  groupContext: string,
): Promise<ProductSalesPitchResult> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const { profile, assessment, conversation } = storeData;

  const prompt = `You are a wholesale sales coach helping a sales rep pitch a specific product to a store owner.

Product: ${product.name}
Brand: ${product.brand}
Category: ${product.category}
MSRP: $${product.price}
Margin: ${product.margin}%
Recommendation context: "${groupContext}"

Store:
- Type: ${profile.storeType}, Size: ${profile.storeSize}
- Price Mix: ${profile.priceMix}, Brand Mix: ${profile.brandMix}
- Foot Traffic: ${assessment.footTraffic}, Stock Levels: ${assessment.stockLevels}
- Owner Budget: ${conversation.budget}, Shelf Space: ${conversation.shelfSpace}
${conversation.ownerComments ? `- Owner said: "${conversation.ownerComments}"` : ""}

Generate TWO things:

1. **reasoning**: 2-3 sentences about why THIS SPECIFIC product is a great fit for this store. Reference the margin, price point vs store's price mix, and how it fits the store type. Be specific.

2. **salesPitch**: A short script (2-3 sentences) the rep can say to the owner about THIS product. Mention the product by name, reference the margin, and tie it to the store's needs. Natural and conversational.

Respond with ONLY valid JSON:
{
  "reasoning": "...",
  "salesPitch": "..."
}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 500 },
    });

    const parsed = JSON.parse(stripFences(result.response.text()));
    return {
      reasoning: String(parsed.reasoning || ""),
      salesPitch: String(parsed.salesPitch || ""),
    };
  } catch (err: any) {
    console.error("[gemini] Product sales pitch failed:", err.message);
    return {
      reasoning: `${product.name} by ${product.brand} at $${product.price} MSRP with ${product.margin}% margin is a solid pick for this ${profile.storeType} store.`,
      salesPitch: `Have you tried carrying ${product.name}? It's got a ${product.margin}% margin and fits well with what your customers are already buying.`,
    };
  }
}
