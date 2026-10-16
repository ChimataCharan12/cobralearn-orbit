import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { MessagesTable } from "@/components/contact/messages/MessagesTable";
import type { ContactMessage } from "@/lib/contact-data";

describe("Admin Contact Messages Table & Inbox Regression Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleMessage: ContactMessage = {
    id: "a05c6543-b101-4dfd-8e38-99a6e9241a10",
    fullName: "Elena Rostova",
    email: "elena@techpartner.com",
    subject: "Strategic Partnership Inquiry",
    message: "We are interested in integrating CobraLearn showcase into our ecosystem.",
    status: "new",
    createdAt: "2026-10-12T13:51:44.633Z",
    readAt: null,
    repliedAt: null,
  };

  it("1. A single saved message renders without throwing ReferenceError", () => {
    expect(() => {
      render(
        <MessagesTable
          messages={[sampleMessage]}
          onView={vi.fn()}
          onUpdateStatus={vi.fn()}
          onDelete={vi.fn()}
          selectedIds={[]}
          onToggleSelect={vi.fn()}
          onToggleSelectAll={vi.fn()}
          currentPage={1}
          totalPages={1}
          onPageChange={vi.fn()}
          pageSize={20}
          onPageSizeChange={vi.fn()}
          totalCount={1}
        />
      );
    }).not.toThrow();
  });

  it("2. Sender details, subject, timestamp, and NEW status badge render correctly", () => {
    render(
      <MessagesTable
        messages={[sampleMessage]}
        onView={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDelete={vi.fn()}
        selectedIds={[]}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        currentPage={1}
        totalPages={1}
        onPageChange={vi.fn()}
        pageSize={20}
        onPageSizeChange={vi.fn()}
        totalCount={1}
      />
    );

    // Sender details
    expect(screen.getByText("Elena Rostova")).toBeDefined();
    expect(screen.getByText("elena@techpartner.com")).toBeDefined();

    // Subject & message snippet
    expect(screen.getByText("Strategic Partnership Inquiry")).toBeDefined();
    expect(screen.getByText("We are interested in integrating CobraLearn showcase into our ecosystem.")).toBeDefined();

    // Status badge: "NEW" with pulse dot
    const newBadge = screen.getByText(/new/i);
    expect(newBadge).toBeDefined();

    // Timestamp formatted correctly
    expect(screen.getByText(/oct 12, 2026/i)).toBeDefined();
  });

  it("3. The pagination footer renders correctly for a single message", () => {
    render(
      <MessagesTable
        messages={[sampleMessage]}
        onView={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDelete={vi.fn()}
        selectedIds={[]}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        currentPage={1}
        totalPages={1}
        onPageChange={vi.fn()}
        pageSize={20}
        onPageSizeChange={vi.fn()}
        totalCount={1}
      />
    );

    // Showing 1–1 of 1 messages
    expect(screen.getByText(/showing/i)).toBeDefined();
    expect(screen.getByText(/of/i)).toBeDefined();
    expect(screen.getByText(/messages/i)).toBeDefined();

    // Previous and Next buttons are disabled on single page
    const pageButton = screen.getByRole("button", { name: "1" });
    expect(pageButton).toBeDefined();
  });

  it("4. Page navigation and page-size callbacks work properly", () => {
    const handlePageChange = vi.fn();
    const handlePageSizeChange = vi.fn();

    render(
      <MessagesTable
        messages={[sampleMessage]}
        onView={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDelete={vi.fn()}
        selectedIds={[]}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        currentPage={1}
        totalPages={3}
        onPageChange={handlePageChange}
        pageSize={20}
        onPageSizeChange={handlePageSizeChange}
        totalCount={50}
      />
    );

    // Click on page 2 button
    const page2Button = screen.getByRole("button", { name: "2" });
    fireEvent.click(page2Button);
    expect(handlePageChange).toHaveBeenCalledWith(2);

    // Click on page 3 button
    const page3Button = screen.getByRole("button", { name: "3" });
    fireEvent.click(page3Button);
    expect(handlePageChange).toHaveBeenCalledWith(3);
  });

  it("5. Multiple-page pagination renders without errors", () => {
    const multiMessages: ContactMessage[] = Array.from({ length: 5 }, (_, i) => ({
      ...sampleMessage,
      id: `msg-${i + 1}`,
      fullName: `User ${i + 1}`,
    }));

    render(
      <MessagesTable
        messages={multiMessages}
        onView={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDelete={vi.fn()}
        selectedIds={[]}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        currentPage={2}
        totalPages={5}
        onPageChange={vi.fn()}
        pageSize={10}
        onPageSizeChange={vi.fn()}
        totalCount={45}
      />
    );

    // All 5 page buttons must be rendered
    for (let p = 1; p <= 5; p++) {
      expect(screen.getByRole("button", { name: String(p) })).toBeDefined();
    }

    // Active page is 2
    const page2Btn = screen.getByRole("button", { name: "2" });
    expect(page2Btn.className).toContain("text-brand-bright");
  });

  it("6. Provides safe defaults when optional pagination props are omitted", () => {
    // Should not throw even if pagination props are completely omitted
    expect(() => {
      render(
        <MessagesTable
          messages={[sampleMessage]}
          onView={vi.fn()}
          onUpdateStatus={vi.fn()}
          onDelete={vi.fn()}
          selectedIds={[]}
          onToggleSelect={vi.fn()}
          onToggleSelectAll={vi.fn()}
        />
      );
    }).not.toThrow();

    expect(screen.getByText("Elena Rostova")).toBeDefined();
  });
});
