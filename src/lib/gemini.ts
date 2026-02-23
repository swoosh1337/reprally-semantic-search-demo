import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface QueryUnderstanding {
  semanticQuery: string;
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

Respond with ONLY valid JSON, no markdown:
{
  "semanticQuery": "clean query for embedding",
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
      maxOutputTokens: 300,
    },
  });

  const text = result.response.text().trim();

  // Strip markdown code fences if present
  const cleaned = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");

  try {
    const parsed = JSON.parse(cleaned);
    return {
      semanticQuery: parsed.semanticQuery || rawQuery,
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
