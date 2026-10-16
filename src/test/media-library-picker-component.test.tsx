import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import { MediaLibraryPicker } from "@/components/media/MediaLibraryPicker";
import { prismaAssetToMediaItem } from "@/lib/media-data";
import { adminClient } from "@/lib/api/admin-client";
import { toast } from "sonner";
import type { MediaCategory, MediaType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Module Mocks
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
  Toaster: () => null,
}));

vi.mock("@/lib/api/admin-client", () => ({
  adminClient: {
    listAdminMedia: vi.fn(),
    uploadMediaAsset: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Fixture Helpers
// ---------------------------------------------------------------------------

interface PrismaAssetFixture {
  id: string;
  name: string;
  originalFilename: string;
  bucket: string;
  storagePath: string;
  publicUrl: string;
  mediaType: MediaType;
  category: MediaCategory;
  mimeType: string;
  fileSize: bigint;
  fileExtension: string;
  dimensions: string | null;
  duration: string | null;
  altText: string | null;
  description: string | null;
  tags: string[];
  uploadedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function createPrismaAsset(overrides: Partial<PrismaAssetFixture> = {}): PrismaAssetFixture {
  return {
    id: "srv-asset-1",
    name: "project-screenshot.png",
    originalFilename: "project-screenshot.png",
    bucket: "media-library",
    storagePath: "projects/screenshot.png",
    publicUrl: "https://storage.example.com/media-library/projects/screenshot.png",
    mediaType: "IMAGE",
    category: "PROJECTS",
    mimeType: "image/png",
    fileSize: BigInt(2 * 1024 * 1024), // 2 MB
    fileExtension: "png",
    dimensions: "1920x1080",
    duration: null,
    altText: "Project screenshot",
    description: "Main showcase image",
    tags: ["showcase", "v1"],
    uploadedById: "admin-1",
    createdAt: new Date("2026-03-15T10:00:00Z"),
    updatedAt: new Date("2026-03-15T10:00:00Z"),
    ...overrides,
  };
}

function makeFile(
  name = "showcase-banner.png",
  type = "image/png",
  sizeBytes = 204800
): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

describe("MediaLibraryPicker Component Tests — Phase B4.2 & B4.3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Initial loading state
  it("displays loading state initially while fetching assets", async () => {
    let resolvePromise: (val: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    vi.mocked(adminClient.listAdminMedia).mockReturnValueOnce(pendingPromise as any);

    render(
      <MediaLibraryPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText("Loading Media Assets...")).toBeDefined();

    // Resolve promise inside act to cleanly flush state updates
    await act(async () => {
      resolvePromise!({
        success: true,
        data: { assets: [], totalCount: 0 },
      });
    });
  });

  // 2. Persisted results rendered through the real mapper
  it("renders persisted results from server API mapped to UI cards", async () => {
    const rawAsset = createPrismaAsset({
      id: "asset-100",
      name: "Dashboard Hero Banner.png",
      publicUrl: "https://storage.example.com/media/dashboard-hero.png",
      category: "PROJECTS",
      mediaType: "IMAGE",
      fileSize: BigInt(3 * 1024 * 1024),
    });

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [rawAsset as any], totalCount: 1 },
    });

    render(
      <MediaLibraryPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Dashboard Hero Banner.png")).toBeDefined();
    });

    // Check mapped fields: category mapped to Projects, size mapped to 3.0 MB
    expect(screen.getAllByText("Projects").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("3.0 MB")).toBeDefined();

    // Image element rendered with persistent publicUrl
    const img = screen.getByAltText("Dashboard Hero Banner.png") as HTMLImageElement;
    expect(img.src).toBe("https://storage.example.com/media/dashboard-hero.png");
  });

  // 3. Empty results
  it("displays empty state when the API returns no assets", async () => {
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [], totalCount: 0 },
    });

    render(
      <MediaLibraryPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("No media assets found")).toBeDefined();
    });
    expect(screen.getByText("Your central Media Library is currently empty.")).toBeDefined();
  });

  // 4. Server failure and successful retry
  it("displays truthful error on API failure and re-fetches upon clicking Retry", async () => {
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: false,
      error: "PostgreSQL connection timeout",
    });

    render(
      <MediaLibraryPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Failed to Load Media")).toBeDefined();
    });
    expect(screen.getByText("PostgreSQL connection timeout")).toBeDefined();

    // Now mock success for retry
    const asset = createPrismaAsset({ id: "recovered-asset", name: "Recovered.jpg" });
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [asset as any], totalCount: 1 },
    });

    const retryBtn = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText("Recovered.jpg")).toBeDefined();
    });
    expect(adminClient.listAdminMedia).toHaveBeenCalledTimes(2);
  });

  // 5. Refresh invokes a new API request
  it("invokes a new API request when clicking the refresh button in header", async () => {
    const asset1 = createPrismaAsset({ id: "a1", name: "Initial Asset.jpg" });
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [asset1 as any], totalCount: 1 },
    });

    render(
      <MediaLibraryPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Initial Asset.jpg")).toBeDefined();
    });

    const asset2 = createPrismaAsset({ id: "a2", name: "New Refreshed Asset.jpg" });
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [asset1 as any, asset2 as any], totalCount: 2 },
    });

    const refreshBtn = screen.getByRole("button", { name: "Refresh media assets" });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(screen.getByText("New Refreshed Asset.jpg")).toBeDefined();
    });
    expect(adminClient.listAdminMedia).toHaveBeenCalledTimes(2);
  });

  // 6. Search and category/type filters
  it("correctly filters assets by search query, media type tab, and category dropdown", async () => {
    const assetImg = createPrismaAsset({
      id: "a-img",
      name: "Alpha Design.png",
      category: "PROJECTS",
      mediaType: "IMAGE",
      tags: ["branding", "alpha"],
    });
    const assetVid = createPrismaAsset({
      id: "a-vid",
      name: "Demo Reel.mp4",
      category: "WEBSITES",
      mediaType: "VIDEO",
      tags: ["showcase"],
    });
    const assetDoc = createPrismaAsset({
      id: "a-doc",
      name: "Whitepaper.pdf",
      category: "GENERAL",
      mediaType: "DOCUMENT",
      tags: ["research"],
    });

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [assetImg as any, assetVid as any, assetDoc as any], totalCount: 3 },
    });

    render(
      <MediaLibraryPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Alpha Design.png")).toBeDefined();
      expect(screen.getByText("Demo Reel.mp4")).toBeDefined();
      expect(screen.getByText("Whitepaper.pdf")).toBeDefined();
    });

    // Filter by type tab: Videos
    const videoTab = screen.getByRole("button", { name: "Videos" });
    fireEvent.click(videoTab);

    expect(screen.queryByText("Alpha Design.png")).toBeNull();
    expect(screen.getByText("Demo Reel.mp4")).toBeDefined();
    expect(screen.queryByText("Whitepaper.pdf")).toBeNull();

    // Switch back to All types
    const allTab = screen.getByRole("button", { name: "All" });
    fireEvent.click(allTab);

    // Search query: "research"
    const searchInput = screen.getByPlaceholderText("Search media by name or tags...");
    fireEvent.change(searchInput, { target: { value: "research" } });

    expect(screen.queryByText("Alpha Design.png")).toBeNull();
    expect(screen.queryByText("Demo Reel.mp4")).toBeNull();
    expect(screen.getByText("Whitepaper.pdf")).toBeDefined();
  });

  // 7. Single and multiple selection
  it("handles single selection and multiple selection appropriately", async () => {
    const item1 = createPrismaAsset({ id: "id-1", name: "First.png" });
    const item2 = createPrismaAsset({ id: "id-2", name: "Second.png" });

    // Single mode test
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [item1 as any, item2 as any], totalCount: 2 },
    });

    const { unmount } = render(
      <MediaLibraryPicker
        open={true}
        multiple={false}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("First.png")).toBeDefined();
    });

    const firstCard = screen.getByText("First.png").closest("div[class*='group']")!;
    const secondCard = screen.getByText("Second.png").closest("div[class*='group']")!;

    fireEvent.click(firstCard);
    expect(screen.getByText("1 asset selected")).toBeDefined();

    // In single mode, clicking second card switches selection
    fireEvent.click(secondCard);
    expect(screen.getByText("1 asset selected")).toBeDefined();

    unmount();

    // Multiple mode test
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [item1 as any, item2 as any], totalCount: 2 },
    });

    render(
      <MediaLibraryPicker
        open={true}
        multiple={true}
        maxSelection={5}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("First.png")).toBeDefined();
    });

    const card1 = screen.getByText("First.png").closest("div[class*='group']")!;
    const card2 = screen.getByText("Second.png").closest("div[class*='group']")!;

    fireEvent.click(card1);
    expect(screen.getByText(/1 asset selected/)).toBeDefined();

    fireEvent.click(card2);
    expect(screen.getByText(/2 assets selected/)).toBeDefined();
  });

  // 8. Maximum selection enforcement
  it("enforces maxSelection limit in multiple mode and prevents selecting more", async () => {
    const items = [
      createPrismaAsset({ id: "m-1", name: "Item 1.png" }),
      createPrismaAsset({ id: "m-2", name: "Item 2.png" }),
      createPrismaAsset({ id: "m-3", name: "Item 3.png" }),
    ];

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: items as any, totalCount: 3 },
    });

    render(
      <MediaLibraryPicker
        open={true}
        multiple={true}
        maxSelection={2}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Item 1.png")).toBeDefined();
    });

    const c1 = screen.getByText("Item 1.png").closest("div[class*='group']")!;
    const c2 = screen.getByText("Item 2.png").closest("div[class*='group']")!;
    const c3 = screen.getByText("Item 3.png").closest("div[class*='group']")!;

    fireEvent.click(c1);
    fireEvent.click(c2);
    expect(screen.getByText(/2 assets selected/)).toBeDefined();

    // Attempting to select 3rd item
    fireEvent.click(c3);
    expect(toast.error).toHaveBeenCalledWith("Maximum selection limit of 2 reached.");
    expect(screen.getByText(/2 assets selected/)).toBeDefined();
  });

  // 9. Initial selected IDs
  it("preselects assets specified in initialSelectedIds", async () => {
    const item1 = createPrismaAsset({ id: "init-1", name: "Preselected.png" });
    const item2 = createPrismaAsset({ id: "init-2", name: "Other.png" });

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [item1 as any, item2 as any], totalCount: 2 },
    });

    render(
      <MediaLibraryPicker
        open={true}
        initialSelectedIds={["init-1"]}
        multiple={false}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Preselected.png")).toBeDefined();
    });

    expect(screen.getByText("1 asset selected")).toBeDefined();
  });

  // 10. Confirmation returns the correct persisted asset IDs and URLs
  it("returns selected persisted MediaItem objects to onSelect when confirmed", async () => {
    const asset = createPrismaAsset({
      id: "confirm-1",
      name: "Selected Asset.png",
      publicUrl: "https://storage.example.com/media/selected.png",
    });

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [asset as any], totalCount: 1 },
    });

    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <MediaLibraryPicker
        open={true}
        onClose={onClose}
        onSelect={onSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Selected Asset.png")).toBeDefined();
    });

    const card = screen.getByText("Selected Asset.png").closest("div[class*='group']")!;
    fireEvent.click(card);

    const confirmBtn = screen.getByRole("button", { name: "Select Media" });
    fireEvent.click(confirmBtn);

    expect(onSelect).toHaveBeenCalledTimes(1);
    const selected = onSelect.mock.calls[0]?.[0];
    expect(selected).toHaveLength(1);
    expect(selected?.[0]?.id).toBe("confirm-1");
    expect(selected?.[0]?.url).toBe("https://storage.example.com/media/selected.png");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // 11. Cancellation does not invoke onSelect
  it("closes modal on cancel without invoking onSelect", async () => {
    const asset = createPrismaAsset({ id: "cancel-1", name: "Asset.png" });
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [asset as any], totalCount: 1 },
    });

    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <MediaLibraryPicker
        open={true}
        onClose={onClose}
        onSelect={onSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Asset.png")).toBeDefined();
    });

    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  // 12. Missing URLs do not produce fabricated previews or links
  it("does not fabricate image URLs or broken links when publicUrl is null or empty", async () => {
    const assetWithoutUrl = createPrismaAsset({
      id: "no-url-1",
      name: "Broken Link.png",
      publicUrl: "",
      mediaType: "IMAGE",
    });

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [assetWithoutUrl as any], totalCount: 1 },
    });

    render(
      <MediaLibraryPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Broken Link.png")).toBeDefined();
    });

    // img element should not be rendered; fallback icon rendered instead
    const img = screen.queryByAltText("Broken Link.png");
    expect(img).toBeNull();
  });

  // 13. No mock-store fallback occurs after API failure
  it("does not fall back to mock or in-memory store assets when the API fails", async () => {
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: false,
      error: "Service unavailable",
    });

    render(
      <MediaLibraryPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Failed to Load Media")).toBeDefined();
    });

    // Verify no asset cards or mock items are shown
    expect(screen.queryByText("Select Media")).toBeDefined(); // footer button exists
    expect(screen.getByRole("button", { name: "Select Media" })).toBeDisabled();
    expect(screen.queryByText("1 asset selected")).toBeNull();
  });

  // 14. Closing or reopening the picker does not allow stale requests to corrupt the current state
  it("prevents stale overlapping requests from overwriting newer results when closed and reopened", async () => {
    let slowResolve: (val: any) => void;
    const slowPromise = new Promise((resolve) => {
      slowResolve = resolve;
    });

    vi.mocked(adminClient.listAdminMedia).mockReturnValueOnce(slowPromise as any);

    const { rerender } = render(
      <MediaLibraryPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    // Close picker while request 1 is still in flight
    rerender(
      <MediaLibraryPicker
        open={false}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    // Reopen picker with fresh fast request 2
    const freshAsset = createPrismaAsset({ id: "fresh-1", name: "Fresh Asset.png" });
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [freshAsset as any], totalCount: 1 },
    });

    rerender(
      <MediaLibraryPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Fresh Asset.png")).toBeDefined();
    });

    // Now resolve the stale request with stale data
    const staleAsset = createPrismaAsset({ id: "stale-1", name: "Stale Asset.png" });
    slowResolve!({
      success: true,
      data: { assets: [staleAsset as any], totalCount: 1 },
    });

    // Stale asset should NOT overwrite Fresh Asset
    expect(screen.queryByText("Stale Asset.png")).toBeNull();
    expect(screen.getByText("Fresh Asset.png")).toBeDefined();
  });

  // =========================================================================
  // Quick-Upload Tests — Phase B4.3
  // =========================================================================

  // 15. Clicking Upload New opens the file selector
  it("triggers the hidden file input when clicking the Upload New button", async () => {
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [], totalCount: 0 },
    });

    render(
      <MediaLibraryPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("No media assets found")).toBeDefined();
    });

    const fileInput = screen.getByTestId("picker-file-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");

    const uploadBtn = screen.getByRole("button", { name: "Upload New" });
    fireEvent.click(uploadBtn);

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  // 16, 17, 18. Successful upload uses persistent API, maps result, and auto-selects newly uploaded asset
  it("uploads file via adminClient.uploadMediaAsset, adds to library, and auto-selects in single mode", async () => {
    const existingAsset = createPrismaAsset({ id: "exist-1", name: "Existing.png" });
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [existingAsset as any], totalCount: 1 },
    });

    const uploadedServerAsset = createPrismaAsset({
      id: "srv-uploaded-1",
      name: "New Hero.png",
      originalFilename: "New Hero.png",
      publicUrl: "https://storage.example.com/media/new-hero.png",
      category: "PROJECTS",
      mediaType: "IMAGE",
      fileSize: BigInt(512000), // 500 KB
    });

    vi.mocked(adminClient.uploadMediaAsset).mockResolvedValueOnce({
      success: true,
      data: uploadedServerAsset as any,
    });

    render(
      <MediaLibraryPicker
        open={true}
        multiple={false}
        initialCategory="Projects"
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Existing.png")).toBeDefined();
    });

    const fileInput = screen.getByTestId("picker-file-input") as HTMLInputElement;
    const testFile = makeFile("New Hero.png", "image/png", 512000);

    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(adminClient.uploadMediaAsset).toHaveBeenCalledTimes(1);
    });

    // Verify persistent upload payload
    expect(adminClient.uploadMediaAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "New Hero.png",
        originalFilename: "New Hero.png",
        mimeType: "image/png",
        size: 512000,
        category: "PROJECTS",
      })
    );

    // Verify new asset appears in the grid
    await waitFor(() => {
      expect(screen.getByText("New Hero.png")).toBeDefined();
    });

    // Verify toast success
    expect(toast.success).toHaveBeenCalledWith('"New Hero.png" uploaded successfully!');

    // In single mode, newly uploaded asset is automatically selected
    expect(screen.getByText("1 asset selected")).toBeDefined();
  });

  // 19. Multiple-selection mode preserves existing selections
  it("preserves existing selections and adds newly uploaded asset in multiple mode", async () => {
    const existingAsset = createPrismaAsset({ id: "item-a", name: "Item A.png" });
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [existingAsset as any], totalCount: 1 },
    });

    const uploadedAsset = createPrismaAsset({
      id: "item-b",
      name: "Item B.png",
      publicUrl: "https://storage.example.com/media/item-b.png",
    });

    vi.mocked(adminClient.uploadMediaAsset).mockResolvedValueOnce({
      success: true,
      data: uploadedAsset as any,
    });

    render(
      <MediaLibraryPicker
        open={true}
        multiple={true}
        maxSelection={5}
        initialSelectedIds={["item-a"]}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Item A.png")).toBeDefined();
    });
    expect(screen.getByText(/1 asset selected/)).toBeDefined();

    const fileInput = screen.getByTestId("picker-file-input") as HTMLInputElement;
    const file = makeFile("Item B.png", "image/png", 102400);

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Item B.png")).toBeDefined();
    });

    // Both Item A and Item B should be selected
    expect(screen.getByText(/2 assets selected/)).toBeDefined();
  });

  // 20. Maximum selection limits are enforced upon upload
  it("enforces maxSelection limit when uploading a new asset", async () => {
    const existing1 = createPrismaAsset({ id: "lim-1", name: "Lim 1.png" });
    const existing2 = createPrismaAsset({ id: "lim-2", name: "Lim 2.png" });
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [existing1 as any, existing2 as any], totalCount: 2 },
    });

    const uploaded3 = createPrismaAsset({ id: "lim-3", name: "Lim 3.png" });
    vi.mocked(adminClient.uploadMediaAsset).mockResolvedValueOnce({
      success: true,
      data: uploaded3 as any,
    });

    render(
      <MediaLibraryPicker
        open={true}
        multiple={true}
        maxSelection={2}
        initialSelectedIds={["lim-1", "lim-2"]}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Lim 1.png")).toBeDefined();
    });
    expect(screen.getByText(/2 assets selected/)).toBeDefined();

    const fileInput = screen.getByTestId("picker-file-input") as HTMLInputElement;
    const file = makeFile("Lim 3.png", "image/png", 102400);

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Lim 3.png")).toBeDefined();
    });

    // Still exactly 2 assets selected, info toast displayed
    expect(screen.getByText(/2 assets selected/)).toBeDefined();
    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining("Maximum selection limit of 2 reached")
    );
  });

  // 21. SVG extension rejection (even with benign MIME)
  it("rejects SVG uploads by extension even if declared as image/png", async () => {
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [], totalCount: 0 },
    });

    render(
      <MediaLibraryPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("No media assets found")).toBeDefined();
    });

    const fileInput = screen.getByTestId("picker-file-input") as HTMLInputElement;
    const sneakySvg = makeFile("sneaky-vector.svg", "image/png", 1024);

    fireEvent.change(fileInput, { target: { files: [sneakySvg] } });

    expect(toast.error).toHaveBeenCalledWith("SVG uploads are disabled for security reasons.");
    expect(adminClient.uploadMediaAsset).not.toHaveBeenCalled();
  });

  // 22. SVG MIME rejection (even with benign extension)
  it("rejects SVG uploads by MIME type even if extension is .png", async () => {
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [], totalCount: 0 },
    });

    render(
      <MediaLibraryPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("No media assets found")).toBeDefined();
    });

    const fileInput = screen.getByTestId("picker-file-input") as HTMLInputElement;
    const sneakyMime = makeFile("disguised.png", "image/svg+xml", 1024);

    fireEvent.change(fileInput, { target: { files: [sneakyMime] } });

    expect(toast.error).toHaveBeenCalledWith("SVG uploads are disabled for security reasons.");
    expect(adminClient.uploadMediaAsset).not.toHaveBeenCalled();
  });

  // 23. Oversized file rejection (> 50 MB)
  it("rejects oversized files exceeding 50 MB limit", async () => {
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [], totalCount: 0 },
    });

    render(
      <MediaLibraryPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("No media assets found")).toBeDefined();
    });

    const fileInput = screen.getByTestId("picker-file-input") as HTMLInputElement;
    // 51 MB
    const hugeFile = makeFile("huge-video.mp4", "video/mp4", 51 * 1024 * 1024);

    fireEvent.change(fileInput, { target: { files: [hugeFile] } });

    expect(toast.error).toHaveBeenCalledWith("File exceeds maximum allowed size of 50 MB.");
    expect(adminClient.uploadMediaAsset).not.toHaveBeenCalled();
  });

  // 24. Server upload failure produces truthful error and no fake asset
  it("handles server upload failure truthfully without adding fake assets", async () => {
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [], totalCount: 0 },
    });

    vi.mocked(adminClient.uploadMediaAsset).mockResolvedValueOnce({
      success: false,
      error: "Supabase Storage bucket quota exceeded",
    });

    render(
      <MediaLibraryPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("No media assets found")).toBeDefined();
    });

    const fileInput = screen.getByTestId("picker-file-input") as HTMLInputElement;
    const file = makeFile("failed-upload.png", "image/png", 204800);

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Supabase Storage bucket quota exceeded");
    });

    // No asset should appear in library or be selected
    expect(screen.queryByText("failed-upload.png")).toBeNull();
    expect(screen.getByText("No asset selected")).toBeDefined();
  });

  // 25. Duplicate submission is prevented
  it("prevents duplicate submissions while an upload is in progress", async () => {
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [], totalCount: 0 },
    });

    let resolveUpload: (val: any) => void;
    const pendingUploadPromise = new Promise((resolve) => {
      resolveUpload = resolve;
    });

    vi.mocked(adminClient.uploadMediaAsset).mockReturnValueOnce(pendingUploadPromise as any);

    render(
      <MediaLibraryPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("No media assets found")).toBeDefined();
    });

    const fileInput = screen.getByTestId("picker-file-input") as HTMLInputElement;
    const file1 = makeFile("upload-1.png", "image/png", 102400);
    const file2 = makeFile("upload-2.png", "image/png", 102400);

    // First upload starts
    fireEvent.change(fileInput, { target: { files: [file1] } });

    await waitFor(() => {
      expect(adminClient.uploadMediaAsset).toHaveBeenCalledTimes(1);
    });

    // Upload button now shows Uploading... and is disabled
    expect(screen.getByText("Uploading...")).toBeDefined();

    // Triggering another file change while still uploading should be ignored
    fireEvent.change(fileInput, { target: { files: [file2] } });
    expect(adminClient.uploadMediaAsset).toHaveBeenCalledTimes(1);

    // Resolve first upload
    const uploadedAsset = createPrismaAsset({ id: "up-1", name: "upload-1.png" });
    await act(async () => {
      resolveUpload!({ success: true, data: uploadedAsset });
    });

    await waitFor(() => {
      expect(screen.getByText("upload-1.png")).toBeDefined();
    });
  });

  // 26. Successful upload followed by list-refresh failure preserves the uploaded asset
  it("preserves uploaded asset and does not report upload failure if subsequent refresh fails", async () => {
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [], totalCount: 0 },
    });

    const uploaded = createPrismaAsset({ id: "resilient-1", name: "Resilient.png" });
    vi.mocked(adminClient.uploadMediaAsset).mockResolvedValueOnce({
      success: true,
      data: uploaded as any,
    });

    render(
      <MediaLibraryPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("No media assets found")).toBeDefined();
    });

    const fileInput = screen.getByTestId("picker-file-input") as HTMLInputElement;
    const file = makeFile("Resilient.png", "image/png", 102400);

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Resilient.png")).toBeDefined();
    });
    expect(toast.success).toHaveBeenCalledWith('"Resilient.png" uploaded successfully!');

    // Now trigger a refresh that fails
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: false,
      error: "Temporary network interruption",
    });

    const refreshBtn = screen.getByRole("button", { name: "Refresh media assets" });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(screen.getByText("Failed to Load Media")).toBeDefined();
    });

    // Upload error was NEVER called
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining("Upload failed"));
  });

  // 27. Temporary object URLs are not stored as persistent media URLs
  it("ensures persisted assets returned to caller use persistent URL and never blob URL", async () => {
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [], totalCount: 0 },
    });

    const srvAsset = createPrismaAsset({
      id: "verified-url-id",
      name: "Persistent URL Check.png",
      publicUrl: "https://storage.example.com/media-library/persistent-url-check.png",
    });

    vi.mocked(adminClient.uploadMediaAsset).mockResolvedValueOnce({
      success: true,
      data: srvAsset as any,
    });

    const onSelect = vi.fn();

    render(
      <MediaLibraryPicker
        open={true}
        onClose={vi.fn()}
        onSelect={onSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("No media assets found")).toBeDefined();
    });

    const fileInput = screen.getByTestId("picker-file-input") as HTMLInputElement;
    const file = makeFile("Persistent URL Check.png", "image/png", 102400);

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Persistent URL Check.png")).toBeDefined();
    });

    const confirmBtn = screen.getByRole("button", { name: "Select Media" });
    fireEvent.click(confirmBtn);

    expect(onSelect).toHaveBeenCalledTimes(1);
    const selected = onSelect.mock.calls[0]?.[0];
    expect(selected?.[0]?.url).toBe(
      "https://storage.example.com/media-library/persistent-url-check.png"
    );
    expect(selected?.[0]?.url).not.toMatch(/^blob:/);
    expect(selected?.[0]?.thumbnail).not.toMatch(/^blob:/);
  });
});
