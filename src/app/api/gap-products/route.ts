import { NextRequest, NextResponse } from "next/server";
import { generateGapSalesPitch } from "@/lib/gemini";
import { executeSearch } from "@/lib/search";
import type { StoreVisitData } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { label, type, storeData } = body as {
      label: string;
      type: "gap" | "opportunity";
      storeData: StoreVisitData;
    };

    if (!label || !storeData?.profile) {
      return NextResponse.json(
        { error: "Missing label or storeData" },
        { status: 400 },
      );
    }

    const startTime = Date.now();
    const storeContext = `${storeData.profile.storeType} store, ${storeData.profile.storeSize} size, ${storeData.profile.priceMix} price mix`;

    // 1. Search for products matching this gap/opportunity
    const searchResult = await executeSearch({
      query: label,
      n: 6,
      useAI: true,
      storeContext,
    });

    console.log(
      `[gap-products] Search for "${label}" returned ${searchResult.products.length} products`,
    );

    // 2. Generate reasoning + sales pitch with Gemini
    const productSummaries = searchResult.products.slice(0, 5).map((p) => ({
      name: p.name,
      brand: p.brandName,
      price: p.msrp || 0,
      margin: p.margin || 0,
    }));

    const pitch = await generateGapSalesPitch(
      label,
      type,
      storeData,
      productSummaries,
    );

    const elapsed = Date.now() - startTime;
    console.log(
      `[gap-products] "${label}" → ${searchResult.products.length} products + pitch in ${elapsed}ms`,
    );

    return NextResponse.json({
      label,
      type,
      reasoning: pitch.reasoning,
      salesPitch: pitch.salesPitch,
      products: searchResult.products,
      elapsed_ms: elapsed,
    });
  } catch (err: any) {
    console.error("[gap-products] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
