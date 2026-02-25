"use client";

import { useReducer, useEffect, useState, useCallback } from "react";
import { ArrowLeft, ArrowRight, Sparkles, Camera, RotateCcw, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { WizardProgress } from "@/components/store-intel/WizardProgress";
import { StoreProfileStep } from "@/components/store-intel/StoreProfileStep";
import { QuickAssessmentStep } from "@/components/store-intel/QuickAssessmentStep";
import { OwnerConversationStep } from "@/components/store-intel/OwnerConversationStep";
import { ShelfScanStep } from "@/components/store-intel/ShelfScanStep";
import { RecommendationResults } from "@/components/store-intel/RecommendationResults";
import type {
  StoreProfile,
  StoreAssessment,
  OwnerConversation,
  RecommendationGroup,
  ShelfAnalysis,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface WizardState {
  step: number;
  profile: StoreProfile;
  assessment: StoreAssessment;
  conversation: OwnerConversation;
  images: string[];
  profileRecs: RecommendationGroup[];
  imageRecs: RecommendationGroup[];
  shelfAnalysis: ShelfAnalysis | null;
  loadingProfile: boolean;
  loadingImages: boolean;
  error: string | null;
}

type Action =
  | { type: "SET_STEP"; step: number }
  | { type: "SET_PROFILE"; profile: StoreProfile }
  | { type: "SET_ASSESSMENT"; assessment: StoreAssessment }
  | { type: "SET_CONVERSATION"; conversation: OwnerConversation }
  | { type: "SET_IMAGES"; images: string[] }
  | { type: "SET_PROFILE_RECS"; recs: RecommendationGroup[] }
  | { type: "SET_IMAGE_RECS"; recs: RecommendationGroup[]; analysis: ShelfAnalysis | null }
  | { type: "SET_LOADING_PROFILE"; loading: boolean }
  | { type: "SET_LOADING_IMAGES"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "RESET" };

const initialState: WizardState = {
  step: 1,
  profile: {
    storeType: "convenience",
    storeSize: "medium",
    priceMix: "midrange",
    brandMix: "mixed",
  },
  assessment: {
    condition: 3,
    displayQuality: 3,
    stockLevels: "medium",
    footTraffic: "medium",
    ownerEngagement: "medium",
    notes: "",
  },
  conversation: {
    shelfSpace: "moderate",
    categoriesOfInterest: [],
    priceRangeMin: 0,
    priceRangeMax: 50,
    budget: "moderate",
    ownerComments: "",
  },
  images: [],
  profileRecs: [],
  imageRecs: [],
  shelfAnalysis: null,
  loadingProfile: false,
  loadingImages: false,
  error: null,
};

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step, error: null };
    case "SET_PROFILE":
      return { ...state, profile: action.profile };
    case "SET_ASSESSMENT":
      return { ...state, assessment: action.assessment };
    case "SET_CONVERSATION":
      return { ...state, conversation: action.conversation };
    case "SET_IMAGES":
      return { ...state, images: action.images };
    case "SET_PROFILE_RECS":
      return { ...state, profileRecs: action.recs, loadingProfile: false };
    case "SET_IMAGE_RECS":
      return {
        ...state,
        imageRecs: action.recs,
        shelfAnalysis: action.analysis,
        loadingImages: false,
      };
    case "SET_LOADING_PROFILE":
      return { ...state, loadingProfile: action.loading };
    case "SET_LOADING_IMAGES":
      return { ...state, loadingImages: action.loading };
    case "SET_ERROR":
      return {
        ...state,
        error: action.error,
        // Only reset loading flags when there's an actual error
        ...(action.error ? { loadingProfile: false, loadingImages: false } : {}),
      };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Step titles & descriptions
// ---------------------------------------------------------------------------

const STEP_INFO: Record<number, { title: string; description: string }> = {
  1: {
    title: "Store Profile",
    description: "Tell us about the store you're visiting.",
  },
  2: {
    title: "Quick Assessment",
    description: "Rate the store's current conditions.",
  },
  3: {
    title: "Owner Conversation",
    description: "What did the owner tell you?",
  },
  4: {
    title: "Scan Shelves",
    description: "Photograph the shelves for AI analysis.",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StoreIntelPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/filters")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories || []))
      .catch(() => {});
  }, []);

  const { step } = state;
  const info = STEP_INFO[step];

  const goNext = useCallback(() => {
    if (step < 4) dispatch({ type: "SET_STEP", step: step + 1 });
  }, [step]);

  const goBack = useCallback(() => {
    if (step > 1) dispatch({ type: "SET_STEP", step: step - 1 });
  }, [step]);

  const getProfileRecommendations = useCallback(async () => {
    dispatch({ type: "SET_LOADING_PROFILE", loading: true });
    dispatch({ type: "SET_ERROR", error: null });

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: state.profile,
          assessment: state.assessment,
          conversation: state.conversation,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      dispatch({ type: "SET_PROFILE_RECS", recs: data.groups || [] });
    } catch (err: any) {
      dispatch({ type: "SET_ERROR", error: err.message || "Failed to get recommendations" });
    }
  }, [state.profile, state.assessment, state.conversation]);

  const analyzeShelfImages = useCallback(async () => {
    if (state.images.length === 0) return;

    dispatch({ type: "SET_LOADING_IMAGES", loading: true });
    dispatch({ type: "SET_ERROR", error: null });

    try {
      const res = await fetch("/api/analyze-shelves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: state.images,
          storeData: {
            profile: state.profile,
            assessment: state.assessment,
            conversation: state.conversation,
          },
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      dispatch({
        type: "SET_IMAGE_RECS",
        recs: data.recommendations || [],
        analysis: data.shelfAnalysis || null,
      });
    } catch (err: any) {
      dispatch({ type: "SET_ERROR", error: err.message || "Failed to analyze shelves" });
    }
  }, [state.images, state.profile, state.assessment, state.conversation]);

  const hasProfileRecs = state.profileRecs.length > 0;
  const hasImageRecs = state.imageRecs.length > 0;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <AppHeader />

      <main className="max-w-[720px] mx-auto px-4 sm:px-6 py-6">
        {/* Progress */}
        <div className="flex items-center justify-between mb-6">
          <WizardProgress currentStep={step} />
          <button
            onClick={() => dispatch({ type: "RESET" })}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>

        {/* Step Card */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] p-5 sm:p-6 animate-fade-in">
          {/* Step header */}
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-[var(--text)]">
              {info.title}
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              {info.description}
            </p>
          </div>

          {/* Step content */}
          {step === 1 && (
            <StoreProfileStep
              value={state.profile}
              onChange={(p) => dispatch({ type: "SET_PROFILE", profile: p })}
            />
          )}
          {step === 2 && (
            <QuickAssessmentStep
              value={state.assessment}
              onChange={(a) => dispatch({ type: "SET_ASSESSMENT", assessment: a })}
            />
          )}
          {step === 3 && (
            <OwnerConversationStep
              value={state.conversation}
              onChange={(c) => dispatch({ type: "SET_CONVERSATION", conversation: c })}
              categories={categories}
            />
          )}
          {step === 4 && (
            <ShelfScanStep
              images={state.images}
              onChange={(imgs) => dispatch({ type: "SET_IMAGES", images: imgs })}
            />
          )}

          {/* Error */}
          {state.error && (
            <div className="mt-4 px-4 py-3 rounded-lg bg-[var(--error-bg)] text-[var(--error)] text-sm animate-fade-in">
              {state.error}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={goBack}
              disabled={step === 1}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-0 transition-all inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex items-center gap-2">
              {/* Get Recommendations on Step 3 */}
              {step === 3 && (
                <button
                  onClick={getProfileRecommendations}
                  disabled={state.loadingProfile}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-medium transition-colors inline-flex items-center gap-1.5"
                >
                  {state.loadingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Get Recommendations
                    </>
                  )}
                </button>
              )}

              {/* Analyze on Step 4 */}
              {step === 4 && state.images.length > 0 && (
                <button
                  onClick={analyzeShelfImages}
                  disabled={state.loadingImages}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors inline-flex items-center gap-1.5"
                >
                  {state.loadingImages ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Scanning…
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      Analyze Shelves
                    </>
                  )}
                </button>
              )}

              {/* Next */}
              {step < 4 && (
                <button
                  onClick={goNext}
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors inline-flex items-center gap-1.5"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Image-based Recommendations (shown first when available) */}
        {(hasImageRecs || state.loadingImages) && (
          <div className="mt-6">
            <RecommendationResults
              groups={state.imageRecs}
              shelfAnalysis={state.shelfAnalysis}
              loading={state.loadingImages}
              label="Shelf-Based Recommendations"
              storeData={{
                profile: state.profile,
                assessment: state.assessment,
                conversation: state.conversation,
              }}
            />
          </div>
        )}

        {/* Profile-based Recommendations */}
        {(hasProfileRecs || state.loadingProfile) && (
          <div className="mt-6">
            <RecommendationResults
              groups={state.profileRecs}
              loading={state.loadingProfile}
              label="Store Recommendations"
            />
          </div>
        )}
      </main>

      <footer className="mt-12 pb-8 text-center text-xs text-[var(--text-muted)]">
        RepRally &middot; AI Product Intelligence
      </footer>
    </div>
  );
}
