import { Link } from "@tanstack/react-router";
import { ArrowLeft, Inbox, ChevronRight } from "lucide-react";
import { useContactMessages } from "@/lib/contact-store";

interface MessagesBannerProps {
  counts?: {
    all: number;
    new: number;
    read: number;
    replied: number;
    archived: number;
  };
}

export function MessagesBanner({ counts: customCounts }: MessagesBannerProps = {}) {
  const { messages } = useContactMessages();

  const total = customCounts?.all ?? messages.length;
  const newCount = customCounts?.new ?? messages.filter((m) => m.status === "new").length;
  const repliedCount = customCounts?.replied ?? messages.filter((m) => m.status === "replied").length;
  const archivedCount = customCounts?.archived ?? messages.filter((m) => m.status === "archived").length;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand/25 bg-gradient-to-r from-panel via-panel-strong to-panel p-5 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.4),0_0_20px_color-mix(in_oklab,var(--brand)_10%,transparent)]">
      {/* Background glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-brand/10 blur-3xl" />

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase mb-2">
        <span className="text-brand-bright">Admin</span>
        <ChevronRight className="size-3 text-muted-foreground/60" />
        <Link to="/admin/contact" className="text-muted-foreground hover:text-brand-bright transition">
          Contact
        </Link>
        <ChevronRight className="size-3 text-muted-foreground/60" />
        <span className="text-foreground">Messages</span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-[22px] sm:text-[26px] font-bold tracking-tight text-white flex items-center gap-2">
            <span>Contact</span>{" "}
            <span className="text-brand-bright text-glow">Messages</span>
          </h1>
          <p className="mt-1 text-[12.5px] sm:text-[13px] text-[#94a3b8] max-w-2xl leading-relaxed">
            View and manage inquiries and message submissions received from the public Contact page.
          </p>
        </div>

        {/* Back to Contact CMS button */}
        <div className="flex items-center gap-2.5">
          <Link
            to="/admin/contact"
            className="flex items-center gap-1.5 rounded-xl border border-brand/35 bg-background/60 px-4 py-2 text-[12.5px] font-semibold text-foreground hover:border-brand-bright/60 hover:bg-brand/10 hover:text-brand-bright transition cursor-pointer"
          >
            <ArrowLeft className="size-4 text-brand-bright" />
            <span>Contact Page CMS</span>
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-brand/15">
        <div className="rounded-xl border border-brand/20 bg-background/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total Inquiries
          </p>
          <p className="mt-1 font-display text-[20px] font-bold text-white">
            {total}
          </p>
        </div>

        <div className="rounded-xl border border-[#00ff87]/30 bg-[#00ff87]/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#00ff87]">
            New / Unread
          </p>
          <p className="mt-1 font-display text-[20px] font-bold text-[#00ff87]">
            {newCount}
          </p>
        </div>

        <div className="rounded-xl border border-[#00d2ff]/30 bg-[#00d2ff]/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#00d2ff]">
            Replied
          </p>
          <p className="mt-1 font-display text-[20px] font-bold text-[#00d2ff]">
            {repliedCount}
          </p>
        </div>

        <div className="rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#fbbf24]">
            Archived
          </p>
          <p className="mt-1 font-display text-[20px] font-bold text-[#fbbf24]">
            {archivedCount}
          </p>
        </div>
      </div>
    </div>
  );
}
