import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UploadMediaModal } from "@/components/media/UploadMediaModal";
import type { MediaItem } from "@/lib/media-data";

// ---------------------------------------------------------------------------
// Module Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/api/admin-client", () => ({
  adminClient: {
    uploadMediaAsset: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { adminClient } from "@/lib/api/admin-client";
import { toast } from "sonner";

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
  mediaType: "IMAGE" | "VIDEO" | "DOCUMENT" | "OTHER";
  category: "PROJECTS" | "WEBSITES" | "ADVERTISEMENTS" | "AWARDS" | "GENERAL";
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

function makePrismaAsset(overrides: Partial<PrismaAssetFixture> = {}): PrismaAssetFixture {
  return {
    id: "srv-asset-1234",
    name: "showcase-banner.png",
    originalFilename: "showcase-banner.png",
    bucket: "media-library",
    storagePath: "projects/showcase-banner.png",
    publicUrl: "https://storage.example.com/media-library/showcase-banner.png",
    mediaType: "IMAGE",
    category: "PROJECTS",
    mimeType: "image/png",
    fileSize: BigInt(204800), // 200 KB
    fileExtension: "png",
    dimensions: "1920x1080",
    duration: null,
    altText: "Showcase banner",
    description: "Main showcase hero image",
    tags: ["showcase", "hero"],
    uploadedById: "admin-1",
    createdAt: new Date("2026-10-10T10:00:00.000Z"),
    updatedAt: new Date("2026-10-10T10:00:00.000Z"),
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("UploadMediaModal Component-Level RTL Tests", () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    createObjectURLSpy = vi.fn((file: Blob) => `blob:http://localhost/${(file as any).name || "preview"}`);
    revokeObjectURLSpy = vi.fn();
    globalThis.URL.createObjectURL = createObjectURLSpy as any;
    globalThis.URL.revokeObjectURL = revokeObjectURLSpy as any;
  });

  // 1 & 2 & 3. Successful upload flow
  it("uploads successfully, calling API with expected payload and passing persistent URL/size/category to onAddMedia and calling onClose", async () => {
    const srvAsset = makePrismaAsset({
      id: "server-uuid-999",
      name: "custom-banner.png",
      publicUrl: "https://cdn.example.com/media/custom-banner.png",
      fileSize: BigInt(307200), // 300.0 KB
      category: "PROJECTS",
    });

    vi.mocked(adminClient.uploadMediaAsset).mockResolvedValueOnce({
      success: true,
      data: srvAsset as any,
    });

    const onAddMedia = vi.fn();
    const onClose = vi.fn();

    const { container } = render(
      <UploadMediaModal open={true} onClose={onClose} onAddMedia={onAddMedia} />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const file = makeFile("custom-banner.png", "image/png", 307200);
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Verify preview URL was created for the image
    expect(createObjectURLSpy).toHaveBeenCalledWith(file);

    // Click Confirm Upload button
    const confirmBtn = screen.getByRole("button", { name: /confirm upload/i });
    fireEvent.click(confirmBtn);

    // Wait for the upload flow to complete
    await waitFor(() => {
      expect(adminClient.uploadMediaAsset).toHaveBeenCalledTimes(1);
    });

    // 1. Verify API was called with the expected payload
    expect(adminClient.uploadMediaAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "custom-banner.png",
        originalFilename: "custom-banner.png",
        mimeType: "image/png",
        size: 307200,
        category: "PROJECTS",
      })
    );

    // 2. Verify onAddMedia contains server ID, publicUrl, formatted file size, normalized category
    expect(onAddMedia).toHaveBeenCalledTimes(1);
    const addedItem: MediaItem = onAddMedia.mock.calls[0]![0];

    expect(addedItem.id).toBe("server-uuid-999");
    expect(addedItem.url).toBe("https://cdn.example.com/media/custom-banner.png");
    expect(addedItem.url).not.toMatch(/^blob:/);
    expect(addedItem.thumbnail).toBe("https://cdn.example.com/media/custom-banner.png");
    expect(addedItem.thumbnail).not.toMatch(/^blob:/);
    expect(addedItem.size).toBe("300.0 KB");
    expect(addedItem.category).toBe("Projects");

    // 3. Verify onClose was called
    expect(onClose).toHaveBeenCalledTimes(1);

    // 8. Verify preview URL was revoked
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:http://localhost/custom-banner.png");
  });

  // Category normalization across all supported categories
  it("maps each Prisma category enum to the correct title-case UI category", async () => {
    const categories: Array<{ prisma: PrismaAssetFixture["category"]; expectedUi: MediaItem["category"] }> = [
      { prisma: "ADVERTISEMENTS", expectedUi: "Advertisements" },
      { prisma: "WEBSITES", expectedUi: "Websites" },
      { prisma: "AWARDS", expectedUi: "Awards" },
      { prisma: "PROJECTS", expectedUi: "Projects" },
      { prisma: "GENERAL", expectedUi: "General" },
    ];

    for (const { prisma, expectedUi } of categories) {
      vi.clearAllMocks();
      vi.mocked(adminClient.uploadMediaAsset).mockResolvedValueOnce({
        success: true,
        data: makePrismaAsset({ category: prisma }) as any,
      });

      const onAddMedia = vi.fn();
      const onClose = vi.fn();

      const { container, unmount } = render(
        <UploadMediaModal open={true} onClose={onClose} onAddMedia={onAddMedia} />
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [makeFile()] } });

      const confirmBtn = screen.getByRole("button", { name: /confirm upload/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(onAddMedia).toHaveBeenCalledTimes(1);
      });

      expect(onAddMedia.mock.calls[0]![0].category).toBe(expectedUi);
      unmount();
    }
  });

  // 4. Server { success: false } handling
  it("displays an error, does not call onAddMedia, and does not close modal on server { success: false }", async () => {
    vi.mocked(adminClient.uploadMediaAsset).mockResolvedValueOnce({
      success: false,
      error: "Storage bucket quota exceeded",
    });

    const onAddMedia = vi.fn();
    const onClose = vi.fn();

    const { container } = render(
      <UploadMediaModal open={true} onClose={onClose} onAddMedia={onAddMedia} />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [makeFile()] } });

    const confirmBtn = screen.getByRole("button", { name: /confirm upload/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Storage bucket quota exceeded");
    });

    expect(onAddMedia).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  // 5. Rejected API call handling and recovery
  it("handles a rejected API call with toast error, keeps modal open, and allows user to recover and retry", async () => {
    vi.mocked(adminClient.uploadMediaAsset).mockRejectedValueOnce(
      new Error("Network connection lost")
    );

    const onAddMedia = vi.fn();
    const onClose = vi.fn();

    const { container } = render(
      <UploadMediaModal open={true} onClose={onClose} onAddMedia={onAddMedia} />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [makeFile()] } });

    const confirmBtn = screen.getByRole("button", { name: /confirm upload/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Network connection lost");
    });

    expect(onAddMedia).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    // User recovers: next attempt succeeds
    vi.mocked(adminClient.uploadMediaAsset).mockResolvedValueOnce({
      success: true,
      data: makePrismaAsset() as any,
    });

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onAddMedia).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // 6. Oversized files and SVG files are rejected before API is called
  it("rejects an SVG file before calling uploadMediaAsset", async () => {
    const onAddMedia = vi.fn();
    const onClose = vi.fn();

    const { container } = render(
      <UploadMediaModal open={true} onClose={onClose} onAddMedia={onAddMedia} />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const svgFile = makeFile("icon.svg", "image/svg+xml", 512);

    fireEvent.change(fileInput, { target: { files: [svgFile] } });

    expect(toast.error).toHaveBeenCalledWith("SVG uploads are disabled for security reasons.");

    // Clicking confirm upload should not trigger upload because no valid file was accepted
    const confirmBtn = screen.getByRole("button", { name: /confirm upload/i });
    fireEvent.click(confirmBtn);

    expect(adminClient.uploadMediaAsset).not.toHaveBeenCalled();
    expect(onAddMedia).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("rejects an oversized file (>50 MB) before calling uploadMediaAsset", async () => {
    const onAddMedia = vi.fn();
    const onClose = vi.fn();

    const { container } = render(
      <UploadMediaModal open={true} onClose={onClose} onAddMedia={onAddMedia} />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const oversizedFile = makeFile("huge.mp4", "video/mp4", 50 * 1024 * 1024 + 1);

    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

    expect(toast.error).toHaveBeenCalledWith("File exceeds maximum allowed size of 50 MB.");

    const confirmBtn = screen.getByRole("button", { name: /confirm upload/i });
    fireEvent.click(confirmBtn);

    expect(adminClient.uploadMediaAsset).not.toHaveBeenCalled();
    expect(onAddMedia).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  // 7. Duplicate submission prevention
  it("prevents duplicate submission while an upload is in progress", async () => {
    let resolveUpload!: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolveUpload = resolve;
    });

    vi.mocked(adminClient.uploadMediaAsset).mockReturnValueOnce(pendingPromise as any);

    const onAddMedia = vi.fn();
    const onClose = vi.fn();

    const { container } = render(
      <UploadMediaModal open={true} onClose={onClose} onAddMedia={onAddMedia} />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [makeFile()] } });

    const confirmBtn = screen.getByRole("button", { name: /confirm upload/i });

    // First click initiates upload (setUploading becomes true immediately)
    fireEvent.click(confirmBtn);

    // Second click while in-flight (should be blocked by `if (uploading) return`)
    fireEvent.click(confirmBtn);

    // Wait for async FileReader and import to trigger the first API call
    await waitFor(() => {
      expect(adminClient.uploadMediaAsset).toHaveBeenCalledTimes(1);
    });

    // Try clicking again after the API call has started but is still pending
    fireEvent.click(confirmBtn);

    // Verify upload was still only triggered once
    expect(adminClient.uploadMediaAsset).toHaveBeenCalledTimes(1);

    // Resolve the upload
    resolveUpload({
      success: true,
      data: makePrismaAsset(),
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    expect(adminClient.uploadMediaAsset).toHaveBeenCalledTimes(1);
  });

  // 8. Temporary preview URLs are revoked without replacing persistent URL
  it("revokes temporary blob preview URLs on file replacement and modal reset", async () => {
    const { container, rerender } = render(
      <UploadMediaModal open={true} onClose={vi.fn()} onAddMedia={vi.fn()} />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    // First file selected
    const file1 = makeFile("first.png", "image/png", 1024);
    fireEvent.change(fileInput, { target: { files: [file1] } });

    expect(createObjectURLSpy).toHaveBeenCalledWith(file1);

    // Second file selected replaces the first
    const file2 = makeFile("second.png", "image/png", 2048);
    fireEvent.change(fileInput, { target: { files: [file2] } });

    // First blob URL should be revoked
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:http://localhost/first.png");
    expect(createObjectURLSpy).toHaveBeenCalledWith(file2);

    // Closing modal via rerender with open=false revokes active preview
    rerender(<UploadMediaModal open={false} onClose={vi.fn()} onAddMedia={vi.fn()} />);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:http://localhost/second.png");
  });
});
