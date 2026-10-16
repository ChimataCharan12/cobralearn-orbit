import { useEffect, useState } from "react";
import {
  X,
  Mail,
  User,
  Tag,
  CheckCircle,
  Archive,
  Trash2,
  Send,
  Clock,
  Lock,
  Loader2,
  CheckCircle2,
  CornerDownRight,
} from "lucide-react";
import {
  type ContactMessage,
  type ContactMessageReply,
  type MessageStatus,
} from "@/lib/contact-data";
import { DeleteConfirmationModal } from "@/components/modals/DeleteConfirmationModal";
import { adminClient } from "@/lib/api/admin-client";
import { toast } from "sonner";

interface MessageDetailModalProps {
  message: ContactMessage | null;
  open: boolean;
  onClose: () => void;
  onUpdateStatus: (id: string, status: MessageStatus) => void;
  onDelete: (id: string) => void;
  onReplySent?: (messageId: string, reply: any) => void;
}

export function MessageDetailModal({
  message,
  open,
  onClose,
  onUpdateStatus,
  onDelete,
  onReplySent,
}: MessageDetailModalProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [replyHistory, setReplyHistory] = useState<ContactMessageReply[]>([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);

  useEffect(() => {
    if (message && open) {
      setIsReplying(false);
      setReplySubject(`Re: ${message.subject} — CobraLearn Innotechcore`);
      setReplyBody(
        `Hi ${message.fullName},\n\nThank you for reaching out to CobraLearn Innotechcore regarding "${message.subject}".\n\n\n\nBest regards,\nCobraLearn Innotechcore Team\n\n---\nOriginal Inquiry:\n"${message.message}"`
      );
      setIdempotencyKey(
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `reply-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      );

      // Initialize reply history from props or fetch from server
      if (Array.isArray(message.replies) && message.replies.length > 0) {
        setReplyHistory(message.replies);
      } else {
        setReplyHistory([]);
        setIsLoadingReplies(true);
        adminClient
          .listAdminContactMessageReplies(message.id)
          .then((res) => {
            if (res.success && Array.isArray(res.data)) {
              setReplyHistory(res.data);
            }
          })
          .catch(() => {})
          .finally(() => {
            setIsLoadingReplies(false);
          });
      }
    }
  }, [message, open]);

  if (!open || !message) return null;

  const formattedDate = new Date(message.createdAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const getStatusBadge = (status: MessageStatus) => {
    switch (status) {
      case "new":
        return (
          <span className="rounded-full border border-[#00ff87]/40 bg-[#00ff87]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#00ff87] shadow-[0_0_10px_rgba(0,255,135,0.2)] uppercase">
            New / Unread
          </span>
        );
      case "read":
        return (
          <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white/90 uppercase">
            Read
          </span>
        );
      case "replied":
        return (
          <span className="rounded-full border border-[#00d2ff]/40 bg-[#00d2ff]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#00d2ff] uppercase">
            Replied
          </span>
        );
      case "archived":
        return (
          <span className="rounded-full border border-[#f59e0b]/40 bg-[#f59e0b]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#fbbf24] uppercase">
            Archived
          </span>
        );
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSubject = replySubject.trim();
    const cleanBody = replyBody.trim();

    if (!cleanSubject) {
      toast.error("Reply subject is required.");
      return;
    }
    if (/[\r\n]/.test(cleanSubject)) {
      toast.error("Subject cannot contain newline characters.");
      return;
    }
    if (cleanBody.length < 10) {
      toast.error("Reply body must be at least 10 characters long.");
      return;
    }

    setIsSending(true);
    try {
      const res = await adminClient.sendAdminContactMessageReply({
        messageId: message.id,
        subject: cleanSubject,
        body: cleanBody,
        idempotencyKey,
      });

      if (res.success && res.data) {
        toast.success(`Email reply dispatched to ${message.email} via Resend.`);
        setIsReplying(false);
        if (res.data.reply) {
          setReplyHistory((prev) => [...prev, res.data.reply]);
        }
        onUpdateStatus(message.id, "replied");
        onReplySent?.(message.id, res.data.reply);
      } else {
        toast.error(res.error || "Failed to send email reply.");
      }
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred while sending reply.");
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteConfirm = () => {
    onDelete(message.id);
    setDeleteConfirmOpen(false);
    onClose();
    toast.success("Contact message permanently deleted.");
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
        <div
          className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-brand/35 bg-[#080d0a] shadow-[0_0_50px_rgba(0,0,0,0.9),0_0_25px_color-mix(in_oklab,var(--brand)_20%,transparent)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-brand/20 bg-[#0b120e] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl border border-brand/35 bg-brand/10 text-brand-bright">
                <Mail className="size-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-[16.5px] font-bold text-white tracking-wide">
                    Message Details
                  </h2>
                  {getStatusBadge(message.status)}
                </div>
                <p className="text-[11.5px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="size-3" />
                  <span>Received {formattedDate}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-brand/15 hover:text-foreground cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Sender details grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border border-brand/20 bg-background/50">
              <div>
                <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5 mb-1">
                  <User className="size-3 text-brand-bright" />
                  <span>Sender Full Name</span>
                </p>
                <p className="text-[13.5px] font-bold text-white">
                  {message.fullName}
                </p>
              </div>

              <div>
                <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5 mb-1">
                  <Mail className="size-3 text-brand-bright" />
                  <span>Email Address</span>
                </p>
                <p className="text-[13px] font-mono font-semibold text-brand-bright">
                  {message.email}
                </p>
              </div>
            </div>

            {/* Subject */}
            <div className="p-3 rounded-xl border border-brand/20 bg-background/40">
              <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5 mb-1">
                <Tag className="size-3 text-brand-bright" />
                <span>Subject / Category</span>
              </p>
              <p className="text-[13.5px] font-semibold text-white">
                {message.subject}
              </p>
            </div>

            {/* Full Message */}
            <div className="p-4 rounded-xl border border-brand/25 bg-[#020b06] shadow-inner space-y-2">
              <p className="text-[10.5px] uppercase tracking-wider text-[#00ff87] font-bold">
                Message Body
              </p>
              <p className="text-[13px] text-gray-200 leading-relaxed whitespace-pre-wrap">
                {message.message}
              </p>
            </div>

            {/* Read / Replied Audit Timestamps */}
            {(message.readAt || message.repliedAt) && (
              <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground pt-1 border-t border-brand/10">
                {message.readAt && (
                  <span>
                    Read: {new Date(message.readAt).toLocaleString()}
                  </span>
                )}
                {message.repliedAt && (
                  <span>
                    Replied: {new Date(message.repliedAt).toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {/* Chronological Reply History Section */}
            {replyHistory.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-brand/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-[12px] font-bold uppercase tracking-wider text-brand-bright flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5" />
                    <span>Durable Reply History ({replyHistory.length})</span>
                  </h3>
                  <span className="text-[10.5px] text-muted-foreground">
                    Chronological order
                  </span>
                </div>

                <div className="space-y-2.5">
                  {replyHistory.map((reply, idx) => (
                    <div
                      key={reply.id || idx}
                      className="rounded-xl border border-[#00d2ff]/25 bg-[#00171f]/50 p-3.5 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#00d2ff]/15 pb-2 text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-[#00d2ff]/20 px-1.5 py-0.5 font-bold text-[#00d2ff] uppercase text-[10px]">
                            {reply.provider?.toUpperCase() || "RESEND"}
                          </span>
                          <span className="text-white font-medium">
                            From: {reply.adminEmail}
                          </span>
                        </div>
                        <span className="text-muted-foreground">
                          {new Date(reply.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <p className="text-[12px] font-semibold text-white/95">
                        Subject: {reply.subject}
                      </p>

                      <p className="text-[12px] text-gray-300 leading-relaxed whitespace-pre-wrap rounded-lg bg-black/40 p-2.5 font-sans border border-white/5">
                        {reply.bodyText}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* In-Admin Reply Composer Form */}
            {isReplying && (
              <form
                onSubmit={handleSendReply}
                className="rounded-xl border border-brand/40 bg-[#041108] p-4.5 space-y-3.5 shadow-lg pt-4"
              >
                <div className="flex items-center justify-between border-b border-brand/20 pb-2.5">
                  <div className="flex items-center gap-2">
                    <CornerDownRight className="size-4 text-brand-bright" />
                    <h3 className="text-[13.5px] font-bold text-white tracking-wide">
                      Compose Email Reply
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-2 py-0.5 text-[10px] text-brand-bright">
                    <Lock className="size-3" />
                    <span>Locked Recipient (Anti-Relay)</span>
                  </div>
                </div>

                {/* Recipient verification banner */}
                <div className="rounded-lg border border-brand/20 bg-background/60 p-2.5 text-[12px] flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">To:</span>
                  <span className="font-mono text-white font-semibold">
                    {message.fullName} &lt;{message.email}&gt;
                  </span>
                </div>

                {/* Subject */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="reply-subject"
                      className="text-[11px] font-semibold text-white uppercase tracking-wider"
                    >
                      Subject
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                      {replySubject.length}/200
                    </span>
                  </div>
                  <input
                    id="reply-subject"
                    type="text"
                    maxLength={200}
                    value={replySubject}
                    onChange={(e) => setReplySubject(e.target.value.replace(/[\r\n]/g, ""))}
                    required
                    className="w-full rounded-lg border border-brand/25 bg-background/80 px-3 py-2 text-[13px] text-white focus:border-brand-bright focus:outline-none"
                    placeholder="Enter email subject"
                  />
                </div>

                {/* Message Body */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="reply-body"
                      className="text-[11px] font-semibold text-white uppercase tracking-wider"
                    >
                      Message Body (min 10 characters)
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                      {replyBody.length}/10,000
                    </span>
                  </div>
                  <textarea
                    id="reply-body"
                    rows={7}
                    maxLength={10000}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    required
                    className="w-full rounded-lg border border-brand/25 bg-background/80 px-3 py-2 text-[12.5px] text-white leading-relaxed focus:border-brand-bright focus:outline-none font-sans"
                    placeholder="Type your official reply here..."
                  />
                </div>

                {/* Composer Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => setIsReplying(false)}
                    className="rounded-lg border border-brand/20 bg-background/50 px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-white transition cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSending || replyBody.trim().length < 10 || !replySubject.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-brand-bright px-4 py-1.5 text-[12px] font-bold text-black shadow-[0_0_15px_var(--brand-bright)] hover:bg-brand-bright/90 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Sending via Resend...</span>
                      </>
                    ) : (
                      <>
                        <Send className="size-3.5" />
                        <span>Send Reply</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand/20 bg-[#0b120e] px-6 py-3.5">
            {/* Destructive / Status toggles */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-1.5 text-[12px] font-medium text-red-400 hover:bg-red-950/40 transition cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                <span>Delete</span>
              </button>

              {message.status !== "archived" ? (
                <button
                  type="button"
                  onClick={() => {
                    onUpdateStatus(message.id, "archived");
                    toast.success("Message moved to archive.");
                    onClose();
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-brand/20 bg-background/50 px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <Archive className="size-3.5" />
                  <span>Archive</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onUpdateStatus(message.id, "read");
                    toast.success("Message restored to inbox.");
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-brand/20 bg-background/50 px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <CheckCircle className="size-3.5" />
                  <span>Unarchive</span>
                </button>
              )}
            </div>

            {/* Status change / Reply toggle */}
            <div className="flex items-center gap-2">
              {message.status === "new" ? (
                <button
                  type="button"
                  onClick={() => {
                    onUpdateStatus(message.id, "read");
                    toast.success("Marked as read.");
                  }}
                  className="rounded-lg border border-brand/30 bg-brand/10 px-3 py-1.5 text-[12px] font-semibold text-brand-bright hover:bg-brand/20 transition cursor-pointer"
                >
                  Mark as Read
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onUpdateStatus(message.id, "new");
                    toast.info("Marked as unread.");
                  }}
                  className="rounded-lg border border-brand/20 bg-background/50 px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Mark Unread
                </button>
              )}

              {!isReplying && (
                <button
                  type="button"
                  onClick={() => setIsReplying(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-bright px-4 py-1.5 text-[12px] font-bold text-black shadow-[0_0_12px_var(--brand-bright)] hover:bg-brand-bright/90 transition cursor-pointer"
                >
                  <Send className="size-3.5" />
                  <span>Reply via Email</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={handleDeleteConfirm}
        itemType="Message"
        itemName={`From: ${message.fullName}`}
        itemDescription={`Subject: "${message.subject}"`}
      />
    </>
  );
}
