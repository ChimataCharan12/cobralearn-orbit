import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MediaLibraryPage } from "@/components/media/MediaLibraryPage";
import { INITIAL_MEDIA_ITEMS, prismaAssetToMediaItem } from "@/lib/media-data";

// ---------------------------------------------------------------------------
// Module Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useRouterState: () => ({ location: { pathname: "/admin/media" } }),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  createFileRoute: () => () => ({ component: vi.fn() }),
}));

vi.mock("@/lib/auth/use-auth", () => ({
  useAuthGuard: vi.fn(),
  useAuth: () => ({
    user: { id: "user-admin", email: "admin@cobralearn.com" },
    isAuthenticated: true,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
  Toaster: () => null,
}));

vi.mock("@/lib/api/admin-client", () => ({
  adminClient: {
    listAdminMedia: vi.fn(),
    uploadMediaAsset: vi.fn(),
    deleteAdminMedia: vi.fn(),
  },
}));

import { adminClient } from "@/lib/api/admin-client";
import { toast } from "sonner";
import type { MediaCategory, MediaType } from "@prisma/client";

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

// ---------------------------------------------------------------------------
// Test Suite: Phase B3.2 & B3.3 Media Library Listing & Deletion
// ---------------------------------------------------------------------------

describe("Phase B3.3: Persistent Media Library Listing & Deletion Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Initial loading and successful rendering
  it("renders loading state initially and then displays persistent media assets from API", async () => {
    let resolvePromise: (val: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    vi.mocked(adminClient.listAdminMedia).mockReturnValueOnce(pendingPromise as any);

    render(<MediaLibraryPage />);

    expect(screen.getByText("Loading Media Assets...")).toBeDefined();

    const mockAssets = [
      createPrismaAsset({
        id: "asset-101",
        name: "hero-banner.png",
        mediaType: "IMAGE",
        category: "PROJECTS",
        fileSize: BigInt(1024 * 1024),
      }),
      createPrismaAsset({
        id: "asset-102",
        name: "product-overview.mp4",
        mediaType: "VIDEO",
        category: "WEBSITES",
        fileSize: BigInt(15 * 1024 * 1024),
      }),
    ];

    resolvePromise!({
      success: true,
      data: { assets: mockAssets, totalCount: 2 },
    });

    await waitFor(() => {
      expect(screen.getByText("hero-banner.png")).toBeDefined();
      expect(screen.getByText("product-overview.mp4")).toBeDefined();
    });

    expect(screen.queryByText("Loading Media Assets...")).toBeNull();
    expect(adminClient.listAdminMedia).toHaveBeenCalledTimes(1);
  });

  // 2. Empty state when API returns zero assets
  it("displays MediaEmptyState when the API returns an empty list of assets", async () => {
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [], totalCount: 0 },
    });

    render(<MediaLibraryPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /No Media Files Found/i })).toBeDefined();
      expect(screen.getByText("Your media library is empty.")).toBeDefined();
    });

    expect(screen.queryByText("hero-banner.png")).toBeNull();
  });

  // 3. Error state and working retry after a failed fetch
  it("displays MediaErrorState on API failure and re-fetches upon clicking Retry", async () => {
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: false,
      error: "Connection to database failed",
    });

    render(<MediaLibraryPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Something Went Wrong/i })).toBeDefined();
      expect(screen.getByText("Connection to database failed")).toBeDefined();
    });

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: {
        assets: [
          createPrismaAsset({
            id: "recovered-asset",
            name: "recovered-showcase.png",
          }),
        ],
        totalCount: 1,
      },
    });

    const retryBtn = screen.getByText("Try Again");
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText("recovered-showcase.png")).toBeDefined();
    });

    expect(screen.queryByRole("heading", { name: /Something Went Wrong/i })).toBeNull();
    expect(adminClient.listAdminMedia).toHaveBeenCalledTimes(2);
  });

  // 4. Real refresh behavior on success
  it("re-fetches from server and resets filters when clicking refresh button", async () => {
    const initialAsset = createPrismaAsset({
      id: "init-1",
      name: "initial-artwork.jpg",
      mediaType: "IMAGE",
      category: "PROJECTS",
    });

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [initialAsset], totalCount: 1 },
    });

    render(<MediaLibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("initial-artwork.jpg")).toBeDefined();
    });

    const refreshedAsset = createPrismaAsset({
      id: "refresh-2",
      name: "refreshed-artwork.jpg",
      mediaType: "IMAGE",
      category: "PROJECTS",
    });

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [refreshedAsset], totalCount: 1 },
    });

    const refreshButton = screen.getByRole("button", { name: "Refresh list" });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByText("refreshed-artwork.jpg")).toBeDefined();
      expect(toast.success).toHaveBeenCalledWith("Media library refreshed.");
    });

    expect(adminClient.listAdminMedia).toHaveBeenCalledTimes(2);
  });

  // 4b. Refresh failure does not show success toast
  it("does not show success toast when refresh re-fetch fails", async () => {
    const initialAsset = createPrismaAsset({
      id: "init-1",
      name: "initial-artwork.jpg",
    });

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [initialAsset], totalCount: 1 },
    });

    render(<MediaLibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("initial-artwork.jpg")).toBeDefined();
    });

    // Refresh fails
    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: false,
      error: "Server network timeout",
    });

    const refreshButton = screen.getByRole("button", { name: "Refresh list" });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByText("Server network timeout")).toBeDefined();
    });

    expect(toast.success).not.toHaveBeenCalledWith("Media library refreshed.");
  });

  // 5. Accurate statistics derived from returned records
  it("derives exact counts and formatted byte sizes from real loaded media records", async () => {
    const testAssets = [
      createPrismaAsset({
        id: "img-1",
        name: "photo-1.png",
        mediaType: "IMAGE",
        fileSize: BigInt(1024 * 1024), // 1.0 MB
      }),
      createPrismaAsset({
        id: "img-2",
        name: "photo-2.png",
        mediaType: "IMAGE",
        fileSize: BigInt(2 * 1024 * 1024), // 2.0 MB
      }),
      createPrismaAsset({
        id: "vid-1",
        name: "teaser.mp4",
        mediaType: "VIDEO",
        fileSize: BigInt(10 * 1024 * 1024), // 10.0 MB
      }),
      createPrismaAsset({
        id: "doc-1",
        name: "whitepaper.pdf",
        mediaType: "DOCUMENT",
        fileSize: BigInt(512 * 1024), // 512.0 KB
      }),
      createPrismaAsset({
        id: "oth-1",
        name: "archive.zip",
        mediaType: "OTHER",
        fileSize: BigInt(128 * 1024), // 128.0 KB
      }),
    ];

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: testAssets, totalCount: testAssets.length },
    });

    render(<MediaLibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("photo-1.png")).toBeDefined();
    });

    expect(screen.getByText("3.0 MB")).toBeDefined();
    expect(screen.getAllByText("10.0 MB").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("512.0 KB").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("128.0 KB").length).toBeGreaterThanOrEqual(1);
  });

  // 6. Search and filter interactions
  it("filters persistent records by search query, type, and category", async () => {
    const assetA = createPrismaAsset({
      id: "a-1",
      name: "Alpha Branding.png",
      mediaType: "IMAGE",
      category: "ADVERTISEMENTS",
      tags: ["marketing"],
    });
    const assetB = createPrismaAsset({
      id: "b-1",
      name: "Beta Walkthrough.mp4",
      mediaType: "VIDEO",
      category: "WEBSITES",
      tags: ["tutorial"],
    });

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [assetA, assetB], totalCount: 2 },
    });

    render(<MediaLibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("Alpha Branding.png")).toBeDefined();
      expect(screen.getByText("Beta Walkthrough.mp4")).toBeDefined();
    });

    const searchInputs = screen.getAllByPlaceholderText(/search/i);
    const toolbarSearch = searchInputs.find((input) =>
      input.getAttribute("placeholder")?.includes("Search media files...")
    );
    expect(toolbarSearch).toBeDefined();

    fireEvent.change(toolbarSearch!, { target: { value: "Alpha" } });
    expect(screen.getByText("Alpha Branding.png")).toBeDefined();
    expect(screen.queryByText("Beta Walkthrough.mp4")).toBeNull();

    fireEvent.change(toolbarSearch!, { target: { value: "" } });
    expect(screen.getByText("Beta Walkthrough.mp4")).toBeDefined();

    const typeSelect = screen.getByDisplayValue("All Types");
    fireEvent.change(typeSelect, { target: { value: "Video" } });
    expect(screen.queryByText("Alpha Branding.png")).toBeNull();
    expect(screen.getByText("Beta Walkthrough.mp4")).toBeDefined();
  });

  // 7. Successful upload updates persistent listing
  it("updates mediaItems and statistics when a new media item is added via upload", async () => {
    const existingAsset = createPrismaAsset({
      id: "existing-1",
      name: "initial-image.png",
      mediaType: "IMAGE",
      fileSize: BigInt(1024 * 1024),
    });

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [existingAsset], totalCount: 1 },
    });

    const { container } = render(<MediaLibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("initial-image.png")).toBeDefined();
      expect(screen.getAllByText("1.0 MB").length).toBeGreaterThanOrEqual(1);
    });

    const uploadBtn = screen.getByRole("button", { name: /Upload Media/i });
    fireEvent.click(uploadBtn);

    expect(screen.getByText("Add new images, videos, or documents to your library.")).toBeDefined();

    const uploadedAsset = createPrismaAsset({
      id: "newly-uploaded-99",
      name: "newly-uploaded.png",
      mediaType: "IMAGE",
      fileSize: BigInt(2 * 1024 * 1024),
    });
    vi.mocked(adminClient.uploadMediaAsset).mockResolvedValueOnce({
      success: true,
      data: uploadedAsset,
    });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const testFile = new File(["dummy content"], "newly-uploaded.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    const submitBtn = screen.getByRole("button", { name: /Confirm Upload/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("newly-uploaded.png")).toBeDefined();
    });
  });

  // 8. No mock fallback verification
  it("guarantees no mock items or simulated fallbacks are used when server fails", async () => {
    expect(INITIAL_MEDIA_ITEMS).toEqual([]);

    vi.mocked(adminClient.listAdminMedia).mockRejectedValueOnce(
      new Error("Network connection dropped")
    );

    render(<MediaLibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("Network connection dropped")).toBeDefined();
    });

    expect(screen.queryByText("CobraCore Identity Logo")).toBeNull();
    expect(screen.queryByText("Brand Presentation PDF")).toBeNull();
    expect(screen.queryByText("Showcase Clip")).toBeNull();
  });

  // 9. Single deletion success
  it("successfully deletes a single media asset via persistent API and updates stats", async () => {
    const asset1 = createPrismaAsset({
      id: "del-1",
      name: "to-delete.png",
      mediaType: "IMAGE",
      fileSize: BigInt(2 * 1024 * 1024),
    });
    const asset2 = createPrismaAsset({
      id: "keep-2",
      name: "keep-me.png",
      mediaType: "IMAGE",
      fileSize: BigInt(1 * 1024 * 1024),
    });

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [asset1, asset2], totalCount: 2 },
    });

    render(<MediaLibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("to-delete.png")).toBeDefined();
      expect(screen.getByText("keep-me.png")).toBeDefined();
    });

    const optionsButtons = screen.getAllByRole("button", { name: "Options" });
    fireEvent.click(optionsButtons[0]);

    const deleteButton = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteButton);

    expect(screen.getByText("Delete Media Asset")).toBeDefined();

    vi.mocked(adminClient.deleteAdminMedia).mockResolvedValueOnce({
      success: true,
      data: {
        success: true,
        deletedId: "del-1",
        databaseDeleted: true,
        storageDeleted: true,
        storageWarning: null,
      },
    });

    const confirmBtn = screen.getByRole("button", { name: "Delete Media Asset" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(adminClient.deleteAdminMedia).toHaveBeenCalledWith("del-1");
      expect(toast.success).toHaveBeenCalledWith('Deleted asset "to-delete.png".');
      expect(screen.queryByText("to-delete.png")).toBeNull();
      expect(screen.getByText("keep-me.png")).toBeDefined();
    });
  });

  // 10. Single deletion cancellation
  it("cancels single deletion without calling the server API", async () => {
    const asset1 = createPrismaAsset({
      id: "cancel-1",
      name: "safe-file.png",
    });

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [asset1], totalCount: 1 },
    });

    render(<MediaLibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("safe-file.png")).toBeDefined();
    });

    const optionsButtons = screen.getAllByRole("button", { name: "Options" });
    fireEvent.click(optionsButtons[0]);
    const deleteButton = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteButton);

    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelBtn);

    expect(adminClient.deleteAdminMedia).not.toHaveBeenCalled();
    expect(screen.getByText("safe-file.png")).toBeDefined();
  });

  // 11. Single deletion referential integrity failure
  it("handles referential integrity failure by retaining asset in list and displaying error toast", async () => {
    const referencedAsset = createPrismaAsset({
      id: "ref-1",
      name: "active-project-thumb.png",
    });

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [referencedAsset], totalCount: 1 },
    });

    render(<MediaLibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("active-project-thumb.png")).toBeDefined();
    });

    const optionsButtons = screen.getAllByRole("button", { name: "Options" });
    fireEvent.click(optionsButtons[0]);
    const deleteButton = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteButton);

    const refError = 'Referential Integrity Error: Cannot delete media asset "active-project-thumb.png" because it is currently in use as thumbnail for Project(s): "Alpha Portal"';
    vi.mocked(adminClient.deleteAdminMedia).mockResolvedValueOnce({
      success: false,
      error: refError,
    });

    const confirmBtn = screen.getByRole("button", { name: "Delete Media Asset" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(adminClient.deleteAdminMedia).toHaveBeenCalledWith("ref-1");
      expect(toast.error).toHaveBeenCalledWith(refError);
      expect(screen.getByText("active-project-thumb.png")).toBeDefined();
    });
  });

  // 12. Single deletion duplicate submission prevention
  it("prevents duplicate submissions while single deletion is in-flight", async () => {
    const asset1 = createPrismaAsset({
      id: "inflight-1",
      name: "inflight.png",
    });

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [asset1], totalCount: 1 },
    });

    render(<MediaLibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("inflight.png")).toBeDefined();
    });

    const optionsButtons = screen.getAllByRole("button", { name: "Options" });
    fireEvent.click(optionsButtons[0]);
    const deleteButton = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteButton);

    let resolveDeletePromise: (val: any) => void;
    const deletePromise = new Promise((resolve) => {
      resolveDeletePromise = resolve;
    });
    vi.mocked(adminClient.deleteAdminMedia).mockReturnValueOnce(deletePromise as any);

    const confirmBtn = screen.getByRole("button", { name: "Delete Media Asset" });
    fireEvent.click(confirmBtn);

    // Click again while in-flight
    fireEvent.click(confirmBtn);
    expect(adminClient.deleteAdminMedia).toHaveBeenCalledTimes(1);

    resolveDeletePromise!({
      success: true,
      data: { success: true, deletedId: "inflight-1" },
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Deleted asset "inflight.png".');
    });
  });

  // 13. Bulk deletion all succeed
  it("bulk deletes all selected assets and updates library and stats", async () => {
    const asset1 = createPrismaAsset({
      id: "bulk-1",
      name: "bulk-item-1.png",
      mediaType: "IMAGE",
      fileSize: BigInt(1024 * 1024),
    });
    const asset2 = createPrismaAsset({
      id: "bulk-2",
      name: "bulk-item-2.png",
      mediaType: "IMAGE",
      fileSize: BigInt(2 * 1024 * 1024),
    });

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [asset1, asset2], totalCount: 2 },
    });

    render(<MediaLibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("bulk-item-1.png")).toBeDefined();
      expect(screen.getByText("bulk-item-2.png")).toBeDefined();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    const bulkSelect = screen.getByDisplayValue("Bulk Actions");
    fireEvent.change(bulkSelect, { target: { value: "delete" } });

    expect(screen.getByRole("button", { name: "Delete 2 Assets" })).toBeDefined();

    vi.mocked(adminClient.deleteAdminMedia).mockResolvedValue({
      success: true,
      data: {
        success: true,
        deletedId: "mock",
        databaseDeleted: true,
        storageDeleted: true,
        storageWarning: null,
      },
    });

    const confirmBulkBtn = screen.getByRole("button", { name: "Delete 2 Assets" });
    fireEvent.click(confirmBulkBtn);

    await waitFor(() => {
      expect(adminClient.deleteAdminMedia).toHaveBeenCalledTimes(2);
      expect(toast.success).toHaveBeenCalledWith("Deleted 2 assets.");
      expect(screen.queryByText("bulk-item-1.png")).toBeNull();
      expect(screen.queryByText("bulk-item-2.png")).toBeNull();
    });
  });

  // 14. Bulk deletion all fail
  it("handles complete bulk deletion failure without removing assets or clearing selection", async () => {
    const asset1 = createPrismaAsset({ id: "fail-1", name: "fail-1.png" });
    const asset2 = createPrismaAsset({ id: "fail-2", name: "fail-2.png" });

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [asset1, asset2], totalCount: 2 },
    });

    render(<MediaLibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("fail-1.png")).toBeDefined();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    const bulkSelect = screen.getByDisplayValue("Bulk Actions");
    fireEvent.change(bulkSelect, { target: { value: "delete" } });

    vi.mocked(adminClient.deleteAdminMedia).mockResolvedValue({
      success: false,
      error: "Forbidden: Insufficient permissions (requires MEDIA_DELETE)",
    });

    const confirmBulkBtn = screen.getByRole("button", { name: "Delete 2 Assets" });
    fireEvent.click(confirmBulkBtn);

    await waitFor(() => {
      expect(adminClient.deleteAdminMedia).toHaveBeenCalledTimes(2);
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to delete all 2 selected assets")
      );
      expect(screen.getByText("fail-1.png")).toBeDefined();
      expect(screen.getByText("fail-2.png")).toBeDefined();
      expect(screen.getByText("2 selected")).toBeDefined();
    });
  });

  // 15. Bulk deletion partial failure
  it("handles partial bulk deletion by removing only successful assets and keeping failed assets selected", async () => {
    const asset1 = createPrismaAsset({ id: "p-1", name: "success-1.png" });
    const asset2 = createPrismaAsset({ id: "p-2", name: "failed-referenced.png" });

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [asset1, asset2], totalCount: 2 },
    });

    render(<MediaLibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("success-1.png")).toBeDefined();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    const bulkSelect = screen.getByDisplayValue("Bulk Actions");
    fireEvent.change(bulkSelect, { target: { value: "delete" } });

    vi.mocked(adminClient.deleteAdminMedia).mockImplementation(async (id: string) => {
      if (id === "p-1") {
        return {
          success: true,
          data: {
            success: true,
            deletedId: "p-1",
            databaseDeleted: true,
            storageDeleted: true,
            storageWarning: null,
          },
        };
      }
      return { success: false, error: "Asset in use by Project" };
    });

    const confirmBulkBtn = screen.getByRole("button", { name: "Delete 2 Assets" });
    fireEvent.click(confirmBulkBtn);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Deleted 1 of 2 assets.");
      expect(toast.error).toHaveBeenCalledWith("1 asset(s) could not be deleted: Asset in use by Project");
      expect(screen.queryByText("success-1.png")).toBeNull();
      expect(screen.getByText("failed-referenced.png")).toBeDefined();
      expect(screen.getByText("1 selected")).toBeDefined();
    });
  });

  // 16. Dimensions and duration forwarding
  it("forwards dimensions and duration in prismaAssetToMediaItem when present and omits when absent", () => {
    const assetWithMeta = createPrismaAsset({
      dimensions: "1920x1080",
      duration: "03:45",
    });
    const mappedWithMeta = prismaAssetToMediaItem(assetWithMeta as any);
    expect(mappedWithMeta.dimensions).toBe("1920x1080");
    expect(mappedWithMeta.duration).toBe("03:45");

    const assetWithoutMeta = createPrismaAsset({
      dimensions: null,
      duration: null,
    });
    const mappedWithoutMeta = prismaAssetToMediaItem(assetWithoutMeta as any);
    expect(mappedWithoutMeta.dimensions).toBeUndefined();
    expect(mappedWithoutMeta.duration).toBeUndefined();
  });

  // 17. Bulk deletion mixed result with rejected promise
  it("handles mixed bulk deletion with a rejected promise while preserving failed selection", async () => {
    const asset1 = createPrismaAsset({ id: "rj-1", name: "good-asset.png" });
    const asset2 = createPrismaAsset({ id: "rj-2", name: "bad-network-asset.png" });

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [asset1, asset2], totalCount: 2 },
    });

    render(<MediaLibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("good-asset.png")).toBeDefined();
      expect(screen.getByText("bad-network-asset.png")).toBeDefined();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    const bulkSelect = screen.getByDisplayValue("Bulk Actions");
    fireEvent.change(bulkSelect, { target: { value: "delete" } });

    vi.mocked(adminClient.deleteAdminMedia)
      .mockResolvedValueOnce({
        success: true,
        data: {
          success: true,
          deletedId: "rj-1",
          databaseDeleted: true,
          storageDeleted: true,
          storageWarning: null,
        },
      })
      .mockRejectedValueOnce(new Error("Network connection dropped"));

    const confirmBulkBtn = screen.getByRole("button", { name: "Delete 2 Assets" });
    fireEvent.click(confirmBulkBtn);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Deleted 1 of 2 assets.");
      expect(toast.error).toHaveBeenCalledWith(
        "1 asset(s) could not be deleted: Network connection dropped"
      );
      expect(screen.queryByText("good-asset.png")).toBeNull();
      expect(screen.getByText("bad-network-asset.png")).toBeDefined();
      expect(screen.getByText("1 selected")).toBeDefined();
    });
  });

  // 18. Single deletion with storage cleanup warning
  it("displays a warning toast when single deletion succeeds in database but has storage cleanup warning", async () => {
    const asset = createPrismaAsset({ id: "warn-single", name: "warn-single.png" });

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [asset], totalCount: 1 },
    });

    render(<MediaLibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("warn-single.png")).toBeDefined();
    });

    const optionsButtons = screen.getAllByRole("button", { name: "Options" });
    fireEvent.click(optionsButtons[0]);

    const deleteButton = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteButton);

    expect(screen.getByText("Delete Media Asset")).toBeDefined();

    vi.mocked(adminClient.deleteAdminMedia).mockResolvedValueOnce({
      success: true,
      data: {
        success: true,
        deletedId: "warn-single",
        databaseDeleted: true,
        storageDeleted: false,
        storageWarning: "Physical storage cleanup failed: Quota exceeded",
      },
    });

    const confirmBtn = screen.getByRole("button", { name: "Delete Media Asset" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(
        expect.stringContaining("Physical storage cleanup failed: Quota exceeded")
      );
      expect(screen.queryByText("warn-single.png")).toBeNull();
    });
  });

  // 19. Bulk deletion with storage cleanup warnings
  it("displays a warning toast when bulk deletion succeeds in database but has storage cleanup warnings", async () => {
    const asset1 = createPrismaAsset({ id: "warn-bulk-1", name: "warn-bulk-1.png" });
    const asset2 = createPrismaAsset({ id: "warn-bulk-2", name: "warn-bulk-2.png" });

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets: [asset1, asset2], totalCount: 2 },
    });

    render(<MediaLibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("warn-bulk-1.png")).toBeDefined();
      expect(screen.getByText("warn-bulk-2.png")).toBeDefined();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    const bulkSelect = screen.getByDisplayValue("Bulk Actions");
    fireEvent.change(bulkSelect, { target: { value: "delete" } });

    vi.mocked(adminClient.deleteAdminMedia)
      .mockResolvedValueOnce({
        success: true,
        data: {
          success: true,
          deletedId: "warn-bulk-1",
          databaseDeleted: true,
          storageDeleted: true,
          storageWarning: null,
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          success: true,
          deletedId: "warn-bulk-2",
          databaseDeleted: true,
          storageDeleted: false,
          storageWarning: "Storage service unavailable",
        },
      });

    const confirmBulkBtn = screen.getByRole("button", { name: "Delete 2 Assets" });
    fireEvent.click(confirmBulkBtn);

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(
        "Deleted 2 assets from database, but 1 had storage cleanup warnings."
      );
      expect(screen.queryByText("warn-bulk-1.png")).toBeNull();
      expect(screen.queryByText("warn-bulk-2.png")).toBeNull();
      expect(screen.queryByText("2 selected")).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Pagination Regression Tests
  // ---------------------------------------------------------------------------

  it("renders only itemsPerPage items on page 1 and navigates to page 2", async () => {
    const assets = Array.from({ length: 20 }, (_, i) =>
      createPrismaAsset({
        id: `pg-${i + 1}`,
        name: `page-item-${String(i + 1).padStart(2, "0")}.png`,
        category: "PROJECTS",
        createdAt: new Date(2026, 0, i + 1),
      })
    );

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets, totalCount: 20 },
    });

    render(<MediaLibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("page-item-20.png")).toBeDefined();
      expect(screen.getByText("page-item-06.png")).toBeDefined();
      expect(screen.queryByText("page-item-05.png")).toBeNull();
      expect(screen.getByText("Showing 1–15 of 20")).toBeDefined();
    });

    const nextBtn = screen.getByRole("button", { name: "Next page" });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText("Showing 16–20 of 20")).toBeDefined();
      expect(screen.getByText("page-item-05.png")).toBeDefined();
      expect(screen.getByText("page-item-01.png")).toBeDefined();
      expect(screen.queryByText("page-item-20.png")).toBeNull();
    });

    const prevBtn = screen.getByRole("button", { name: "Previous page" });
    fireEvent.click(prevBtn);

    await waitFor(() => {
      expect(screen.getByText("Showing 1–15 of 20")).toBeDefined();
      expect(screen.getByText("page-item-20.png")).toBeDefined();
      expect(screen.queryByText("page-item-05.png")).toBeNull();
    });
  });

  it("applies filtering and sorting before pagination and resets to page 1 on filter change", async () => {
    const assets = [
      ...Array.from({ length: 16 }, (_, i) =>
        createPrismaAsset({
          id: `proj-${i + 1}`,
          name: `project-alpha-${String(i + 1).padStart(2, "0")}.png`,
          category: "PROJECTS",
        })
      ),
      createPrismaAsset({
        id: "web-1",
        name: "website-landing.png",
        category: "WEBSITES",
      }),
    ];

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets, totalCount: 17 },
    });

    render(<MediaLibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("Showing 1–15 of 17")).toBeDefined();
    });

    const nextBtn = screen.getByRole("button", { name: "Next page" });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText("Showing 16–17 of 17")).toBeDefined();
    });

    const categorySelect = screen.getByDisplayValue("All Categories");
    fireEvent.change(categorySelect, { target: { value: "Websites" } });

    await waitFor(() => {
      expect(screen.getByText("Showing 1–1 of 1")).toBeDefined();
      expect(screen.getByText("website-landing.png")).toBeDefined();
      expect(screen.queryByText("project-alpha-01.png")).toBeNull();
    });
  });

  it("clamps to the last available page when deletions reduce total page count", async () => {
    const assets = Array.from({ length: 16 }, (_, i) =>
      createPrismaAsset({
        id: `clamp-${i + 1}`,
        name: `clamp-item-${String(i + 1).padStart(2, "0")}.png`,
        createdAt: new Date(2026, 0, i + 1),
      })
    );

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets, totalCount: 16 },
    });

    render(<MediaLibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("Showing 1–15 of 16")).toBeDefined();
    });

    const nextBtn = screen.getByRole("button", { name: "Next page" });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText("Showing 16–16 of 16")).toBeDefined();
      expect(screen.getByText("clamp-item-01.png")).toBeDefined();
    });

    const optionsButtons = screen.getAllByRole("button", { name: "Options" });
    fireEvent.click(optionsButtons[0]);

    const deleteBtn = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteBtn);

    vi.mocked(adminClient.deleteAdminMedia).mockResolvedValueOnce({
      success: true,
      data: {
        success: true,
        deletedId: "clamp-1",
        databaseDeleted: true,
        storageDeleted: true,
        storageWarning: null,
      },
    });

    const confirmBtn = screen.getByRole("button", { name: "Delete Media Asset" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText("Showing 1–15 of 15")).toBeDefined();
      expect(screen.queryByText("clamp-item-01.png")).toBeNull();
      expect(screen.getByText("clamp-item-16.png")).toBeDefined();
    });
  });

  it("preserves item selection across pages", async () => {
    const assets = Array.from({ length: 20 }, (_, i) =>
      createPrismaAsset({
        id: `sel-pg-${i + 1}`,
        name: `sel-item-${String(i + 1).padStart(2, "0")}.png`,
        createdAt: new Date(2026, 0, i + 1),
      })
    );

    vi.mocked(adminClient.listAdminMedia).mockResolvedValueOnce({
      success: true,
      data: { assets, totalCount: 20 },
    });

    render(<MediaLibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("sel-item-20.png")).toBeDefined();
    });

    const checkboxesP1 = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxesP1[1]);

    expect(screen.getByText("1 selected")).toBeDefined();

    const nextBtn = screen.getByRole("button", { name: "Next page" });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText("sel-item-05.png")).toBeDefined();
    });

    expect(screen.getByText("1 selected")).toBeDefined();

    const checkboxesP2 = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxesP2[1]);

    expect(screen.getByText("2 selected")).toBeDefined();

    const prevBtn = screen.getByRole("button", { name: "Previous page" });
    fireEvent.click(prevBtn);

    await waitFor(() => {
      expect(screen.getByText("sel-item-20.png")).toBeDefined();
    });

    expect(screen.getByText("2 selected")).toBeDefined();
  });
});
