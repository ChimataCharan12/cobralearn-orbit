import { createFileRoute, useNavigate, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { AdminHeader } from "@/components/dashboard/AdminHeader";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { MessagesBanner } from "@/components/contact/messages/MessagesBanner";
import { MessagesToolbar } from "@/components/contact/messages/MessagesToolbar";
import { MessagesTable } from "@/components/contact/messages/MessagesTable";
import { MessageDetailModal } from "@/components/contact/messages/MessageDetailModal";
import { MessagesEmptyState } from "@/components/contact/messages/MessagesEmptyState";
import { DeleteConfirmationModal } from "@/components/modals/DeleteConfirmationModal";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { type ContactMessage, type MessageStatus } from "@/lib/contact-data";
import { useAuthGuard } from "@/lib/auth/use-auth";
import { adminClient } from "@/lib/api/admin-client";

export const Route = createFileRoute("/admin/contact/messages")({
  staleTime: 0,
  shouldReload: true,
  loader: async () => {
    const res = await adminClient.listAdminContactMessages({ limit: 20, offset: 0, sortBy: "newest" });
    return {
      initialMessagesData:
        res.success && res.data
          ? res.data
          : {
              messages: [] as ContactMessage[],
              totalCount: 0,
              unreadCount: 0,
              counts: { all: 0, new: 0, read: 0, replied: 0, archived: 0 },
            },
      initialLoadError: res.success ? null : (res.error || "Failed to load messages from server"),
    };
  },
  head: () => ({
    meta: [
      { title: "Contact Messages — CobraLearn Innotechcore Admin" },
      {
        name: "description",
        content:
          "View and manage visitor inquiries submitted through the public Contact page.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ContactMessagesPage,
  errorComponent: MessagesRouteError,
});

function MessagesRouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div className="dash-bg flex min-h-screen w-full">
      <div data-sidebar-wrapper className="sticky top-0 hidden h-screen shrink-0 lg:block">
        <AdminSidebar />
      </div>
      <main className="min-w-0 flex-1 space-y-4 px-4 py-4 sm:px-6">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/30 bg-red-950/20 p-8 text-center backdrop-blur-xl mt-12">
          <div className="grid size-12 place-items-center rounded-xl border border-red-500/40 bg-red-950/40 text-red-400">
            <AlertCircle className="size-6" />
          </div>
          <h3 className="mt-3 font-display text-[16px] font-bold text-white">
            Messages Inbox Error
          </h3>
          <p className="mt-1 text-[12.5px] text-red-300 max-w-md">
            {error instanceof Error ? error.message : "An unexpected error occurred while loading messages."}
          </p>
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="mt-4 flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/15 px-3 py-1.5 text-[12px] font-semibold text-brand-bright hover:bg-brand/25 transition cursor-pointer"
          >
            <RefreshCw className="size-3.5" />
            <span>Retry</span>
          </button>
        </div>
      </main>
    </div>
  );
}

function normalizeServerMessage(m: any): ContactMessage {
  return {
    id: m.id,
    fullName: m.fullName,
    email: m.email,
    subject: m.subject,
    message: m.message,
    status: (m.status?.toLowerCase() as MessageStatus) || "new",
    createdAt: typeof m.createdAt === "string" ? m.createdAt : new Date(m.createdAt).toISOString(),
    readAt: m.readAt ? (typeof m.readAt === "string" ? m.readAt : new Date(m.readAt).toISOString()) : null,
    repliedAt: m.repliedAt ? (typeof m.repliedAt === "string" ? m.repliedAt : new Date(m.repliedAt).toISOString()) : null,
    notes: m.adminNotes || undefined,
  };
}

function ContactMessagesPage() {
  const router = useRouter();
  const { initialMessagesData, initialLoadError } = Route.useLoaderData();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Authentication Guard
  useAuthGuard();

  // Search, Filter, Sort & Pagination State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Messages Data & Status State
  const [messages, setMessages] = useState<ContactMessage[]>(() =>
    Array.isArray(initialMessagesData?.messages)
      ? initialMessagesData.messages.map(normalizeServerMessage)
      : []
  );
  const [totalCount, setTotalCount] = useState<number>(initialMessagesData?.totalCount ?? 0);
  const [counts, setCounts] = useState({
    all: initialMessagesData?.counts?.all ?? initialMessagesData?.totalCount ?? 0,
    new: initialMessagesData?.counts?.new ?? initialMessagesData?.unreadCount ?? 0,
    read: initialMessagesData?.counts?.read ?? 0,
    replied: initialMessagesData?.counts?.replied ?? 0,
    archived: initialMessagesData?.counts?.archived ?? 0,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(initialLoadError);

  // Modal states
  const [activeMessage, setActiveMessage] = useState<ContactMessage | null>(null);
  const [deleteTargetMessage, setDeleteTargetMessage] = useState<ContactMessage | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Debounce ref
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Core fetch operation directly backed by PostgreSQL
  const loadMessages = useCallback(
    async (overrideParams?: {
      search?: string;
      status?: string;
      sort?: string;
      page?: number;
      size?: number;
    }) => {
      setIsLoading(true);
      setErrorState(null);

      const sSearch = overrideParams?.search !== undefined ? overrideParams.search : searchQuery;
      const sStatus = overrideParams?.status !== undefined ? overrideParams.status : statusFilter;
      const sSort = overrideParams?.sort !== undefined ? overrideParams.sort : sortBy;
      const sPage = overrideParams?.page !== undefined ? overrideParams.page : currentPage;
      const sSize = overrideParams?.size !== undefined ? overrideParams.size : pageSize;

      try {
        const res = await adminClient.listAdminContactMessages({
          search: sSearch.trim() || undefined,
          status: sStatus !== "ALL" ? sStatus : undefined,
          sortBy: sSort,
          limit: sSize,
          offset: (sPage - 1) * sSize,
        });

        if (res.success && res.data) {
          const mapped = res.data.messages.map(normalizeServerMessage);
          setMessages(mapped);
          setTotalCount(res.data.totalCount);
          if (res.data.counts) {
            setCounts(res.data.counts);
          } else {
            setCounts((prev) => ({
              ...prev,
              all: res.data?.totalCount ?? prev.all,
              new: res.data?.unreadCount ?? prev.new,
            }));
          }
          setErrorState(null);
        } else {
          const err = res.error || "Failed to load messages from server";
          setErrorState(err);
          toast.error(err);
        }
      } catch (err: any) {
        const msg = err?.message || "An unexpected error occurred while loading messages";
        setErrorState(msg);
        toast.error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [searchQuery, statusFilter, sortBy, currentPage, pageSize]
  );

  // Handle Search Input Change with Debounce
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
    setSelectedIds([]);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      loadMessages({ search: val, page: 1 });
    }, 350);
  };

  // Handle Status Filter Change
  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
    setSelectedIds([]);
    loadMessages({ status, page: 1 });
  };

  // Handle Sort Change
  const handleSortByChange = (sort: string) => {
    setSortBy(sort);
    loadMessages({ sort });
  };

  // Handle Page Change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    setSelectedIds([]);
    loadMessages({ page: newPage });
  };

  // Handle Page Size Change
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    setSelectedIds([]);
    loadMessages({ size: newSize, page: 1 });
  };

  // Selection Handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const currentIds = messages.map((m) => m.id);
    const allSelected = currentIds.length > 0 && currentIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentIds])));
    }
  };

  // Message Actions (Server Backed)
  const handleViewMessage = async (message: ContactMessage) => {
    setActiveMessage(message);
    if (message.status === "new") {
      const res = await adminClient.updateAdminContactMessageStatus(message.id, "READ");
      if (res.success) {
        setMessages((prev) =>
          prev.map((m) => (m.id === message.id ? { ...m, status: "read", readAt: new Date().toISOString() } : m))
        );
        setActiveMessage((prev) => (prev && prev.id === message.id ? { ...prev, status: "read" } : prev));
        setCounts((prev) => ({
          ...prev,
          new: Math.max(0, prev.new - 1),
          read: prev.read + 1,
        }));
      }
    }
  };

  const handleUpdateStatus = async (id: string, status: MessageStatus) => {
    const res = await adminClient.updateAdminContactMessageStatus(id, status.toUpperCase());
    if (res.success) {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status } : m))
      );
      if (activeMessage && activeMessage.id === id) {
        setActiveMessage((prev) => (prev ? { ...prev, status } : null));
      }
      toast.success(`Message marked as ${status}.`);
      loadMessages();
    } else {
      toast.error(res.error || "Failed to update status.");
    }
  };

  const handleBulkAction = async (action: MessageStatus | "delete") => {
    if (action === "delete") {
      if (selectedIds.length > 0) {
        setBulkDeleteOpen(true);
      }
    } else {
      if (selectedIds.length === 0) return;
      const idsToUpdate = [...selectedIds];
      const res = await adminClient.bulkUpdateAdminContactMessagesStatus(idsToUpdate, action.toUpperCase());
      if (res.success) {
        setSelectedIds([]);
        toast.success(`Updated ${res.data?.updatedCount ?? idsToUpdate.length} messages to ${action}.`);
        loadMessages();
      } else {
        toast.error(res.error || "Failed to update messages status.");
      }
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const idsToDelete = [...selectedIds];
    setBulkDeleteOpen(false);
    const res = await adminClient.bulkDeleteAdminContactMessages(idsToDelete);
    if (res.success) {
      setSelectedIds([]);
      toast.success(`Deleted ${res.data?.deletedCount ?? idsToDelete.length} messages.`);
      loadMessages();
    } else {
      toast.error(res.error || "Failed to delete messages.");
    }
  };

  const handleDeleteSingle = async () => {
    if (!deleteTargetMessage) return;
    const target = deleteTargetMessage;
    setDeleteTargetMessage(null);
    const res = await adminClient.deleteAdminContactMessage(target.id);
    if (res.success) {
      setSelectedIds((prev) => prev.filter((item) => item !== target.id));
      if (activeMessage?.id === target.id) {
        setActiveMessage(null);
      }
      toast.success("Message permanently deleted.");
      loadMessages();
    } else {
      toast.error(res.error || "Failed to delete message.");
    }
  };

  const handleRefresh = async () => {
    setSelectedIds([]);
    await loadMessages();
    toast.info("Inbox refreshed from server.");
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="dash-bg flex min-h-screen w-full">
      {/* Desktop Sidebar */}
      <div data-sidebar-wrapper className="sticky top-0 hidden h-screen shrink-0 lg:block">
        <AdminSidebar />
      </div>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[268px] border-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AdminSidebar onNavigate={() => setMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <main className="min-w-0 flex-1 space-y-4 px-4 py-4 sm:px-6">
        {/* Top Header */}
        <AdminHeader
          onMenu={() => setMobileMenuOpen(true)}
          searchPlaceholder="Search inbox messages, senders, emails..."
          searchTerm={searchQuery}
          onSearchChange={handleSearchChange}
        />

        {/* Messages Banner with verified PostgreSQL counts */}
        <MessagesBanner counts={counts} />

        {/* Toolbar */}
        <MessagesToolbar
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          sortBy={sortBy}
          onSortByChange={handleSortByChange}
          counts={counts}
          onRefresh={handleRefresh}
        />

        {/* Bulk Action Bar if items selected */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-bright/40 bg-brand/15 p-3 text-[12.5px] animate-in fade-in duration-150">
            <span className="font-semibold text-brand-bright">
              {selectedIds.length} messages selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleBulkAction("read")}
                className="rounded-lg border border-brand/30 bg-background/70 px-2.5 py-1 text-[11.5px] font-medium text-foreground hover:text-brand-bright transition cursor-pointer"
              >
                Mark Read
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction("archived")}
                className="rounded-lg border border-brand/30 bg-background/70 px-2.5 py-1 text-[11.5px] font-medium text-foreground hover:text-amber-400 transition cursor-pointer"
              >
                Archive
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction("delete")}
                className="rounded-lg border border-red-500/30 bg-red-950/20 px-2.5 py-1 text-[11.5px] font-medium text-red-400 hover:bg-red-950/40 transition cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Error State with Retry Button */}
        {errorState ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/30 bg-red-950/20 p-8 text-center backdrop-blur-xl">
            <div className="grid size-12 place-items-center rounded-xl border border-red-500/40 bg-red-950/40 text-red-400">
              <AlertCircle className="size-6" />
            </div>
            <h3 className="mt-3 font-display text-[15px] font-bold text-white">
              Unable to load messages
            </h3>
            <p className="mt-1 text-[12.5px] text-red-300 max-w-md">
              {errorState}
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              className="mt-4 flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/15 px-3 py-1.5 text-[12px] font-semibold text-brand-bright hover:bg-brand/25 transition cursor-pointer"
            >
              <RefreshCw className="size-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : messages.length === 0 ? (
          /* Empty State */
          <MessagesEmptyState
            isFiltered={!!searchQuery.trim() || statusFilter !== "ALL"}
            onClearFilter={() => {
              setSearchQuery("");
              setStatusFilter("ALL");
              setCurrentPage(1);
              loadMessages({ search: "", status: "ALL", page: 1 });
            }}
          />
        ) : (
          /* Real PostgreSQL Messages Table with Pagination */
          <div className={isLoading ? "opacity-60 pointer-events-none transition-opacity" : "transition-opacity"}>
            <MessagesTable
              messages={messages}
              onView={handleViewMessage}
              onUpdateStatus={handleUpdateStatus}
              onDelete={setDeleteTargetMessage}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggleSelectAll={handleToggleSelectAll}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              pageSize={pageSize}
              onPageSizeChange={handlePageSizeChange}
              totalCount={totalCount}
            />
          </div>
        )}
      </main>

      {/* Message Detail Modal (Safely Renders Message Text) */}
      <MessageDetailModal
        message={activeMessage}
        open={!!activeMessage}
        onClose={() => setActiveMessage(null)}
        onUpdateStatus={handleUpdateStatus}
        onReplySent={() => {
          loadMessages();
        }}
        onDelete={async (id) => {
          const res = await adminClient.deleteAdminContactMessage(id);
          if (res.success) {
            setActiveMessage(null);
            setSelectedIds((prev) => prev.filter((item) => item !== id));
            toast.success("Message permanently deleted.");
            loadMessages();
          } else {
            toast.error(res.error || "Failed to delete message.");
          }
        }}
      />

      {/* Single Delete Confirmation Modal */}
      <DeleteConfirmationModal
        open={!!deleteTargetMessage}
        onOpenChange={(open) => !open && setDeleteTargetMessage(null)}
        onConfirm={handleDeleteSingle}
        itemType="Message"
        itemName={`From: ${deleteTargetMessage?.fullName}`}
        itemDescription={`Subject: "${deleteTargetMessage?.subject}"`}
      />

      {/* Bulk Delete Confirmation Modal */}
      <DeleteConfirmationModal
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={handleConfirmBulkDelete}
        itemType="Selected Messages"
        title={
          <>
            <span className="text-[#ef4444] drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]">
              Delete
            </span>{" "}
            {selectedIds.length} Messages?
          </>
        }
        description={`This action cannot be undone. This will permanently delete ${selectedIds.length} selected messages from the database.`}
        confirmLabel={`Delete ${selectedIds.length} Messages`}
      />

      <Toaster />
    </div>
  );
}
