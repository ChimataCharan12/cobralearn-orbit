import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MediaDetailModal } from "@/components/media/MediaDetailModal";
import { adminClient } from "@/lib/api/admin-client";
import { toast } from "sonner";
import type { MediaItem } from "@/lib/media-data";

vi.mock("@/lib/api/admin-client", () => ({
  adminClient: {
    updateAdminMedia: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("MediaDetailModal Component (B3.4 Stage 2)", () => {
  const mockItem: MediaItem = {
    id: "item-1",
    name: "Logo Branding Concept",
    type: "Image",
    category: "Projects",
    size: "1.5 MB",
    rawSize: 1572864,
    date: "Oct 10, 2026",
    url: "https://storage.cobralearn.com/media-library/projects/logo.png",
    thumbnail: "https://storage.cobralearn.com/media-library/projects/logo.png",
    altText: "High contrast logo illustration",
    description: "Detailed description of branding logo vector",
    tags: ["branding", "identity", "vector"],
    dimensions: "1920x1080",
    mimeType: "image/png",
  };

  const defaultProps = {
    item: mockItem,
    open: true,
    onClose: vi.fn(),
    onDelete: vi.fn(),
    onUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Read-only details render correctly
  it("renders read-only details and metadata correctly", () => {
    render(<MediaDetailModal {...defaultProps} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Logo Branding Concept")).toBeInTheDocument();
    expect(screen.getByText("Image")).toBeInTheDocument();
    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByText("1.5 MB")).toBeInTheDocument();
    expect(screen.getByText("1920x1080")).toBeInTheDocument();
    expect(screen.getByText("image/png")).toBeInTheDocument();
    expect(screen.getByText("Oct 10, 2026")).toBeInTheDocument();
    expect(screen.getByText("High contrast logo illustration")).toBeInTheDocument();
    expect(screen.getByText("Detailed description of branding logo vector")).toBeInTheDocument();
    expect(screen.getByText("branding")).toBeInTheDocument();
    expect(screen.getByText("identity")).toBeInTheDocument();
    expect(screen.getByText("vector")).toBeInTheDocument();
    expect(screen.getByText("https://storage.cobralearn.com/media-library/projects/logo.png")).toBeInTheDocument();
  });

  // 2. Edit mode loads existing metadata
  it("enters edit mode and populates form fields with existing metadata", () => {
    render(<MediaDetailModal {...defaultProps} />);

    const editBtn = screen.getByRole("button", { name: /edit/i });
    fireEvent.click(editBtn);

    expect(screen.getByText("Edit Asset Metadata")).toBeInTheDocument();
    const nameInput = screen.getByLabelText(/asset name/i) as HTMLInputElement;
    expect(nameInput.value).toBe("Logo Branding Concept");

    const categorySelect = screen.getByLabelText(/category/i) as HTMLSelectElement;
    expect(categorySelect.value).toBe("Projects");

    const altInput = screen.getByLabelText(/alt text/i) as HTMLInputElement;
    expect(altInput.value).toBe("High contrast logo illustration");

    const descInput = screen.getByLabelText(/description/i) as HTMLTextAreaElement;
    expect(descInput.value).toBe("Detailed description of branding logo vector");

    expect(screen.getByText("Save Changes")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  // 3 & 4. Valid edit invokes API, updates state, and does not leak immutable fields
  it("submits valid edits, excludes immutable fields, and updates parent state via onUpdate", async () => {
    const onUpdateSpy = vi.fn();
    const updatedServerAsset = {
      id: "item-1",
      name: "Renamed Identity Concept",
      originalFilename: "logo.png",
      bucket: "media-library",
      storagePath: "projects/logo.png",
      publicUrl: "https://storage.cobralearn.com/media-library/projects/logo.png",
      mediaType: "IMAGE",
      category: "WEBSITES",
      mimeType: "image/png",
      fileSize: BigInt(1572864),
      fileExtension: "png",
      dimensions: "1920x1080",
      duration: null,
      altText: "Updated alt text",
      description: "Updated description text",
      tags: ["new-tag", "identity"],
      uploadedById: "admin-1",
      createdAt: new Date("2026-10-10T00:00:00Z"),
      updatedAt: new Date("2026-10-10T12:00:00Z"),
    };

    vi.mocked(adminClient.updateAdminMedia).mockResolvedValue({
      success: true,
      data: updatedServerAsset as any,
    });

    render(<MediaDetailModal {...defaultProps} onUpdate={onUpdateSpy} />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    const nameInput = screen.getByLabelText(/asset name/i);
    fireEvent.change(nameInput, { target: { value: "Renamed Identity Concept" } });

    const categorySelect = screen.getByLabelText(/category/i);
    fireEvent.change(categorySelect, { target: { value: "Websites" } });

    const altInput = screen.getByLabelText(/alt text/i);
    fireEvent.change(altInput, { target: { value: "Updated alt text" } });

    const descInput = screen.getByLabelText(/description/i);
    fireEvent.change(descInput, { target: { value: "Updated description text" } });

    // Remove one tag and add another
    const removeBrandingBtn = screen.getByRole("button", { name: "Remove tag branding" });
    fireEvent.click(removeBrandingBtn);

    const tagInput = screen.getByPlaceholderText(/type tag and press add/i);
    fireEvent.change(tagInput, { target: { value: "new-tag" } });
    fireEvent.click(screen.getByRole("button", { name: /add/i }));

    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(adminClient.updateAdminMedia).toHaveBeenCalledTimes(1);
    });

    // Verify correct ID and payload structure
    expect(adminClient.updateAdminMedia).toHaveBeenCalledWith("item-1", {
      name: "Renamed Identity Concept",
      category: "WEBSITES",
      altText: "Updated alt text",
      description: "Updated description text",
      tags: ["identity", "vector", "new-tag"],
    });

    // Confirm that NO immutable fields appeared in the call
    const calledPayload = vi.mocked(adminClient.updateAdminMedia).mock.calls[0]?.[1];
    expect(calledPayload).not.toHaveProperty("id");
    expect(calledPayload).not.toHaveProperty("bucket");
    expect(calledPayload).not.toHaveProperty("storagePath");
    expect(calledPayload).not.toHaveProperty("publicUrl");
    expect(calledPayload).not.toHaveProperty("fileSize");
    expect(calledPayload).not.toHaveProperty("mimeType");

    // Verify success toast and onUpdate callback invocation
    expect(toast.success).toHaveBeenCalledWith("Media asset updated successfully.");
    expect(onUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "item-1",
        name: "Renamed Identity Concept",
        category: "Websites",
        altText: "Updated alt text",
        description: "Updated description text",
      })
    );
  });

  // 5. Cancel discards edits
  it("cancels edits and restores the original metadata view", () => {
    render(<MediaDetailModal {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    const nameInput = screen.getByLabelText(/asset name/i);
    fireEvent.change(nameInput, { target: { value: "Temporary Changed Name" } });

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);

    // Should return to read-only mode showing the original name
    expect(screen.queryByText("Save Changes")).not.toBeInTheDocument();
    expect(screen.getByText("Logo Branding Concept")).toBeInTheDocument();
    expect(screen.queryByText("Temporary Changed Name")).not.toBeInTheDocument();
  });

  // 6. Empty or overlong names are rejected
  it("rejects empty or whitespace-only names and prevents API call", () => {
    render(<MediaDetailModal {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    const nameInput = screen.getByLabelText(/asset name/i);
    fireEvent.change(nameInput, { target: { value: "   " } });

    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveBtn);

    expect(screen.getByText("Media asset name is required.")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Please fix the validation errors before saving.");
    expect(adminClient.updateAdminMedia).not.toHaveBeenCalled();
  });

  it("rejects names exceeding 255 characters", () => {
    render(<MediaDetailModal {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    const nameInput = screen.getByLabelText(/asset name/i);
    // Force long value
    fireEvent.change(nameInput, { target: { value: "X".repeat(256) } });

    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveBtn);

    expect(screen.getByText("Asset name must be 255 characters or less.")).toBeInTheDocument();
    expect(adminClient.updateAdminMedia).not.toHaveBeenCalled();
  });

  // 7. Alt-text and description limits
  it("rejects alt-text exceeding 500 characters", () => {
    render(<MediaDetailModal {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    const altInput = screen.getByLabelText(/alt text/i);
    fireEvent.change(altInput, { target: { value: "A".repeat(501) } });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(screen.getByText("Alt text must be 500 characters or less.")).toBeInTheDocument();
    expect(adminClient.updateAdminMedia).not.toHaveBeenCalled();
  });

  it("rejects description exceeding 2000 characters", () => {
    render(<MediaDetailModal {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    const descInput = screen.getByLabelText(/description/i);
    fireEvent.change(descInput, { target: { value: "D".repeat(2001) } });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(screen.getByText("Description must be 2000 characters or less.")).toBeInTheDocument();
    expect(adminClient.updateAdminMedia).not.toHaveBeenCalled();
  });

  // 8. Tag length and duplicate handling
  it("rejects tags exceeding 50 characters", () => {
    render(<MediaDetailModal {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    const tagInput = screen.getByPlaceholderText(/type tag and press add/i);
    fireEvent.change(tagInput, { target: { value: "T".repeat(51) } });
    fireEvent.click(screen.getByRole("button", { name: /add/i }));

    expect(screen.getByText("Each tag must be 50 characters or less.")).toBeInTheDocument();
  });

  it("prevents duplicate tags case-insensitively", () => {
    render(<MediaDetailModal {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    const tagInput = screen.getByPlaceholderText(/type tag and press add/i);
    fireEvent.change(tagInput, { target: { value: "BRANDING" } }); // "branding" already exists
    fireEvent.click(screen.getByRole("button", { name: /add/i }));

    expect(screen.getByText("This tag has already been added.")).toBeInTheDocument();
  });

  // 9. Server failure preserves entered values
  it("preserves entered values and displays error toast when server returns failure", async () => {
    vi.mocked(adminClient.updateAdminMedia).mockResolvedValue({
      success: false,
      error: "Database constraint failure",
    });

    render(<MediaDetailModal {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    const nameInput = screen.getByLabelText(/asset name/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "New Candidate Title" } });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(adminClient.updateAdminMedia).toHaveBeenCalledTimes(1);
    });

    expect(toast.error).toHaveBeenCalledWith("Database constraint failure");
    // Form remains in edit mode with user's value preserved
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    expect(nameInput.value).toBe("New Candidate Title");
  });

  // 10. Network error rejection preserves values and allows retry
  it("preserves entered values when network promise is rejected", async () => {
    vi.mocked(adminClient.updateAdminMedia).mockRejectedValue(new Error("Network connection dropped"));

    render(<MediaDetailModal {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    const nameInput = screen.getByLabelText(/asset name/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Retry Candidate Title" } });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(adminClient.updateAdminMedia).toHaveBeenCalledTimes(1);
    });

    expect(toast.error).toHaveBeenCalledWith("Network connection dropped");
    expect(nameInput.value).toBe("Retry Candidate Title");
  });

  // 11. Duplicate submissions prevented while saving
  it("disables save button and prevents duplicate submissions while in-flight", async () => {
    let resolveUpdate: any;
    const pendingPromise = new Promise<{ success: boolean; data?: any }>((res) => {
      resolveUpdate = res;
    });

    vi.mocked(adminClient.updateAdminMedia).mockReturnValue(pendingPromise as any);

    render(<MediaDetailModal {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveBtn);
    fireEvent.click(saveBtn); // double click

    expect(adminClient.updateAdminMedia).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/saving\.\.\./i)).toBeInTheDocument();

    resolveUpdate({
      success: true,
      data: {
        ...mockItem,
        fileSize: BigInt(mockItem.rawSize || 0),
        category: "PROJECTS",
        mediaType: "IMAGE",
        publicUrl: mockItem.url,
      },
    });

    await waitFor(() => {
      expect(screen.queryByText(/saving\.\.\./i)).not.toBeInTheDocument();
    });
  });

  // 12. Escape key and backdrop dismissal
  it("exits edit mode without closing modal on Escape key", () => {
    const onCloseSpy = vi.fn();
    render(<MediaDetailModal {...defaultProps} onClose={onCloseSpy} />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByText("Edit Asset Metadata")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    // Exited edit mode, but modal did not close completely
    expect(screen.queryByText("Edit Asset Metadata")).not.toBeInTheDocument();
    expect(onCloseSpy).not.toHaveBeenCalled();
  });

  it("closes modal on Escape key when in view mode", () => {
    const onCloseSpy = vi.fn();
    render(<MediaDetailModal {...defaultProps} onClose={onCloseSpy} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });

  // 13. URL handling without fake fallback
  it("does not fabricate URLs when asset URL is missing", () => {
    const itemWithoutUrl: MediaItem = {
      ...mockItem,
      url: undefined,
      thumbnail: undefined,
    };

    render(<MediaDetailModal {...defaultProps} item={itemWithoutUrl} />);

    expect(screen.queryByText(/cobralearn\.dev\/assets/i)).not.toBeInTheDocument();
    expect(screen.getByText("No public URL available")).toBeInTheDocument();

    const copyBtn = screen.getByRole("button", { name: /copy link/i });
    fireEvent.click(copyBtn);
    expect(toast.error).toHaveBeenCalledWith("No direct URL available for this asset.");
  });

  // 14. Accessible attributes
  it("contains accessible dialog and button labeling attributes", () => {
    render(<MediaDetailModal {...defaultProps} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "media-detail-modal-title");
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});
