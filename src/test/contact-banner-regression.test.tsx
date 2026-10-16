import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ContactBanner } from "@/components/contact/ContactBanner";

// Mock @tanstack/react-router
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, target, className }: any) => (
    <a href={to} target={target} className={className}>
      {children}
    </a>
  ),
}));

// Mock contact store for unread message counts
vi.mock("@/lib/contact-store", () => ({
  useContactMessages: () => ({
    messages: [
      { id: "m-1", status: "new" },
      { id: "m-2", status: "read" },
    ],
  }),
}));

describe("ContactBanner Component Regression Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with hasUnsavedChanges={true}, displays Reset button, and invokes onReset when clicked", () => {
    const handleReset = vi.fn();
    const handleSave = vi.fn();

    render(
      <ContactBanner
        onSave={handleSave}
        onReset={handleReset}
        hasUnsavedChanges={true}
        isSaving={false}
      />
    );

    // Verify title and breadcrumbs render cleanly
    expect(screen.getByText("Contact Page")).toBeDefined();
    expect(screen.getByText("Management")).toBeDefined();

    // Verify unread messages badge displays count
    expect(screen.getByText("1")).toBeDefined();

    // Verify Reset button appears when hasUnsavedChanges is true
    const resetButton = screen.getByRole("button", { name: /reset/i });
    expect(resetButton).toBeDefined();

    // Click Reset and verify callback invocation
    fireEvent.click(resetButton);
    expect(handleReset).toHaveBeenCalledTimes(1);
  });

  it("does not render Reset button when hasUnsavedChanges is false", () => {
    const handleReset = vi.fn();
    const handleSave = vi.fn();

    render(
      <ContactBanner
        onSave={handleSave}
        onReset={handleReset}
        hasUnsavedChanges={false}
        isSaving={false}
      />
    );

    // Reset button should not be rendered
    const resetButton = screen.queryByRole("button", { name: /reset/i });
    expect(resetButton).toBeNull();
  });

  it("handles isSaving state correctly on Save button", () => {
    const handleSave = vi.fn();

    render(
      <ContactBanner
        onSave={handleSave}
        onReset={vi.fn()}
        hasUnsavedChanges={false}
        isSaving={true}
      />
    );

    const saveButton = screen.getByRole("button", { name: /saving\.\.\./i });
    expect(saveButton).toBeDefined();
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
  });
});
