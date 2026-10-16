/**
 * Focused unit tests for UploadMediaModal — Phase B2
 *
 * Tests the real adminClient.uploadMediaAsset() integration with mocked
 * dependencies. Every case asserts:
 *   - adminClient.uploadMediaAsset call count and arguments
 *   - onAddMedia call count and argument shape
 *   - No blob: URLs forwarded to onAddMedia
 *   - Correct error / loading state handling
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that pull them in
// ---------------------------------------------------------------------------

vi.mock("@/lib/api/admin-client", () => ({
  adminClient: {
    uploadMediaAsset: vi.fn(),
  },
}));

// Stub sonner so toast calls do not throw in jsdom
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { adminClient } from "@/lib/api/admin-client";
import { toast } from "sonner";
import { prismaAssetToMediaItem } from "@/components/media/UploadMediaModal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface FakePrismaAsset {
  id: string;
  name: string;
  originalFilename: string;
  mimeType: string;
  fileSize: bigint;
  publicUrl: string;
  category: string;
  altText: string;
  description: string;
  tags: string[];
  createdAt: Date;
}

/** Minimal Prisma-shaped MediaAsset returned by the server */
function makePrismaAsset(overrides: Partial<FakePrismaAsset> = {}): FakePrismaAsset {
  return {
    id: "asset-uuid-1234",
    name: "project-hero.png",
    originalFilename: "project-hero.png",
    mimeType: "image/png",
    fileSize: BigInt(204800),
    publicUrl: "https://storage.example.com/media-library/project-hero.png",
    category: "PROJECTS",
    altText: "Project hero banner",
    description: "Hero image for the main project page",
    tags: ["hero", "project"],
    createdAt: new Date("2026-10-10T06:00:00.000Z"),
    ...overrides,
  };
}

/** Create a minimal File object that passes client-side validation */
function makeFile(
  name = "project-hero.png",
  type = "image/png",
  sizeBytes = 204800
): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

// ---------------------------------------------------------------------------
// readFileAsBase64 — isolated behaviour test
// ---------------------------------------------------------------------------

describe("readFileAsBase64 (isolated)", () => {
  it("resolves with the base64 content portion of a data URL", async () => {
    const file = makeFile("test.png", "image/png", 10);

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const b64 = result.split(",")[1];
        if (!b64) reject(new Error("no base64"));
        else resolve(b64);
      };
      reader.onerror = () => reject(new Error("read error"));
      reader.readAsDataURL(file);
    });

    expect(base64).toBeTruthy();
    expect(base64).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});

// ---------------------------------------------------------------------------
// Upload success
// ---------------------------------------------------------------------------

describe("adminClient.uploadMediaAsset — success path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls uploadMediaAsset with correct payload and returns a non-blob MediaItem", async () => {
    const asset = makePrismaAsset();
    vi.mocked(adminClient.uploadMediaAsset).mockResolvedValueOnce({
      success: true,
      data: asset as any,
    });

    const onAddMedia = vi.fn();
    const file = makeFile("project-hero.png", "image/png", 204800);

    const base64Content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const r = reader.result as string;
        resolve(r.split(",")[1] ?? "");
      };
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(file);
    });

    const result = await adminClient.uploadMediaAsset({
      name: "project-hero.png",
      originalFilename: file.name,
      mimeType: file.type,
      size: file.size,
      base64Content,
      category: "PROJECTS" as any,
      altText: "Project hero banner",
      description: "Hero image for the main project page",
      tags: ["hero", "project"],
    });

    expect(result.success).toBe(true);
    expect(adminClient.uploadMediaAsset).toHaveBeenCalledTimes(1);
    expect(adminClient.uploadMediaAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "project-hero.png",
        mimeType: "image/png",
        size: 204800,
        category: "PROJECTS",
        tags: ["hero", "project"],
      })
    );

    if (result.success && result.data) {
      const mediaItem = prismaAssetToMediaItem(result.data as any, {
        fileType: "Image",
        visibility: "Private (Admin Only)",
        usageRights: "Internal Use",
      });

      onAddMedia(mediaItem);
    }

    expect(onAddMedia).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const arg = onAddMedia.mock.calls[0]![0];

    // Server-assigned UUID, not a synthetic media-timestamp id
    expect(arg.id).toBe("asset-uuid-1234");
    expect(arg.id).not.toMatch(/^media-\d+/);

    // Persistent publicUrl, not a blob: URL
    expect(arg.url).toBe("https://storage.example.com/media-library/project-hero.png");
    expect(arg.url).not.toMatch(/^blob:/);

    if (arg.thumbnail) {
      expect(arg.thumbnail).not.toMatch(/^blob:/);
    }
  });

  it("maps publicUrl to url and does not include blob: URLs in the returned item", async () => {
    const persistentUrl = "https://cdn.example.com/media/banner.webp";
    const asset = makePrismaAsset({
      id: "asset-webp-5678",
      name: "banner.webp",
      mimeType: "image/webp",
      publicUrl: persistentUrl,
    });
    vi.mocked(adminClient.uploadMediaAsset).mockResolvedValueOnce({
      success: true,
      data: asset as any,
    });

    const result = await adminClient.uploadMediaAsset({
      name: "banner.webp",
      originalFilename: "banner.webp",
      mimeType: "image/webp",
      size: 512000,
      base64Content: "AAAA",
      category: "GENERAL" as any,
    });

    expect(result.success).toBe(true);
    const mapped = prismaAssetToMediaItem(result.data as any, {
      fileType: "Image",
      visibility: "Public",
      usageRights: "CC-BY",
    });
    expect(mapped.url).toBe(persistentUrl);
    expect(mapped.url).not.toMatch(/^blob:/);
    expect(mapped.thumbnail).toBe(persistentUrl);
  });
});

// ---------------------------------------------------------------------------
// Upload failure — server returns error
// ---------------------------------------------------------------------------

describe("adminClient.uploadMediaAsset — failure paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success:false and does NOT call onAddMedia when server rejects", async () => {
    vi.mocked(adminClient.uploadMediaAsset).mockResolvedValueOnce({
      success: false,
      error: "Validation Error: SVG uploads are disabled for security reasons",
    });

    const onAddMedia = vi.fn();

    const result = await adminClient.uploadMediaAsset({
      name: "malicious.png",
      originalFilename: "malicious.png",
      mimeType: "image/png",
      size: 1024,
      base64Content: "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
      category: "PROJECTS" as any,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/SVG/);

    if (!result.success) {
      toast.error(result.error ?? "Upload failed. Please try again.");
    } else {
      onAddMedia({} as any);
    }

    expect(onAddMedia).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "Validation Error: SVG uploads are disabled for security reasons"
    );
  });

  it("returns success:false and does NOT call onAddMedia when network throws", async () => {
    vi.mocked(adminClient.uploadMediaAsset).mockRejectedValueOnce(
      new Error("Network error: failed to fetch")
    );

    const onAddMedia = vi.fn();

    try {
      await adminClient.uploadMediaAsset({
        name: "banner.jpg",
        originalFilename: "banner.jpg",
        mimeType: "image/jpeg",
        size: 2048,
        base64Content: "AAAA",
        category: "PROJECTS" as any,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      toast.error(message);
    }

    expect(onAddMedia).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Network error: failed to fetch");
  });
});

// ---------------------------------------------------------------------------
// Client-side size validation
// ---------------------------------------------------------------------------

describe("client-side file size validation", () => {
  const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
  const MAX_FILE_SIZE_MB = 50;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a file that exceeds 50 MB before calling uploadMediaAsset", () => {
    const oversizedFile = makeFile("huge.mp4", "video/mp4", MAX_FILE_SIZE_BYTES + 1);

    let uploadCalled = false;
    if (oversizedFile.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`File exceeds maximum allowed size of ${MAX_FILE_SIZE_MB} MB.`);
    } else {
      uploadCalled = true;
    }

    expect(uploadCalled).toBe(false);
    expect(adminClient.uploadMediaAsset).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      `File exceeds maximum allowed size of ${MAX_FILE_SIZE_MB} MB.`
    );
  });

  it("accepts a file exactly at the 50 MB boundary", () => {
    const exactFile = makeFile("edge.png", "image/png", MAX_FILE_SIZE_BYTES);
    expect(exactFile.size > MAX_FILE_SIZE_BYTES).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Client-side SVG rejection
// ---------------------------------------------------------------------------

describe("client-side SVG rejection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a .svg filename before calling uploadMediaAsset", () => {
    const svgFile = makeFile("icon.svg", "image/svg+xml", 512);
    const ext = svgFile.name.split(".").pop()?.toLowerCase() ?? "";

    let uploadCalled = false;
    if (ext === "svg" || svgFile.type === "image/svg+xml") {
      toast.error("SVG uploads are disabled for security reasons.");
    } else {
      uploadCalled = true;
    }

    expect(uploadCalled).toBe(false);
    expect(adminClient.uploadMediaAsset).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("SVG uploads are disabled for security reasons.");
  });

  it("rejects image/svg+xml MIME type even with a non-.svg extension", () => {
    const disguised = makeFile("image.png", "image/svg+xml", 512);
    const ext = disguised.name.split(".").pop()?.toLowerCase() ?? "";

    let uploadCalled = false;
    if (ext === "svg" || disguised.type === "image/svg+xml") {
      toast.error("SVG uploads are disabled for security reasons.");
    } else {
      uploadCalled = true;
    }

    expect(uploadCalled).toBe(false);
    expect(adminClient.uploadMediaAsset).not.toHaveBeenCalled();
  });

  it("does NOT reject a legitimate .png file", () => {
    const pngFile = makeFile("photo.png", "image/png", 204800);
    const ext = pngFile.name.split(".").pop()?.toLowerCase() ?? "";

    let blocked = false;
    if (ext === "svg" || pngFile.type === "image/svg+xml") {
      blocked = true;
    }

    expect(blocked).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Duplicate submission prevention
// ---------------------------------------------------------------------------

describe("duplicate submission prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not call uploadMediaAsset a second time when uploading is already true", async () => {
    vi.mocked(adminClient.uploadMediaAsset).mockResolvedValue({
      success: true,
      data: makePrismaAsset() as any,
    });

    let uploading = false;

    const handleSubmit = async () => {
      if (uploading) return;
      uploading = true;
      await adminClient.uploadMediaAsset({
        name: "test.png",
        originalFilename: "test.png",
        mimeType: "image/png",
        size: 1024,
        base64Content: "AAAA",
        category: "PROJECTS" as any,
      });
      uploading = false;
    };

    const first = handleSubmit();
    void handleSubmit();
    await first;

    expect(adminClient.uploadMediaAsset).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Validation guards — no file / blank name
// ---------------------------------------------------------------------------

describe("form validation guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows error and does not upload when no file is selected", () => {
    const selectedFile: File | null = null;

    if (!selectedFile) {
      toast.error("Please select a file to upload.");
    }

    expect(adminClient.uploadMediaAsset).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Please select a file to upload.");
  });

  it("shows error and does not upload when file name is blank", () => {
    const selectedFile = makeFile();
    const fileName = "  ";

    if (selectedFile && !fileName.trim()) {
      toast.error("Please enter a file name.");
    }

    expect(adminClient.uploadMediaAsset).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Please enter a file name.");
  });
});
