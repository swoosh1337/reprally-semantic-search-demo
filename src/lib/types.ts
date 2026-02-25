// ---------------------------------------------------------------------------
// Store Intel types
// ---------------------------------------------------------------------------

export type StoreType =
  | "convenience"
  | "tobacco_smoke"
  | "liquor"
  | "grocery"
  | "gas"
  | "foodservice"
  | "gym"
  | "other";

export type StoreSize = "small" | "medium" | "large" | "xlarge";
export type PriceMix = "budget" | "midrange" | "premium";
export type BrandMix = "commodities" | "mixed" | "premium";
export type Level = "low" | "medium" | "high";
export type ShelfSpace = "limited" | "moderate" | "plenty";
export type Budget = "tight" | "moderate" | "flexible";

export interface StoreProfile {
  storeType: StoreType;
  storeSize: StoreSize;
  priceMix: PriceMix;
  brandMix: BrandMix;
}

export interface StoreAssessment {
  condition: number; // 1-5
  displayQuality: number; // 1-5
  stockLevels: Level;
  footTraffic: Level;
  ownerEngagement: Level;
  notes: string;
}

export interface OwnerConversation {
  shelfSpace: ShelfSpace;
  categoriesOfInterest: string[];
  priceRangeMin: number;
  priceRangeMax: number;
  budget: Budget;
  ownerComments: string;
}

export interface StoreVisitData {
  profile: StoreProfile;
  assessment: StoreAssessment;
  conversation: OwnerConversation;
}

// ---------------------------------------------------------------------------
// Product / Search types
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: number;
  name: string;
  brandName: string;
  category: string;
  media: string;
  tags: string;
  isNicotine: boolean;
  isECig: boolean;
  wholesalePrice?: number;
  msrp?: number;
  margin?: number;
  similarity: number;
  document: string;
}

export interface RecommendationGroup {
  title: string;
  rationale: string;
  searchQuery: string;
  products: SearchResult[];
}

export interface ShelfAnalysis {
  productsIdentified: string[];
  gaps: string[];
  opportunities: string[];
  overallAssessment: string;
}

// ---------------------------------------------------------------------------
// Gap / Opportunity detail (clickable chips in shelf analysis)
// ---------------------------------------------------------------------------

export interface GapDetail {
  label: string;
  type: "gap" | "opportunity";
  reasoning: string;
  salesPitch: string;
  products: SearchResult[];
}
