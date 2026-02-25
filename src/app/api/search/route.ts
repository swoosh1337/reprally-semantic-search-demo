import { NextRequest, NextResponse } from "next/server";
import { executeSearch } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  const n = parseInt(request.nextUrl.searchParams.get("n") || "20");
  const useAI = request.nextUrl.searchParams.get("ai") !== "false";

  if (!query) {
    return NextResponse.json(
      { error: "Missing query parameter ?q=" },
      { status: 400 },
    );
  }

  try {
    const result = await executeSearch({
      query,
      n,
      useAI,
      filters: {
        category: request.nextUrl.searchParams.get("category"),
        brand: request.nextUrl.searchParams.get("brand"),
        excludeBrand: request.nextUrl.searchParams.get("excludeBrand"),
        nicotine: request.nextUrl.searchParams.get("nicotine"),
        ecig: request.nextUrl.searchParams.get("ecig"),
      },
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[search] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
