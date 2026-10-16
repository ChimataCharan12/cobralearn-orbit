import { useState } from "react";
import {
  Mail,
  Clock,
  Eye,
  Trash2,
  Archive,
  CheckCircle,
  Tag,
  Send,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { type ContactMessage, type MessageStatus } from "@/lib/contact-data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MessagesTableProps {
  messages: ContactMessage[];
  onView: (message: ContactMessage) => void;
  onUpdateStatus: (id: string, status: MessageStatus) => void;
  onDelete: (message: ContactMessage) => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  totalCount?: number;
}

export function MessagesTable({
  messages,
  onView,
  onUpdateStatus,
  onDelete,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  pageSize = 20,
  onPageSizeChange,
  totalCount,
}: MessagesTableProps) {
  const isAllSelected =
    messages.length > 0 && messages.every((m) => selectedIds.includes(m.id));

  const getStatusBadge = (status: MessageStatus) => {
    switch (status) {
      case "new":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#00ff87]/40 bg-[#00ff87]/15 px-2.5 py-0.5 text-[10.5px] font-bold text-[#00ff87] shadow-[0_0_8px_rgba(0,255,135,0.25)] uppercase">
            <span className="size-1.5 rounded-full bg-[#00ff87] animate-pulse" />
            New
          </span>
        );
      case "read":
        return (
          <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10.5px] font-semibold text-white/80 uppercase">
            Read
          </span>
        );
      case "replied":
        return (
          <span className="rounded-full border border-[#00d2ff]/40 bg-[#00d2ff]/15 px-2.5 py-0.5 text-[10.5px] font-bold text-[#00d2ff] uppercase">
            Replied
          </span>
        );
      case "archived":
        return (
          <span className="rounded-full border border-[#f59e0b]/40 bg-[#f59e0b]/15 px-2.5 py-0.5 text-[10.5px] font-semibold text-[#fbbf24] uppercase">
            Archived
          </span>
        );
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-brand/25 bg-panel/85 backdrop-blur-xl shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12.5px]">
          {/* Table Header */}
          <thead className="border-b border-brand/20 bg-[#0b120e] text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-3.5 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={onToggleSelectAll}
                  className="rounded border-brand/30 bg-background accent-brand-bright cursor-pointer"
                />
              </th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5">Sender</th>
              <th className="px-4 py-3.5">Subject & Preview</th>
              <th className="px-4 py-3.5">Received</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-brand/10">
            {messages.map((message) => {
              const isSelected = selectedIds.includes(message.id);
              const isNew = message.status === "new";

              const formattedDate = new Date(message.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              return (
                <tr
                  key={message.id}
                  onClick={() => onView(message)}
                  className={`group cursor-pointer transition-colors ${
                    isNew
                      ? "bg-brand/5 hover:bg-brand/10 font-medium"
                      : "hover:bg-background/40"
                  } ${isSelected ? "bg-brand/15" : ""}`}
                >
                  {/* Checkbox */}
                  <td
                    className="px-4 py-3.5 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(message.id)}
                      className="rounded border-brand/30 bg-background accent-brand-bright cursor-pointer"
                    />
                  </td>

                  {/* Status Badge */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {getStatusBadge(message.status)}
                  </td>

                  {/* Sender Info */}
                  <td className="px-4 py-3.5">
                    <div>
                      <p className="font-bold text-white leading-tight">
                        {message.fullName}
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground truncate max-w-[180px]">
                        {message.email}
                      </p>
                    </div>
                  </td>

                  {/* Subject & Snippet */}
                  <td className="px-4 py-3.5 max-w-md">
                    <div>
                      <p className="font-semibold text-brand-bright truncate">
                        {message.subject}
                      </p>
                      <p className="text-[11.5px] text-[#94a3b8] line-clamp-1 mt-0.5">
                        {message.message}
                      </p>
                    </div>
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground text-[11.5px] font-mono">
                    {formattedDate}
                  </td>

                  {/* Actions */}
                  <td
                    className="px-4 py-3.5 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onView(message)}
                        className="grid size-8 place-items-center rounded-lg border border-brand/20 bg-background/50 text-muted-foreground hover:border-brand-bright/40 hover:text-foreground transition cursor-pointer"
                        title="View Message"
                      >
                        <Eye className="size-3.5" />
                      </button>

                      {message.status !== "archived" ? (
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(message.id, "archived")}
                          className="grid size-8 place-items-center rounded-lg border border-brand/20 bg-background/50 text-muted-foreground hover:text-amber-400 transition cursor-pointer"
                          title="Archive"
                        >
                          <Archive className="size-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(message.id, "read")}
                          className="grid size-8 place-items-center rounded-lg border border-brand/20 bg-background/50 text-muted-foreground hover:text-brand-bright transition cursor-pointer"
                          title="Restore to Inbox"
                        >
                          <CheckCircle className="size-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onDelete(message)}
                        className="grid size-8 place-items-center rounded-lg border border-red-500/20 bg-background/50 text-muted-foreground hover:border-red-500/40 hover:text-red-400 transition cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages !== undefined && totalPages > 0 && onPageChange && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand/20 bg-[#0b120e] px-4 py-3 text-[12px] text-muted-foreground">
          <div>
            Showing{" "}
            <span className="font-semibold text-white">
              {Math.min(((currentPage ?? 1) - 1) * (pageSize ?? 20) + 1, totalCount ?? messages.length)}–
              {Math.min((currentPage ?? 1) * (pageSize ?? 20), totalCount ?? messages.length)}
            </span>{" "}
            of <span className="font-semibold text-white">{totalCount ?? messages.length}</span> messages
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={(currentPage ?? 1) <= 1}
              onClick={() => onPageChange((currentPage ?? 1) - 1)}
              className="grid size-7 place-items-center rounded-lg border border-brand/20 text-muted-foreground hover:border-brand-bright hover:text-foreground disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="size-3.5" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`grid size-7 place-items-center rounded-lg text-[11.5px] font-semibold transition cursor-pointer ${
                  (currentPage ?? 1) === p
                    ? "border border-brand-bright/80 bg-brand/25 text-brand-bright shadow-[0_0_8px_var(--brand-bright)]"
                    : "border border-brand/20 text-muted-foreground hover:border-brand-bright hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}

            <button
              type="button"
              disabled={(currentPage ?? 1) >= totalPages}
              onClick={() => onPageChange((currentPage ?? 1) + 1)}
              className="grid size-7 place-items-center rounded-lg border border-brand/20 text-muted-foreground hover:border-brand-bright hover:text-foreground disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="size-3.5" />
            </button>

            {onPageSizeChange && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="ml-2 flex items-center gap-1 rounded-lg border border-brand/20 bg-background/50 px-2.5 py-1 text-[11.5px] font-medium text-foreground hover:border-brand-bright cursor-pointer"
                  >
                    {pageSize ?? 20} / page <ChevronDown className="size-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="border-brand/30 bg-[#080d0a] text-foreground backdrop-blur-xl">
                  {[10, 20, 50].map((size) => (
                    <DropdownMenuItem key={size} onClick={() => onPageSizeChange(size)} className="cursor-pointer">
                      {size} / page
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
