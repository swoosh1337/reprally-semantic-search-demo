import { NextRequest, NextResponse } from "next/server";
import { generateProductSalesPitch } from "@/lib/gemini";
import type { StoreVisitData } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { product, storeData, groupContext } = body as {
      product: {
        name: string;
        brand: string;
        category: string;
        price: number;
        margin: number;
      };
      storeData: StoreVisitData;
      groupContext: string;
    };

    if (!product?.name || !storeData?.profile) {
      return NextResponse.json(
        { error: "Missing product or storeData" },
        { status: 400 },
      );
    }

    const startTime = Date.now();

    const pitch = await generateProductSalesPitch(
      product,
      storeData,
      groupContext,
    );

    const elapsed = Date.now() - startTime;
    console.log(
      `[product-pitch] "${product.name}" pitch generated in ${elapsed}ms`,
    );

    return NextResponse.json({
      reasoning: pitch.reasoning,
      salesPitch: pitch.salesPitch,
      elapsed_ms: elapsed,
    });
  } catch (err: any) {
    console.error("[product-pitch] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
