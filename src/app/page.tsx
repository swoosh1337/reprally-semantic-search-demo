"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Search,
  Sparkles,
  X,
  ArrowRight,
  Loader2,
  ChevronDown,
  Filter,
  RotateCcw,
  Brain,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ProductCard } from "@/components/ProductCard";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import type { SearchResult } from "@/lib/types";

interface AIUnderstanding {
  semanticQuery: string;
  expandedQueries?: string[];
  filters: Record<string, any>;
  explanation: string;
}

interface Filters {
  category: string;
  brand: string;
  excludeBrand: string;
  nicotine: string;
  ecig: string;
}

const EXAMPLE_QUERIES = [
  "high margin healthy snack for end aisle display",
  "CBD product for a wellness store",
  "cheap impulse buy candy for checkout counter",
  "energy drink for gas station near college",
  "premium pet treats for boutique shop",
  "vegan protein bar for gym",
  "nicotine alternative for smoke shop",
  "organic pantry items for natural grocery",
  "trending snacks for Gen Z customers",
  "premium chocolate for gift shop",
];

const DEFAULT_FILTERS: Filters = { category: "", brand: "", excludeBrand: "", nicotine: "", ecig: "" };

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [meta, setMeta] = useState<{
    query: string;
    count: number;
    elapsed_ms: number;
    filtersRelaxed?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<SearchResult | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [understanding, setUnderstanding] = useState<AIUnderstanding | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/filters")
      .then((res) => res.json())
      .then((data) => {
        setCategories(data.categories || []);
        setBrands(data.brands || []);
      })
      .catch(() => {});
  }, []);

  const activeFilterCount = [filters.category, filters.brand, filters.excludeBrand, filters.nicotine, filters.ecig].filter(Boolean).length;

  const handleSearch = useCallback(
    async (searchQuery?: string, searchFilters?: Filters) => {
      const q = searchQuery || query;
      if (!q.trim()) return;

      setLoading(true);
      setError(null);

      const f = searchFilters || filters;

      try {
        const params = new URLSearchParams({ q: q.trim(), n: "20" });
        if (f.category) params.set("category", f.category);
        if (f.brand) params.set("brand", f.brand);
        if (f.excludeBrand) params.set("excludeBrand", f.excludeBrand);
        if (f.nicotine) params.set("nicotine", f.nicotine);
        if (f.ecig) params.set("ecig", f.ecig);

        const res = await fetch(`/api/search?${params}`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setResults(data.products);
        setUnderstanding(data.understanding || null);
        setMeta({
          query: data.query,
          count: data.count,
          elapsed_ms: data.elapsed_ms,
          filtersRelaxed: data.filtersRelaxed,
        });
      } catch (err: any) {
        setError(err.message || "Search failed");
        setResults([]);
        setMeta(null);
      } finally {
        setLoading(false);
      }
    },
    [query, filters]
  );

  const handleExample = useCallback(
    (example: string) => {
      setQuery(example);
      handleSearch(example);
    },
    [handleSearch]
  );

  const clearSearch = useCallback(() => {
    setQuery("");
    setResults([]);
    setMeta(null);
    setError(null);
    inputRef.current?.focus();
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <AppHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Search Bar */}
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-sm)] p-2 flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-3">
            <Search className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Describe what the store needs..."
              className="flex-1 bg-transparent outline-none text-[var(--text)] placeholder:text-[var(--text-muted)] text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            {query && (
              <button
                onClick={clearSearch}
                className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={!query.trim() || loading}
            className="px-4 py-2.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-white text-sm font-medium flex items-center gap-2 transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            Search
          </button>
        </div>

        {/* Filter Toggle */}
        <div className="mt-3 flex items-center gap-2 px-1">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              activeFilterCount > 0
                ? "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]"
                : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:border-[var(--border)]"
            }`}
          >
            <Filter className="w-3 h-3" />
            Filters
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-[var(--accent)] text-white text-[10px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                resetFilters();
                if (meta) handleSearch(undefined, DEFAULT_FILTERS);
              }}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="mt-2 bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 animate-fade-in">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Category</label>
                <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border-subtle)] text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors">
                  <option value="">All categories</option>
                  {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Brand</label>
                <select value={filters.brand} onChange={(e) => setFilters({ ...filters, brand: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border-subtle)] text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors">
                  <option value="">All brands</option>
                  {brands.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Exclude Brand</label>
                <select value={filters.excludeBrand} onChange={(e) => setFilters({ ...filters, excludeBrand: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border-subtle)] text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors">
                  <option value="">None</option>
                  {brands.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Nicotine</label>
                <select value={filters.nicotine} onChange={(e) => setFilters({ ...filters, nicotine: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border-subtle)] text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors">
                  <option value="">Any</option>
                  <option value="true">Nicotine only</option>
                  <option value="false">Exclude nicotine</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">E-Cig / Vape</label>
                <select value={filters.ecig} onChange={(e) => setFilters({ ...filters, ecig: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border-subtle)] text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors">
                  <option value="">Any</option>
                  <option value="true">E-Cig only</option>
                  <option value="false">Exclude e-cig</option>
                </select>
              </div>
            </div>
            {meta && (
              <div className="mt-3 flex justify-end">
                <button onClick={() => handleSearch()} className="px-4 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-colors">
                  Apply Filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* AI Understanding Card */}
        {understanding && meta && (
          <div className="mt-3 bg-purple-50 border border-purple-200 rounded-xl p-3 animate-fade-in">
            <div className="flex items-start gap-2">
              <Brain className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-purple-700">{understanding.explanation}</p>
                {understanding.semanticQuery !== meta.query && (
                  <p className="text-[11px] text-purple-500 mt-1">
                    Searching: &ldquo;{understanding.semanticQuery}&rdquo;
                  </p>
                )}
                {Object.keys(understanding.filters).filter(k => understanding.filters[k] != null).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {Object.entries(understanding.filters).filter(([, v]) => v != null).map(([key, value]) => (
                      <span key={key} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-600">
                        {key}: {String(value)}
                      </span>
                    ))}
                  </div>
                )}
                {understanding.expandedQueries && understanding.expandedQueries.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span className="text-[10px] text-purple-400 self-center">Also searching:</span>
                    {understanding.expandedQueries.map((eq, i) => (
                      <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-500 border border-purple-200">
                        {eq}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] text-purple-400">
                  {meta.count} results &middot; {meta.elapsed_ms}ms
                </span>
                {meta.filtersRelaxed && (
                  <p className="text-[10px] text-amber-500 mt-0.5">Filters relaxed for more results</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Meta bar (when no AI understanding) */}
        {meta && !understanding && (
          <div className="mt-3 px-1 animate-fade-in">
            <p className="text-xs text-[var(--text-muted)]">
              {meta.count} results in {meta.elapsed_ms}ms
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-3 px-4 py-3 rounded-lg bg-[var(--error-bg)] text-[var(--error)] text-sm animate-fade-in">
            {error}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="mt-4 grid gap-3">
            {results.map((product, i) => (
              <ProductCard
                key={product.id}
                product={product}
                rank={i + 1}
                animationDelay={i * 30}
                onClick={setSelectedProduct}
              />
            ))}
          </div>
        )}

        {/* Empty state — Example queries */}
        {!meta && !loading && results.length === 0 && (
          <div className="mt-8">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3 px-1">
              Try these scenarios
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {EXAMPLE_QUERIES.map((example, i) => (
                <button
                  key={i}
                  onClick={() => handleExample(example)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] text-left text-sm text-[var(--text-secondary)] transition-all group"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                  <span className="group-hover:text-[var(--text)]">{example}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No results state */}
        {meta && results.length === 0 && !loading && (
          <div className="mt-12 text-center animate-fade-in">
            <Search className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-sm font-medium text-[var(--text)]">No results found</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Try a different description of what the store needs</p>
          </div>
        )}
      </main>

      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      <footer className="mt-12 pb-8 text-center text-xs text-[var(--text-muted)]">
        RepRally &middot; AI Product Intelligence
      </footer>
    </div>
  );
}
