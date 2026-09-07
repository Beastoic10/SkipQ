"use client";

import { useState, useMemo, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { UniversitySummary } from "@/lib/customer/data";

type UniversitySearchSelectProps = {
  universities: UniversitySummary[];
};

function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getRecentStorageSnapshot(): string {
  try {
    const id = localStorage.getItem("skipq_last_university_id");
    const name = localStorage.getItem("skipq_last_university_name");
    return id && name ? `${id}:::${name}` : "";
  } catch {
    return "";
  }
}

function getRecentServerSnapshot(): string {
  return "";
}

export function UniversitySearchSelect({ universities }: UniversitySearchSelectProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  // Synchronize client storage safely across SSR hydration
  const recentRaw = useSyncExternalStore(
    subscribeToStorage,
    getRecentStorageSnapshot,
    getRecentServerSnapshot
  );

  const recentUniversity = useMemo(() => {
    if (!recentRaw) return null;
    const [id, name] = recentRaw.split(":::");
    if (id && name && universities.some((u) => u.id === id)) {
      return { id, name };
    }
    return null;
  }, [recentRaw, universities]);

  const filtered = useMemo(() => {
    if (!query.trim()) return universities;
    const q = query.toLowerCase().trim();
    return universities.filter(
      (u) => u.name.toLowerCase().includes(q) || u.slug.toLowerCase().includes(q)
    );
  }, [universities, query]);

  const handleSelect = (university: UniversitySummary) => {
    try {
      localStorage.setItem("skipq_last_university_id", university.id);
      localStorage.setItem("skipq_last_university_name", university.name);
      window.dispatchEvent(new Event("storage"));
    } catch {
      // Ignore local storage error
    }
    router.push(`/customer/cafeteria?universityId=${encodeURIComponent(university.id)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filtered.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0 && selectedIndex < filtered.length) {
        e.preventDefault();
        handleSelect(filtered[selectedIndex]);
      } else if (filtered.length === 1) {
        e.preventDefault();
        handleSelect(filtered[0]);
      }
    } else if (e.key === "Escape") {
      setQuery("");
      setSelectedIndex(-1);
    }
  };

  return (
    <div className="space-y-5">
      {/* Prominent Search Input */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-400">
          <svg className="h-5 w-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search your university or campus..."
          className="w-full rounded-2xl border border-zinc-200 bg-white py-3.5 pl-12 pr-10 text-base text-zinc-900 placeholder:text-zinc-400 shadow-sm transition outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 sm:text-sm"
          aria-label="Search universities"
          aria-autocomplete="list"
          autoFocus
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-zinc-600"
            aria-label="Clear search"
          >
            <svg className="h-5 w-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Quick-pick Recent University */}
      {!query && recentUniversity && (
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-zinc-400">Recently visited:</span>
          <button
            type="button"
            onClick={() => {
              const u = universities.find((x) => x.id === recentUniversity.id);
              if (u) handleSelect(u);
            }}
            className="group inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50/80 px-3 py-1 font-semibold text-orange-800 transition hover:border-orange-300 hover:bg-orange-100"
          >
            <span>{recentUniversity.name}</span>
            <span className="text-orange-500 transition-transform group-hover:translate-x-0.5">→</span>
          </button>
        </div>
      )}

      {/* University Count Header */}
      <div className="flex items-center justify-between px-1 text-xs font-semibold text-zinc-400">
        <span>{filtered.length} {filtered.length === 1 ? "campus available" : "campuses available"}</span>
        {query && <span>Press Enter to select</span>}
      </div>

      {/* Scalable List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center sm:p-10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-600">
            <svg className="h-6 w-6 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <h3 className="mt-3 text-base font-bold text-zinc-900">No universities found</h3>
          <p className="mt-1 text-xs text-zinc-500">
            We couldn&apos;t find any campus matching &ldquo;{query}&rdquo;. Check your spelling or clear the search.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="mt-4 inline-flex rounded-full bg-orange-50 px-4 py-2 text-xs font-bold text-orange-700 hover:bg-orange-100"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <ul
          ref={listRef}
          role="listbox"
          aria-label="Universities list"
          className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm"
        >
          {filtered.map((university, index) => {
            const isSelected = index === selectedIndex;
            return (
              <li
                key={university.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(university)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`group flex cursor-pointer items-center justify-between p-4 transition ${
                  isSelected ? "bg-orange-50/70" : "hover:bg-zinc-50"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold transition ${
                      isSelected
                        ? "bg-orange-600 text-white shadow-sm shadow-orange-600/30"
                        : "bg-zinc-100 text-zinc-600 group-hover:bg-orange-100 group-hover:text-orange-700"
                    }`}
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                      <path d="M6 12v5c3 3 9 3 12 0v-5" />
                    </svg>
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-bold text-zinc-950 truncate">
                      {university.name}
                    </div>
                    <div className="text-xs text-zinc-500">
                      Campus Cafeterias &amp; Live Menus
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pl-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                      isSelected
                        ? "bg-orange-600 text-white"
                        : "text-zinc-400 group-hover:text-orange-700"
                    }`}
                  >
                    <span>View cafeterias</span>
                    <span className="transition-transform group-hover:translate-x-0.5">→</span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
