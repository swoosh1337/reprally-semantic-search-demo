"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package } from "lucide-react";
import { RRLogo } from "@/components/RRLogo";

const NAV_ITEMS = [
  { href: "/", label: "Search" },
  { href: "/store-intel", label: "Store Intel" },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
              <RRLogo size={20} fill="white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--text)]">
                RepRally
              </h1>
              <p className="text-xs text-[var(--text-muted)] -mt-0.5">
                AI Product Intelligence
              </p>
            </div>
          </div>

          <nav className="hidden sm:flex items-center gap-1 ml-4">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Mobile nav */}
          <nav className="flex sm:hidden items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden sm:flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Package className="w-3.5 h-3.5" />
            2,461 products indexed
          </div>
        </div>
      </div>
    </header>
  );
}
