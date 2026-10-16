import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Search,
  X,
  Loader2,
  Folder,
  Globe,
  Megaphone,
  Award,
  Image as ImageIcon,
  Mail,
  Settings,
  AlertCircle,
  CornerDownLeft,
} from "lucide-react";
import { adminClient } from "@/lib/api/admin-client";
import type {
  GlobalSearchResponse,
  GlobalSearchResultItem,
  GlobalSearchCategory,
} from "@/lib/server/search-operations";

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_ICONS: Record<GlobalSearchCategory, React.ElementType> = {
  projects: Folder,
  websites: Globe,
  advertisements: Megaphone,
  awards: Award,
  media: ImageIcon,
  messages: Mail,
  settings: Settings,
};

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResponse, setSearchResponse] = useState<GlobalSearchResponse | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const querySequenceRef = useRef<number>(0);

  // Flatten items for keyboard navigation
  const allItems: GlobalSearchResultItem[] = searchResponse
    ? searchResponse.groups.flatMap((g) => g.items)
    : [];

  // Reset state when opening or closing
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setSearchResponse(null);
      setError(null);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle global keyboard shortcuts (Ctrl+K / Cmd+K / Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      } else if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Execute search with debounce and stale response cancellation
  const performSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResponse(null);
      setLoading(false);
      setError(null);
      setSelectedIndex(0);
      return;
    }

    const currentSeq = ++querySequenceRef.current;
    setLoading(true);
    setError(null);

    try {
      const res = await adminClient.globalSearch(trimmed);
      // Ignore stale response if user continued typing
      if (currentSeq !== querySequenceRef.current) return;

      if (res.success && res.data) {
        setSearchResponse(res.data);
        setSelectedIndex(0);
      } else {
        setError(res.error || "Failed to search admin resources");
        setSearchResponse(null);
      }
    } catch (err: unknown) {
      if (currentSeq !== querySequenceRef.current) return;
      setError(err instanceof Error ? err.message : "Search error occurred");
      setSearchResponse(null);
    } finally {
      if (currentSeq === querySequenceRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Debounced input watcher
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 200);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const handleSelectResult = (item: GlobalSearchResultItem) => {
    onClose();
    navigate({ to: item.url as any });
  };

  // Keyboard navigation within results
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (allItems.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % allItems.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (allItems.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + allItems.length) % allItems.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        handleSelectResult(allItems[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global Admin Search"
      data-testid="global-search-modal"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 md:p-20 bg-black/75 backdrop-blur-sm animate-in fade-in-0 duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-brand/25 bg-[#0e131f] shadow-2xl shadow-brand/10 text-foreground flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-brand/15 px-4 py-3.5 bg-black/30">
          <Search className="size-5 shrink-0 text-brand" />
          <input
            ref={inputRef}
            data-testid="global-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search projects, websites, media, settings, messages..."
            className="w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60"
          />
          {loading && (
            <Loader2
              data-testid="global-search-loading"
              className="size-4 shrink-0 animate-spin text-brand"
            />
          )}
          {query && !loading && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition"
              aria-label="Clear query"
            >
              <X className="size-4" />
            </button>
          )}
          <span className="shrink-0 flex items-center gap-1.5 pl-2 border-l border-white/10">
            <kbd className="rounded border border-brand/20 bg-brand/10 px-1.5 py-0.5 text-[10.5px] font-mono text-brand/90">
              ESC
            </kbd>
          </span>
        </div>

        {/* Results Container */}
        <div className="overflow-y-auto flex-1 p-3 space-y-4">
          {/* Minimum characters hint */}
          {query.trim().length < 2 && !loading && !error && (
            <div
              data-testid="global-search-hint"
              className="py-12 text-center text-sm text-muted-foreground space-y-1.5"
            >
              <p className="font-medium text-foreground/80">Search CobraLearn Admin</p>
              <p className="text-xs text-muted-foreground">
                Type at least 2 characters to search across projects, websites, media assets, inquiries, and settings.
              </p>
              <div className="pt-4 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/60">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-white/5 rounded border border-white/10">↑</kbd>
                  <kbd className="px-1 py-0.5 bg-white/5 rounded border border-white/10">↓</kbd> to navigate
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-white/5 rounded border border-white/10">Enter</kbd> to select
                </span>
              </div>
            </div>
          )}

          {/* Error State with Retry */}
          {error && (
            <div
              data-testid="global-search-error"
              className="p-6 text-center text-sm space-y-3"
            >
              <div className="inline-flex size-10 items-center justify-center rounded-full bg-red-500/10 text-red-400">
                <AlertCircle className="size-5" />
              </div>
              <p className="text-red-400 font-medium">{error}</p>
              <button
                type="button"
                onClick={() => performSearch(query)}
                className="px-3.5 py-1.5 text-xs rounded-lg bg-brand/20 text-brand border border-brand/30 hover:bg-brand/30 transition"
              >
                Retry Search
              </button>
            </div>
          )}

          {/* Empty Results State */}
          {query.trim().length >= 2 && !loading && !error && searchResponse && searchResponse.totalCount === 0 && (
            <div
              data-testid="global-search-empty"
              className="py-12 text-center text-sm text-muted-foreground space-y-2"
            >
              <p className="font-medium text-foreground">No matches found</p>
              <p className="text-xs text-muted-foreground">
                No items matching &ldquo;{query}&rdquo; were found across authorized CMS content and settings.
              </p>
            </div>
          )}

          {/* Grouped Results */}
          {searchResponse && searchResponse.totalCount > 0 && (
            <div className="space-y-4" data-testid="global-search-results">
              {searchResponse.groups.map((group) => {
                const IconComponent = CATEGORY_ICONS[group.category] || Folder;
                return (
                  <div key={group.category} className="space-y-1">
                    <div className="flex items-center gap-2 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/75">
                      <IconComponent className="size-3 text-brand/80" />
                      <span>{group.label}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground/50">
                        {group.items.length}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const itemIndex = allItems.findIndex((it) => it.id === item.id);
                        const isSelected = itemIndex === selectedIndex;

                        return (
                          <div
                            key={item.id}
                            data-testid={`search-item-${item.id}`}
                            onClick={() => handleSelectResult(item)}
                            onMouseEnter={() => setSelectedIndex(itemIndex)}
                            className={`group flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition text-left ${
                              isSelected
                                ? "bg-brand/15 text-foreground border border-brand/30"
                                : "hover:bg-white/5 text-foreground/90 border border-transparent"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-[13.5px] truncate">
                                  {item.title}
                                </span>
                                {item.badge && (
                                  <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded uppercase bg-brand/20 text-brand-bright">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {item.subtitle}
                              </p>
                            </div>

                            <CornerDownLeft
                              className={`size-3.5 shrink-0 transition ${
                                isSelected
                                  ? "text-brand-bright opacity-100"
                                  : "text-muted-foreground opacity-0 group-hover:opacity-60"
                              }`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="border-t border-brand/15 px-4 py-2.5 bg-black/40 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 bg-white/5 rounded border border-white/10 font-mono text-[10px]">
                ↑↓
              </kbd>{" "}
              Navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-white/5 rounded border border-white/10 font-mono text-[10px]">
                ↵
              </kbd>{" "}
              Open
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-white/5 rounded border border-white/10 font-mono text-[10px]">
                esc
              </kbd>{" "}
              Close
            </span>
          </div>
          {searchResponse && (
            <span className="text-[10.5px] text-muted-foreground/70">
              {searchResponse.totalCount} result{searchResponse.totalCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
