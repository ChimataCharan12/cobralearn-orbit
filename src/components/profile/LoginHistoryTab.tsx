import { useState, useEffect, useCallback } from "react";
import {
  History,
  ShieldCheck,
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  Loader2,
  RotateCcw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { adminClient } from "@/lib/api/admin-client";
import type { AdminLoginHistory } from "@prisma/client";

interface LoginHistoryTabProps {
  currentProfileId?: string | undefined;
}

export function LoginHistoryTab({ currentProfileId }: LoginHistoryTabProps) {
  const [items, setItems] = useState<AdminLoginHistory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pageSize = 10;

  const fetchHistory = useCallback(async (targetPage: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await adminClient.getSelfLoginHistory({
        page: targetPage,
        limit: pageSize,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to load login history records.");
      }

      setItems(response.data.items);
      setTotal(response.data.total);
      setPage(response.data.page);
      setTotalPages(response.data.totalPages);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    fetchHistory(page);
  }, [fetchHistory, page]);

  function getDeviceIcon(deviceType: string | null) {
    const type = deviceType?.toLowerCase();
    if (type === "mobile") return Smartphone;
    if (type === "tablet") return Tablet;
    if (type === "desktop") return Laptop;
    return Monitor;
  }

  return (
    <div className="space-y-6">
      {/* Overview & Security Context Card */}
      <div className="card-interactive rounded-2xl border border-brand/20 bg-panel/85 p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-brand/10 border border-brand/20 text-brand-bright">
                <History className="size-4" />
              </div>
              <h2 className="font-display text-lg font-bold text-foreground">Admin Login History</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Historical log of successful authentications for your administrator account.
              Each entry is server-verified and deduplicated by session.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchHistory(page)}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-brand/25 bg-background/60 px-3 py-1.5 text-xs font-medium text-foreground/80 hover:border-brand-bright/50 hover:bg-background/90 hover:text-foreground transition disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh Log</span>
            </button>
          </div>
        </div>

        {/* Security badges */}
        <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-brand/10 text-[11px]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/5 px-2.5 py-0.5 text-brand-bright">
            <ShieldCheck className="size-3" />
            Server-Controlled Identity
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/5 px-2.5 py-0.5 text-brand-bright">
            <CheckCircle2 className="size-3" />
            Session Deduplicated
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/20 px-2.5 py-0.5 text-muted-foreground">
            Audit Retention: SetNull
          </span>
        </div>
      </div>

      {/* Main Table / List Container */}
      <div className="card-interactive rounded-2xl border border-brand/20 bg-panel/85 p-6 shadow-xl backdrop-blur-md">
        {/* Loading State */}
        {isLoading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="size-8 animate-spin text-brand-bright mb-3" />
            <p className="text-sm font-medium text-foreground">Loading login records...</p>
            <p className="text-xs text-muted-foreground mt-1">Retrieving authentications from PostgreSQL</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-5 text-center">
            <AlertCircle className="size-6 text-destructive mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">{error}</p>
            <button
              type="button"
              onClick={() => fetchHistory(page)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-background/80 px-4 py-1.5 text-xs font-semibold text-brand-bright hover:bg-background cursor-pointer"
            >
              <RotateCcw className="size-3" />
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 border border-brand/20 text-brand-bright mb-3">
              <History className="size-6" />
            </div>
            <h3 className="font-display text-base font-bold text-foreground">No Historical Logins Recorded</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Your login events will appear here once authenticated sessions are completed.
            </p>
          </div>
        )}

        {/* Populated List */}
        {!error && items.length > 0 && (
          <div className="space-y-4">
            <div className="divide-y divide-brand/10 rounded-xl border border-brand/15 bg-background/40 overflow-hidden">
              {items.map((record) => {
                const DeviceIcon = getDeviceIcon(record.deviceType);
                const loginDate = new Date(record.loginAt);
                const formattedDate = format(loginDate, "MMM d, yyyy · h:mm:ss a");
                const relativeTime = formatDistanceToNow(loginDate, { addSuffix: true });

                return (
                  <div
                    key={record.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-brand/5 transition-colors"
                  >
                    {/* Left: Device & Browser info */}
                    <div className="flex items-start gap-3.5">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand-bright shadow-sm mt-0.5 sm:mt-0">
                        <DeviceIcon className="size-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-sans text-[13.5px] font-semibold text-foreground">
                            {record.browser && record.browser !== "Unknown" ? record.browser : "Unknown Browser"} on{" "}
                            {record.os && record.os !== "Unknown" ? record.os : "Unknown OS"}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10.5px] font-semibold text-brand-bright">
                            <CheckCircle2 className="size-3" />
                            Success
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="size-3 text-brand/70" />
                            {formattedDate}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-brand-bright/80 font-mono">
                            <Clock className="size-3" />
                            {relativeTime}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Device Category & Session info */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:text-right border-t border-brand/5 pt-2 sm:border-t-0 sm:pt-0">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-medium text-foreground/80 block">
                          {record.deviceType || "Desktop"} Client
                        </span>
                        {record.sessionId && (
                          <span className="text-[10px] text-muted-foreground font-mono block" title={record.sessionId}>
                            Session: {record.sessionId.slice(0, 8)}...{record.sessionId.slice(-4)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {(() => {
              const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
              const rangeEnd = Math.min(page * pageSize, total);
              return (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-brand/10 text-xs text-muted-foreground">
                  <div>
                    Showing <span className="font-semibold text-foreground">{rangeStart}–{rangeEnd}</span> of{" "}
                    <span className="font-semibold text-foreground">{total}</span> total logins
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs">
                      Page <span className="font-semibold text-foreground">{page}</span> of{" "}
                      <span className="font-semibold text-foreground">{totalPages}</span>
                    </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || isLoading}
                    className="inline-flex size-8 items-center justify-center rounded-lg border border-brand/20 bg-background/60 text-foreground hover:bg-brand/10 hover:border-brand/40 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="size-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || isLoading}
                    className="inline-flex size-8 items-center justify-center rounded-lg border border-brand/20 bg-background/60 text-foreground hover:bg-brand/10 hover:border-brand/40 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                    aria-label="Next page"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
