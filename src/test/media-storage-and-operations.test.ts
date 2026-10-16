import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient, AdminProfile, MediaAsset } from "@prisma/client";
import {
  uploadMediaAssetOperation,
  listAdminMediaAssetsOperation,
  getAdminMediaAssetByIdOperation,
  deleteAdminMediaAssetOperation,
  generateStoragePath,
  deriveMediaType,
  deriveMediaCategory,
  type UploadMediaPayload,
} from "@/lib/server/media-operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

describe("Item 6 — Media Library & Supabase Storage Server Operations", () => {
  const superAdminProfile: AdminProfile = {
    id: "user-super-1",
    email: "superadmin@cobralearn.com",
    fullName: "Super Admin",
    designation: null,
    role: "SUPER_ADMIN",
    isActive: true,
    avatarUrl: null,
    bio: null,
    phone: null,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const adminProfile: AdminProfile = {
    id: "user-admin-1",
    email: "admin@cobralearn.com",
    fullName: "Admin User",
    designation: null,
    role: "ADMIN",
    isActive: true,
    avatarUrl: null,
    bio: null,
    phone: null,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const editorProfile: AdminProfile = {
    id: "user-editor-1",
    email: "editor@cobralearn.com",
    fullName: "Editor User",
    designation: null,
    role: "EDITOR",
    isActive: true,
    avatarUrl: null,
    bio: null,
    phone: null,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const inactiveProfile: AdminProfile = {
    id: "user-inactive-1",
    email: "inactive@cobralearn.com",
    fullName: "Inactive Admin",
    designation: null,
    role: "ADMIN",
    isActive: false,
    avatarUrl: null,
    bio: null,
    phone: null,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProfiles: Record<string, AdminProfile> = {
    [superAdminProfile.id]: superAdminProfile,
    [adminProfile.id]: adminProfile,
    [editorProfile.id]: editorProfile,
    [inactiveProfile.id]: inactiveProfile,
  };

  let mockPrisma: any;
  let mockStorage: any;
  let storedAssets: MediaAsset[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
    storedAssets = [];

    mockPrisma = {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          return Promise.resolve(mockProfiles[where.id] || null);
        }),
      },
      mediaAsset: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          const found = storedAssets.find((a) => a.id === where.id) || null;
          if (found) {
            return Promise.resolve({
              ...found,
              projectThumbnails: [],
              projectGalleryItems: [],
              websiteThumbnails: [],
              websiteGalleryItems: [],
              advertisementThumbnails: [],
              awardThumbnails: [],
            });
          }
          return Promise.resolve(null);
        }),
        findMany: vi.fn().mockImplementation(() => Promise.resolve(storedAssets)),
        count: vi.fn().mockImplementation(() => Promise.resolve(storedAssets.length)),
        create: vi.fn().mockImplementation(({ data }: { data: any }) => {
          const newAsset: MediaAsset = {
            id: `media-${Date.now()}`,
            name: data.name,
            originalFilename: data.originalFilename,
            bucket: data.bucket,
            storagePath: data.storagePath,
            publicUrl: data.publicUrl,
            mediaType: data.mediaType,
            category: data.category,
            mimeType: data.mimeType,
            fileSize: data.fileSize,
            fileExtension: data.fileExtension,
            dimensions: data.dimensions || null,
            duration: data.duration || null,
            altText: data.altText || null,
            description: data.description || null,
            tags: data.tags || [],
            uploadedById: data.uploadedById || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          storedAssets.push(newAsset);
          return Promise.resolve(newAsset);
        }),
        delete: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          storedAssets = storedAssets.filter((a) => a.id !== where.id);
          return Promise.resolve({ id: where.id });
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-123" }),
      },
      $transaction: vi.fn().mockImplementation((cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
    };

    mockStorage = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ data: { path: "some/path.png" }, error: null }),
          getPublicUrl: vi.fn().mockReturnValue({
            data: { publicUrl: "https://example-supabase.co/storage/v1/object/public/media-library/projects/test.png" },
          }),
          remove: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      },
    };
  });

  function setupAuthUser(userProfile: AdminProfile | null) {
    (getSupabaseServerClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockImplementation((token?: string) => {
          if (!userProfile) return Promise.resolve({ data: { user: null }, error: new Error("No active session") });
          return Promise.resolve({
            data: {
              user: {
                id: userProfile.id,
                email: userProfile.email,
              },
            },
            error: null,
          });
        }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: userProfile ? { user: { id: userProfile.id, email: userProfile.email }, access_token: "jwt" } : null },
        }),
      },
    });
  }

  const validPngBuffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from("dummy-png-binary-content"),
  ]);

  const validPayload: UploadMediaPayload = {
    name: "Campus Connect Thumbnail",
    originalFilename: "campus-connect-hero.png",
    mimeType: "image/png",
    size: validPngBuffer.length,
    base64Content: validPngBuffer.toString("base64"),
    category: "PROJECTS",
    altText: "Campus Connect Preview",
    tags: ["campus", "react"],
  };

  describe("Utility & Sanitization Functions", () => {
    it("generates safe, randomized storage paths without directory traversal", () => {
      const path = generateStoragePath("PROJECTS", "../../../etc/passwd.PNG");
      expect(path.startsWith("projects/")).toBe(true);
      expect(path.endsWith(".png")).toBe(true);
      expect(path).not.toContain("..");
      expect(path).not.toContain("passwd");
    });

    it("generates safe, randomized storage paths using secure randomness", () => {
      const path1 = generateStoragePath("PROJECTS", "photo.png");
      const path2 = generateStoragePath("PROJECTS", "photo.png");
      expect(path1).not.toBe(path2); // Randomness ensures collision resistance
      expect(path1).toMatch(/^projects\/\d+-[a-f0-9]{16}\.png$/);
    });

    it("derives correct MediaType and MediaCategory enums", () => {
      expect(deriveMediaType("image/jpeg")).toBe("IMAGE");
      expect(deriveMediaType("video/mp4")).toBe("VIDEO");
      expect(deriveMediaType("application/pdf")).toBe("DOCUMENT");
      expect(deriveMediaType("application/zip")).toBe("OTHER");

      expect(deriveMediaCategory("Projects")).toBe("PROJECTS");
      expect(deriveMediaCategory("Websites")).toBe("WEBSITES");
      expect(deriveMediaCategory("Awards")).toBe("AWARDS");
      expect(deriveMediaCategory("Branding")).toBe("GENERAL");
      expect(deriveMediaCategory("Unknown")).toBe("GENERAL");
    });
  });

  describe("Upload Media Operation (`uploadMediaAssetOperation`)", () => {
    it("rejects unauthenticated requests", async () => {
      setupAuthUser(null);
      const req = new Request("https://api.internal/admin/media/upload", {
        headers: { Cookie: "sb-auth=invalid" },
      });

      await expect(uploadMediaAssetOperation(req, validPayload, mockPrisma, mockStorage)).rejects.toThrow(
        /No valid Supabase session|User not found|No active session/
      );
    });

    it("rejects inactive administrators (Fail Closed)", async () => {
      setupAuthUser(inactiveProfile);
      const req = new Request("https://api.internal/admin/media/upload", {
        headers: { Authorization: "Bearer token-inactive" },
      });

      await expect(uploadMediaAssetOperation(req, validPayload, mockPrisma, mockStorage)).rejects.toThrow(
        "Forbidden: AdminProfile is deactivated"
      );
    });

    it("allows SUPER_ADMIN, ADMIN, and EDITOR to upload media", async () => {
      for (const profile of [superAdminProfile, adminProfile, editorProfile]) {
        setupAuthUser(profile);
        const req = new Request("https://api.internal/admin/media/upload", {
          headers: { Authorization: `Bearer token-${profile.role}` },
        });

        const result = await uploadMediaAssetOperation(req, {
          ...validPayload,
          name: `${profile.role} Upload`,
        }, mockPrisma, mockStorage);

        expect(result.asset).toBeDefined();
        expect(result.asset.name).toBe(`${profile.role} Upload`);
        expect(result.asset.uploadedById).toBe(profile.id);
        expect(result.asset.publicUrl).toContain("https://");
        expect(result.asset.publicUrl).not.toContain("blob:");
      }
    });

    it("rejects invalid MIME types", async () => {
      setupAuthUser(adminProfile);
      const req = new Request("https://api.internal/admin/media/upload", {
        headers: { Authorization: "Bearer token-admin" },
      });

      const invalidPayload = {
        ...validPayload,
        mimeType: "application/x-msdownload", // .exe
      };

      await expect(uploadMediaAssetOperation(req, invalidPayload, mockPrisma, mockStorage)).rejects.toThrow(
        /Unsupported MIME type/
      );
    });

    it("rejects oversized files exceeding 50 MB", async () => {
      setupAuthUser(adminProfile);
      const req = new Request("https://api.internal/admin/media/upload", {
        headers: { Authorization: "Bearer token-admin" },
      });

      // Simulated large base64
      const largePayload = {
        ...validPayload,
        base64Content: "A".repeat(55 * 1024 * 1024 * 1.37), // ~55 MB
      };

      await expect(uploadMediaAssetOperation(req, largePayload, mockPrisma, mockStorage)).rejects.toThrow(
        /exceeds server limit of 50 MB/
      );
    });

    it("handles Storage upload failures gracefully", async () => {
      setupAuthUser(adminProfile);
      const req = new Request("https://api.internal/admin/media/upload", {
        headers: { Authorization: "Bearer token-admin" },
      });

      mockStorage.storage.from = vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: null, error: new Error("Supabase Storage Timeout") }),
      });

      await expect(uploadMediaAssetOperation(req, validPayload, mockPrisma, mockStorage)).rejects.toThrow(
        /Storage Upload Error: Supabase Storage Timeout/
      );
    });

    it("performs compensating storage cleanup if database registration fails", async () => {
      setupAuthUser(adminProfile);
      const req = new Request("https://api.internal/admin/media/upload", {
        headers: { Authorization: "Bearer token-admin" },
      });

      const removeSpy = vi.fn().mockResolvedValue({ data: [], error: null });
      mockStorage.storage.from = vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: "projects/test.png" }, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://example.com/test.png" } }),
        remove: removeSpy,
      });

      // Force database error during create
      mockPrisma.mediaAsset.create = vi.fn().mockRejectedValue(new Error("Prisma Unique Constraint Violation"));

      await expect(uploadMediaAssetOperation(req, validPayload, mockPrisma, mockStorage)).rejects.toThrow(
        /Media Registration Error: Prisma Unique Constraint Violation/
      );

      // Verify compensating storage cleanup was triggered
      expect(removeSpy).toHaveBeenCalledTimes(1);
    });

    it("accepts valid supported binary files (JPEG, WebP, PDF)", async () => {
      setupAuthUser(adminProfile);
      const req = new Request("https://api.internal/admin/media/upload", {
        headers: { Authorization: "Bearer token-admin" },
      });

      // 1. JPEG
      const jpegBuffer = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("jpeg-data")]);
      const jpegRes = await uploadMediaAssetOperation(
        req,
        {
          ...validPayload,
          originalFilename: "photo.jpg",
          mimeType: "image/jpeg",
          base64Content: jpegBuffer.toString("base64"),
        },
        mockPrisma,
        mockStorage
      );
      expect(jpegRes.asset).toBeDefined();

      // 2. WebP
      const webpBuffer = Buffer.concat([
        Buffer.from("RIFF"),
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
        Buffer.from("WEBP"),
        Buffer.from("VP8 "),
      ]);
      const webpRes = await uploadMediaAssetOperation(
        req,
        {
          ...validPayload,
          originalFilename: "image.webp",
          mimeType: "image/webp",
          base64Content: webpBuffer.toString("base64"),
        },
        mockPrisma,
        mockStorage
      );
      expect(webpRes.asset).toBeDefined();

      // 3. PDF
      const pdfBuffer = Buffer.from("%PDF-1.4 test document");
      const pdfRes = await uploadMediaAssetOperation(
        req,
        {
          ...validPayload,
          originalFilename: "doc.pdf",
          mimeType: "application/pdf",
          base64Content: pdfBuffer.toString("base64"),
        },
        mockPrisma,
        mockStorage
      );
      expect(pdfRes.asset).toBeDefined();
    });

    it("rejects file extension and MIME type mismatches", async () => {
      setupAuthUser(adminProfile);
      const req = new Request("https://api.internal/admin/media/upload", {
        headers: { Authorization: "Bearer token-admin" },
      });

      const mismatchPayload = {
        ...validPayload,
        originalFilename: "payload.exe",
        mimeType: "image/png",
      };

      await expect(uploadMediaAssetOperation(req, mismatchPayload, mockPrisma, mockStorage)).rejects.toThrow(
        /File extension "\.exe" does not match declared MIME type "image\/png"/
      );
    });

    it("rejects MIME type and content signature mismatches", async () => {
      setupAuthUser(adminProfile);
      const req = new Request("https://api.internal/admin/media/upload", {
        headers: { Authorization: "Bearer token-admin" },
      });

      // Declared PNG but content is plain ASCII text
      const fakePngPayload = {
        ...validPayload,
        originalFilename: "fake.png",
        mimeType: "image/png",
        base64Content: Buffer.from("plain text not a png").toString("base64"),
      };

      await expect(uploadMediaAssetOperation(req, fakePngPayload, mockPrisma, mockStorage)).rejects.toThrow(
        /File content does not match declared MIME type "image\/png"/
      );
    });

    it("rejects malformed or truncated files", async () => {
      setupAuthUser(adminProfile);
      const req = new Request("https://api.internal/admin/media/upload", {
        headers: { Authorization: "Bearer token-admin" },
      });

      // Declared PNG but buffer is only 3 bytes
      const truncatedPayload = {
        ...validPayload,
        originalFilename: "corrupt.png",
        mimeType: "image/png",
        base64Content: Buffer.from([0x89, 0x50, 0x4e]).toString("base64"),
      };

      await expect(uploadMediaAssetOperation(req, truncatedPayload, mockPrisma, mockStorage)).rejects.toThrow(
        /File content does not match declared MIME type "image\/png"/
      );
    });

    describe("SVG Security & Upload Rejection", () => {
      it("rejects uploads declared as image/svg+xml MIME type", async () => {
        setupAuthUser(adminProfile);
        const req = new Request("https://api.internal/admin/media/upload", {
          headers: { Authorization: "Bearer token-admin" },
        });

        const svgPayload = {
          ...validPayload,
          originalFilename: "icon.svg",
          mimeType: "image/svg+xml",
          base64Content: Buffer.from("<svg><circle r='10'/></svg>", "utf8").toString("base64"),
        };

        const uploadSpy = vi.fn();
        mockStorage.storage.from = vi.fn().mockReturnValue({ upload: uploadSpy });
        const createSpy = vi.fn();
        mockPrisma.mediaAsset.create = createSpy;

        await expect(uploadMediaAssetOperation(req, svgPayload, mockPrisma, mockStorage)).rejects.toThrow(
          /Unsupported MIME type "image\/svg\+xml"|SVG uploads are disabled/i
        );

        // Verification: Zero Storage or Database interactions
        expect(uploadSpy).not.toHaveBeenCalled();
        expect(createSpy).not.toHaveBeenCalled();
      });

      it("rejects .svg filename even when client supplies another allowed MIME type", async () => {
        setupAuthUser(adminProfile);
        const req = new Request("https://api.internal/admin/media/upload", {
          headers: { Authorization: "Bearer token-admin" },
        });

        const uploadSpy = vi.fn();
        mockStorage.storage.from = vi.fn().mockReturnValue({ upload: uploadSpy });
        const createSpy = vi.fn();
        mockPrisma.mediaAsset.create = createSpy;

        // Client claims it's image/png, but filename is evil.svg
        const spoofedExtensionPayload = {
          ...validPayload,
          originalFilename: "vector-graphic.svg",
          mimeType: "image/png",
        };

        await expect(uploadMediaAssetOperation(req, spoofedExtensionPayload, mockPrisma, mockStorage)).rejects.toThrow(
          /SVG uploads are disabled for security reasons/
        );

        expect(uploadSpy).not.toHaveBeenCalled();
        expect(createSpy).not.toHaveBeenCalled();
      });

      it("rejects an actual SVG file masquerading as a PNG (renamed to .png with image/png MIME type)", async () => {
        setupAuthUser(adminProfile);
        const req = new Request("https://api.internal/admin/media/upload", {
          headers: { Authorization: "Bearer token-admin" },
        });

        const uploadSpy = vi.fn();
        mockStorage.storage.from = vi.fn().mockReturnValue({ upload: uploadSpy });
        const createSpy = vi.fn();
        mockPrisma.mediaAsset.create = createSpy;

        // Actual SVG content renamed to .png and declared as image/png
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>`;
        const renamedSvgPayload = {
          ...validPayload,
          originalFilename: "malicious-vector.png",
          mimeType: "image/png",
          base64Content: Buffer.from(svgContent, "utf8").toString("base64"),
        };

        await expect(uploadMediaAssetOperation(req, renamedSvgPayload, mockPrisma, mockStorage)).rejects.toThrow(
          /SVG uploads are disabled for security reasons/
        );

        expect(uploadSpy).not.toHaveBeenCalled();
        expect(createSpy).not.toHaveBeenCalled();
      });

      it("accepts a valid PNG containing embedded XML/SVG metadata without false-positive rejection", async () => {
        setupAuthUser(adminProfile);
        const req = new Request("https://api.internal/admin/media/upload", {
          headers: { Authorization: "Bearer token-admin" },
        });

        // Valid PNG header followed by simulated XMP metadata containing XML/SVG namespace
        const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        const xmpMetadataChunk = Buffer.from('tEXtXML:com.adobe.xmp<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"/>IEND');
        const validPngWithMetadata = Buffer.concat([pngHeader, xmpMetadataChunk]);

        const validPngPayload = {
          ...validPayload,
          originalFilename: "genuine-graphic.png",
          mimeType: "image/png",
          base64Content: validPngWithMetadata.toString("base64"),
        };

        const res = await uploadMediaAssetOperation(req, validPngPayload, mockPrisma, mockStorage);
        expect(res.asset).toBeDefined();
        expect(res.asset.originalFilename).toBe("genuine-graphic.png");
        expect(res.asset.mimeType).toBe("image/png");
      });

      it("accepts valid JPEG and WebP binary uploads without false-positive rejection", async () => {
        setupAuthUser(adminProfile);
        const req = new Request("https://api.internal/admin/media/upload", {
          headers: { Authorization: "Bearer token-admin" },
        });

        // 1. Genuine JPEG
        const jpegBuffer = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("genuine-jpeg-binary-stream")]);
        const jpegRes = await uploadMediaAssetOperation(
          req,
          {
            ...validPayload,
            originalFilename: "genuine-photo.jpeg",
            mimeType: "image/jpeg",
            base64Content: jpegBuffer.toString("base64"),
          },
          mockPrisma,
          mockStorage
        );
        expect(jpegRes.asset).toBeDefined();
        expect(jpegRes.asset.mimeType).toBe("image/jpeg");

        // 2. Genuine WebP
        const webpBuffer = Buffer.concat([
          Buffer.from("RIFF"),
          Buffer.from([0x24, 0x00, 0x00, 0x00]),
          Buffer.from("WEBP"),
          Buffer.from("VP8 "),
          Buffer.from("webp-data"),
        ]);
        const webpRes = await uploadMediaAssetOperation(
          req,
          {
            ...validPayload,
            originalFilename: "genuine-shot.webp",
            mimeType: "image/webp",
            base64Content: webpBuffer.toString("base64"),
          },
          mockPrisma,
          mockStorage
        );
        expect(webpRes.asset).toBeDefined();
        expect(webpRes.asset.mimeType).toBe("image/webp");
      });

      it("rejects SVG content with XML entity encoding masquerading as text/plain", async () => {
        setupAuthUser(adminProfile);
        const req = new Request("https://api.internal/admin/media/upload", {
          headers: { Authorization: "Bearer token-admin" },
        });

        const uploadSpy = vi.fn();
        mockStorage.storage.from = vi.fn().mockReturnValue({ upload: uploadSpy });
        const createSpy = vi.fn();
        mockPrisma.mediaAsset.create = createSpy;

        const entityEncodedSvg = `<svg xmlns="http://www.w3.org/2000/svg"><a href="jav&#x61;script:alert(1)"><text>Click</text></a></svg>`;
        const masqueradedPayload = {
          ...validPayload,
          originalFilename: "notes.txt",
          mimeType: "text/plain",
          base64Content: Buffer.from(entityEncodedSvg, "utf8").toString("base64"),
        };

        await expect(uploadMediaAssetOperation(req, masqueradedPayload, mockPrisma, mockStorage)).rejects.toThrow(
          /SVG uploads are disabled for security reasons/
        );

        expect(uploadSpy).not.toHaveBeenCalled();
        expect(createSpy).not.toHaveBeenCalled();
      });

      it("rejects SVG content with namespace-prefixed script tags masquerading under text/plain", async () => {
        setupAuthUser(adminProfile);
        const req = new Request("https://api.internal/admin/media/upload", {
          headers: { Authorization: "Bearer token-admin" },
        });

        const uploadSpy = vi.fn();
        mockStorage.storage.from = vi.fn().mockReturnValue({ upload: uploadSpy });
        const createSpy = vi.fn();
        mockPrisma.mediaAsset.create = createSpy;

        const namespaceSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:html="http://www.w3.org/1999/xhtml"><html:script>alert(1)</html:script></svg>`;
        const masqueradedPayload = {
          ...validPayload,
          originalFilename: "readme.txt",
          mimeType: "text/plain",
          base64Content: Buffer.from(namespaceSvg, "utf8").toString("base64"),
        };

        await expect(uploadMediaAssetOperation(req, masqueradedPayload, mockPrisma, mockStorage)).rejects.toThrow(
          /SVG uploads are disabled for security reasons/
        );

        expect(uploadSpy).not.toHaveBeenCalled();
        expect(createSpy).not.toHaveBeenCalled();
      });

      it("rejects even clean well-formed SVG content masquerading as text/plain", async () => {
        setupAuthUser(adminProfile);
        const req = new Request("https://api.internal/admin/media/upload", {
          headers: { Authorization: "Bearer token-admin" },
        });

        const uploadSpy = vi.fn();
        mockStorage.storage.from = vi.fn().mockReturnValue({ upload: uploadSpy });
        const createSpy = vi.fn();
        mockPrisma.mediaAsset.create = createSpy;

        const cleanSvg = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="green"/></svg>`;
        const masqueradedPayload = {
          ...validPayload,
          originalFilename: "diagram.txt",
          mimeType: "text/plain",
          base64Content: Buffer.from(cleanSvg, "utf8").toString("base64"),
        };

        await expect(uploadMediaAssetOperation(req, masqueradedPayload, mockPrisma, mockStorage)).rejects.toThrow(
          /SVG uploads are disabled for security reasons/
        );

        expect(uploadSpy).not.toHaveBeenCalled();
        expect(createSpy).not.toHaveBeenCalled();
      });

      it("rejects SVG content with custom namespace prefixes (xmlns:x=.../svg)", async () => {
        setupAuthUser(adminProfile);
        const req = new Request("https://api.internal/admin/media/upload", {
          headers: { Authorization: "Bearer token-admin" },
        });

        const uploadSpy = vi.fn();
        mockStorage.storage.from = vi.fn().mockReturnValue({ upload: uploadSpy });
        const createSpy = vi.fn();
        mockPrisma.mediaAsset.create = createSpy;

        const prefixedNsSvg = `<x:root xmlns:x="http://www.w3.org/2000/svg"><x:circle r="10"/></x:root>`;
        const payload = {
          ...validPayload,
          originalFilename: "vector.txt",
          mimeType: "text/plain",
          base64Content: Buffer.from(prefixedNsSvg, "utf8").toString("base64"),
        };

        await expect(uploadMediaAssetOperation(req, payload, mockPrisma, mockStorage)).rejects.toThrow(
          /SVG uploads are disabled for security reasons/
        );

        expect(uploadSpy).not.toHaveBeenCalled();
        expect(createSpy).not.toHaveBeenCalled();
      });

      it("rejects SVG content with whitespace around namespace attribute assignment", async () => {
        setupAuthUser(adminProfile);
        const req = new Request("https://api.internal/admin/media/upload", {
          headers: { Authorization: "Bearer token-admin" },
        });

        const uploadSpy = vi.fn();
        mockStorage.storage.from = vi.fn().mockReturnValue({ upload: uploadSpy });
        const createSpy = vi.fn();
        mockPrisma.mediaAsset.create = createSpy;

        const wsNsSvg = `<circle xmlns = "http://www.w3.org/2000/svg" cx="5" cy="5" r="5" />`;
        const payload = {
          ...validPayload,
          originalFilename: "circle.txt",
          mimeType: "text/plain",
          base64Content: Buffer.from(wsNsSvg, "utf8").toString("base64"),
        };

        await expect(uploadMediaAssetOperation(req, payload, mockPrisma, mockStorage)).rejects.toThrow(
          /SVG uploads are disabled for security reasons/
        );

        expect(uploadSpy).not.toHaveBeenCalled();
        expect(createSpy).not.toHaveBeenCalled();
      });

      it("rejects SVG content padded beyond 4 KB of whitespace or comments", async () => {
        setupAuthUser(adminProfile);
        const req = new Request("https://api.internal/admin/media/upload", {
          headers: { Authorization: "Bearer token-admin" },
        });

        const uploadSpy = vi.fn();
        mockStorage.storage.from = vi.fn().mockReturnValue({ upload: uploadSpy });
        const createSpy = vi.fn();
        mockPrisma.mediaAsset.create = createSpy;

        const paddedSvg = Buffer.concat([
          Buffer.alloc(8192, 0x20), // 8 KB padding
          Buffer.from(`<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>`, "utf8"),
        ]);

        const payload = {
          ...validPayload,
          originalFilename: "padded.txt",
          mimeType: "text/plain",
          base64Content: paddedSvg.toString("base64"),
        };

        await expect(uploadMediaAssetOperation(req, payload, mockPrisma, mockStorage)).rejects.toThrow(
          /SVG uploads are disabled for security reasons/
        );

        expect(uploadSpy).not.toHaveBeenCalled();
        expect(createSpy).not.toHaveBeenCalled();
      });

      it("rejects SVG content preceded by UTF-8 Byte Order Mark (BOM)", async () => {
        setupAuthUser(adminProfile);
        const req = new Request("https://api.internal/admin/media/upload", {
          headers: { Authorization: "Bearer token-admin" },
        });

        const uploadSpy = vi.fn();
        mockStorage.storage.from = vi.fn().mockReturnValue({ upload: uploadSpy });
        const createSpy = vi.fn();
        mockPrisma.mediaAsset.create = createSpy;

        const bomSvg = Buffer.concat([
          Buffer.from([0xef, 0xbb, 0xbf]), // UTF-8 BOM
          Buffer.from(`<svg viewBox="0 0 50 50"><rect width="50" height="50"/></svg>`, "utf8"),
        ]);

        const payload = {
          ...validPayload,
          originalFilename: "bom.txt",
          mimeType: "text/plain",
          base64Content: bomSvg.toString("base64"),
        };

        await expect(uploadMediaAssetOperation(req, payload, mockPrisma, mockStorage)).rejects.toThrow(
          /SVG uploads are disabled for security reasons/
        );

        expect(uploadSpy).not.toHaveBeenCalled();
        expect(createSpy).not.toHaveBeenCalled();
      });

      it("rejects SVG content where opening tag and attributes span across chunk boundaries", async () => {
        setupAuthUser(adminProfile);
        const req = new Request("https://api.internal/admin/media/upload", {
          headers: { Authorization: "Bearer token-admin" },
        });

        const uploadSpy = vi.fn();
        mockStorage.storage.from = vi.fn().mockReturnValue({ upload: uploadSpy });
        const createSpy = vi.fn();
        mockPrisma.mediaAsset.create = createSpy;

        // <svg at byte 64,000, 2,000 spaces of padding, then viewBox at byte 66,005
        const boundarySplitSvg = Buffer.concat([
          Buffer.alloc(64000, 0x20),
          Buffer.from("<svg "),
          Buffer.alloc(2000, 0x20),
          Buffer.from('viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>', "utf8"),
        ]);

        const payload = {
          ...validPayload,
          originalFilename: "boundary-split.txt",
          mimeType: "text/plain",
          base64Content: boundarySplitSvg.toString("base64"),
        };

        await expect(uploadMediaAssetOperation(req, payload, mockPrisma, mockStorage)).rejects.toThrow(
          /SVG uploads are disabled for security reasons/
        );

        expect(uploadSpy).not.toHaveBeenCalled();
        expect(createSpy).not.toHaveBeenCalled();
      });

      it("conservatively rejects candidate SVG opening tag exceeding inspection window or unclosed", async () => {
        setupAuthUser(adminProfile);
        const req = new Request("https://api.internal/admin/media/upload", {
          headers: { Authorization: "Bearer token-admin" },
        });

        const uploadSpy = vi.fn();
        mockStorage.storage.from = vi.fn().mockReturnValue({ upload: uploadSpy });
        const createSpy = vi.fn();
        mockPrisma.mediaAsset.create = createSpy;

        // Candidate <svg tag exceeding 16 KB inspection limit without closing bracket '>'
        const unclosedTagPayload = Buffer.concat([
          Buffer.from("<svg ", "utf8"),
          Buffer.alloc(17000, 0x20),
        ]);

        const payload = {
          ...validPayload,
          originalFilename: "unclosed.txt",
          mimeType: "text/plain",
          base64Content: unclosedTagPayload.toString("base64"),
        };

        await expect(uploadMediaAssetOperation(req, payload, mockPrisma, mockStorage)).rejects.toThrow(
          /SVG uploads are disabled for security reasons/
        );

        expect(uploadSpy).not.toHaveBeenCalled();
        expect(createSpy).not.toHaveBeenCalled();
      });

      it("accepts legitimate plain text files containing code snippets without false-positive rejection", async () => {
        setupAuthUser(adminProfile);
        const req = new Request("https://api.internal/admin/media/upload", {
          headers: { Authorization: "Bearer token-admin" },
        });

        // 1. Text snippet referencing string "<svg>" without SVG attributes or elements
        const benignCodeText = `function getTag() {\n  const tag = "<svg>"; // plain code snippet\n  return tag;\n}`;
        const codePayload = {
          ...validPayload,
          originalFilename: "snippet.txt",
          mimeType: "text/plain",
          base64Content: Buffer.from(benignCodeText, "utf8").toString("base64"),
        };

        const resCode = await uploadMediaAssetOperation(req, codePayload, mockPrisma, mockStorage);
        expect(resCode.asset).toBeDefined();

        // 2. Prose containing the SVG namespace specification URL without XML attributes
        const benignUrlText = `References and Specifications:\nSee specification at http://www.w3.org/2000/svg for vector details.`;
        const urlPayload = {
          ...validPayload,
          originalFilename: "spec-notes.txt",
          mimeType: "text/plain",
          base64Content: Buffer.from(benignUrlText, "utf8").toString("base64"),
        };

        const resUrl = await uploadMediaAssetOperation(req, urlPayload, mockPrisma, mockStorage);
        expect(resUrl.asset).toBeDefined();

        // 3. Documentation mentioning the <svg> tag with English prose words like width=24
        const benignDocText = `Icon Guidelines:\nUse the <svg> tag with width=24 and height=24 for navigation bars.`;
        const docPayload = {
          ...validPayload,
          originalFilename: "icon-guide.txt",
          mimeType: "text/plain",
          base64Content: Buffer.from(benignDocText, "utf8").toString("base64"),
        };

        const resDoc = await uploadMediaAssetOperation(req, docPayload, mockPrisma, mockStorage);
        expect(resDoc.asset).toBeDefined();
      });
    });
  });

  describe("List & Get Media Operations", () => {
    beforeEach(async () => {
      setupAuthUser(adminProfile);
      const req = new Request("https://api.internal/admin/media/upload", {
        headers: { Authorization: "Bearer token-admin" },
      });
      await uploadMediaAssetOperation(req, { ...validPayload, name: "Asset A" }, mockPrisma, mockStorage);
      await uploadMediaAssetOperation(req, { ...validPayload, name: "Asset B" }, mockPrisma, mockStorage);
    });

    it("lists media assets for authorized admins with total count", async () => {
      setupAuthUser(editorProfile);
      const req = new Request("https://api.internal/admin/media", {
        headers: { Authorization: "Bearer token-editor" },
      });

      const result = await listAdminMediaAssetsOperation(req, undefined, mockPrisma);
      expect(result.assets).toHaveLength(2);
      expect(result.totalCount).toBe(2);
    });

    it("retrieves a single media asset by ID", async () => {
      setupAuthUser(adminProfile);
      const targetId = storedAssets[0]?.id!;
      const req = new Request(`https://api.internal/admin/media/${targetId}`, {
        headers: { Authorization: "Bearer token-admin" },
      });

      const result = await getAdminMediaAssetByIdOperation(req, targetId, mockPrisma);
      expect(result.asset).not.toBeNull();
      expect(result.asset?.id).toBe(targetId);
    });
  });

  describe("Delete Media Operation (`deleteAdminMediaAssetOperation`)", () => {
    let testAssetId: string;

    beforeEach(async () => {
      setupAuthUser(adminProfile);
      const req = new Request("https://api.internal/admin/media/upload", {
        headers: { Authorization: "Bearer token-admin" },
      });
      const res = await uploadMediaAssetOperation(req, validPayload, mockPrisma, mockStorage);
      testAssetId = res.asset.id;
    });

    it("denies EDITOR role from deleting media assets (Requires MEDIA_DELETE)", async () => {
      setupAuthUser(editorProfile);
      const req = new Request(`https://api.internal/admin/media/${testAssetId}`, {
        headers: { Authorization: "Bearer token-editor" },
      });

      await expect(deleteAdminMediaAssetOperation(req, testAssetId, mockPrisma, mockStorage)).rejects.toThrow(
        'Forbidden: Role "EDITOR" lacks required permission: "media:delete"'
      );
    });

    it("prevents deletion if media asset is referenced by active projects (Referential Integrity)", async () => {
      setupAuthUser(adminProfile);
      const req = new Request(`https://api.internal/admin/media/${testAssetId}`, {
        headers: { Authorization: "Bearer token-admin" },
      });

      mockPrisma.mediaAsset.findUnique = vi.fn().mockResolvedValue({
        id: testAssetId,
        name: "Used Thumbnail",
        bucket: "media-library",
        storagePath: "projects/thumb.png",
        projectThumbnails: [{ id: "proj-1", name: "Campus Connect" }],
        projectGalleryItems: [],
        websiteThumbnails: [],
        websiteGalleryItems: [],
        advertisementThumbnails: [],
        awardThumbnails: [],
        appearanceLogos: [],
        appearanceFavicons: [],
        homepageSections: [],
      });

      await expect(deleteAdminMediaAssetOperation(req, testAssetId, mockPrisma, mockStorage)).rejects.toThrow(
        /Referential Integrity Error: Cannot delete media asset "Used Thumbnail" because it is currently in use as thumbnail for Project\(s\): "Campus Connect"/
      );
    });

    it("prevents deletion if media asset is referenced as active Logo in Appearance Settings", async () => {
      setupAuthUser(adminProfile);
      const req = new Request(`https://api.internal/admin/media/${testAssetId}`, {
        headers: { Authorization: "Bearer token-admin" },
      });

      mockPrisma.mediaAsset.findUnique = vi.fn().mockResolvedValue({
        id: testAssetId,
        name: "Corporate Logo",
        bucket: "media-library",
        storagePath: "general/logo.png",
        projectThumbnails: [],
        projectGalleryItems: [],
        websiteThumbnails: [],
        websiteGalleryItems: [],
        advertisementThumbnails: [],
        awardThumbnails: [],
        appearanceLogos: [{ id: "default" }],
        appearanceFavicons: [],
        homepageSections: [],
      });

      await expect(deleteAdminMediaAssetOperation(req, testAssetId, mockPrisma, mockStorage)).rejects.toThrow(
        /Referential Integrity Error: Cannot delete media asset "Corporate Logo" because it is currently in use as active Logo in Appearance Settings/
      );
    });

    it("prevents deletion if media asset is referenced as active Favicon in Appearance Settings", async () => {
      setupAuthUser(adminProfile);
      const req = new Request(`https://api.internal/admin/media/${testAssetId}`, {
        headers: { Authorization: "Bearer token-admin" },
      });

      mockPrisma.mediaAsset.findUnique = vi.fn().mockResolvedValue({
        id: testAssetId,
        name: "Brand Favicon",
        bucket: "media-library",
        storagePath: "general/favicon.png",
        projectThumbnails: [],
        projectGalleryItems: [],
        websiteThumbnails: [],
        websiteGalleryItems: [],
        advertisementThumbnails: [],
        awardThumbnails: [],
        appearanceLogos: [],
        appearanceFavicons: [{ id: "default" }],
        homepageSections: [],
      });

      await expect(deleteAdminMediaAssetOperation(req, testAssetId, mockPrisma, mockStorage)).rejects.toThrow(
        /Referential Integrity Error: Cannot delete media asset "Brand Favicon" because it is currently in use as active Favicon in Appearance Settings/
      );
    });

    it("prevents deletion if media asset is referenced in Homepage section", async () => {
      setupAuthUser(adminProfile);
      const req = new Request(`https://api.internal/admin/media/${testAssetId}`, {
        headers: { Authorization: "Bearer token-admin" },
      });

      mockPrisma.mediaAsset.findUnique = vi.fn().mockResolvedValue({
        id: testAssetId,
        name: "Hero Visual",
        bucket: "media-library",
        storagePath: "general/hero.png",
        projectThumbnails: [],
        projectGalleryItems: [],
        websiteThumbnails: [],
        websiteGalleryItems: [],
        advertisementThumbnails: [],
        awardThumbnails: [],
        appearanceLogos: [],
        appearanceFavicons: [],
        homepageSections: [{ id: "sec-hero", name: "Hero Showcase" }],
      });

      await expect(deleteAdminMediaAssetOperation(req, testAssetId, mockPrisma, mockStorage)).rejects.toThrow(
        /Referential Integrity Error: Cannot delete media asset "Hero Visual" because it is currently in use as media in Homepage section\(s\): "Hero Showcase"/
      );
    });

    it("prevents deletion if media asset is referenced as hero background in Contact Page configuration (SEC-MED-01)", async () => {
      setupAuthUser(adminProfile);
      const req = new Request(`https://api.internal/admin/media/${testAssetId}`, {
        headers: { Authorization: "Bearer token-admin" },
      });

      mockPrisma.mediaAsset.findUnique = vi.fn().mockResolvedValue({
        id: testAssetId,
        name: "Contact Hero Backdrop",
        bucket: "media-library",
        storagePath: "general/contact-hero.png",
        projectThumbnails: [],
        projectGalleryItems: [],
        websiteThumbnails: [],
        websiteGalleryItems: [],
        advertisementThumbnails: [],
        awardThumbnails: [],
        appearanceLogos: [],
        appearanceFavicons: [],
        homepageSections: [],
        contactHeroBackgrounds: [{ id: "default" }],
      });

      await expect(deleteAdminMediaAssetOperation(req, testAssetId, mockPrisma, mockStorage)).rejects.toThrow(
        /Referential Integrity Error: Cannot delete media asset "Contact Hero Backdrop" because it is currently in use as hero background in Contact Page configuration/
      );
    });

    it("allows deletion if media asset is unreferenced by Contact Page configuration (SEC-MED-01)", async () => {
      setupAuthUser(adminProfile);
      const req = new Request(`https://api.internal/admin/media/${testAssetId}`, {
        headers: { Authorization: "Bearer token-admin" },
      });

      mockPrisma.mediaAsset.findUnique = vi.fn().mockResolvedValue({
        id: testAssetId,
        name: "Unused Backdrop",
        bucket: "media-library",
        storagePath: "general/unused.png",
        projectThumbnails: [],
        projectGalleryItems: [],
        websiteThumbnails: [],
        websiteGalleryItems: [],
        advertisementThumbnails: [],
        awardThumbnails: [],
        appearanceLogos: [],
        appearanceFavicons: [],
        homepageSections: [],
        contactHeroBackgrounds: [],
      });

      const removeSpy = vi.fn().mockResolvedValue({ data: [], error: null });
      mockStorage.storage.from = vi.fn().mockReturnValue({
        remove: removeSpy,
      });

      const result = await deleteAdminMediaAssetOperation(req, testAssetId, mockPrisma, mockStorage);
      expect(result.success).toBe(true);
      expect(result.deletedId).toBe(testAssetId);
    });

    it("allows ADMIN to delete unreferenced media and removes physical storage object", async () => {
      setupAuthUser(adminProfile);
      const req = new Request(`https://api.internal/admin/media/${testAssetId}`, {
        headers: { Authorization: "Bearer token-admin" },
      });

      const removeSpy = vi.fn().mockResolvedValue({ data: [], error: null });
      mockStorage.storage.from = vi.fn().mockReturnValue({
        remove: removeSpy,
      });

      const result = await deleteAdminMediaAssetOperation(req, testAssetId, mockPrisma, mockStorage);
      expect(result.success).toBe(true);
      expect(result.deletedId).toBe(testAssetId);
      expect(result.databaseDeleted).toBe(true);
      expect(result.storageDeleted).toBe(true);
      expect(result.storageWarning).toBeNull();
      expect(removeSpy).toHaveBeenCalledTimes(1);
    });

    it("returns partial success with warning when storage remove returns an error", async () => {
      setupAuthUser(adminProfile);
      const req = new Request(`https://api.internal/admin/media/${testAssetId}`, {
        headers: { Authorization: "Bearer token-admin" },
      });

      const removeSpy = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Storage quota exceeded or bucket unavailable" },
      });
      mockStorage.storage.from = vi.fn().mockReturnValue({
        remove: removeSpy,
      });

      const result = await deleteAdminMediaAssetOperation(req, testAssetId, mockPrisma, mockStorage);
      expect(result.success).toBe(true);
      expect(result.deletedId).toBe(testAssetId);
      expect(result.databaseDeleted).toBe(true);
      expect(result.storageDeleted).toBe(false);
      expect(result.storageWarning).toContain("Physical storage cleanup failed: Storage quota exceeded or bucket unavailable");
      expect(result.storageWarning).toContain("may remain orphaned");
      expect(removeSpy).toHaveBeenCalledTimes(1);
      expect(mockPrisma.mediaAsset.delete).toHaveBeenCalledWith({
        where: { id: testAssetId },
      });
    });

    it("returns partial success with warning when storage remove rejects or throws an exception", async () => {
      setupAuthUser(adminProfile);
      const req = new Request(`https://api.internal/admin/media/${testAssetId}`, {
        headers: { Authorization: "Bearer token-admin" },
      });

      const removeSpy = vi.fn().mockRejectedValue(new Error("Supabase Storage network gateway timeout"));
      mockStorage.storage.from = vi.fn().mockReturnValue({
        remove: removeSpy,
      });

      const result = await deleteAdminMediaAssetOperation(req, testAssetId, mockPrisma, mockStorage);
      expect(result.success).toBe(true);
      expect(result.deletedId).toBe(testAssetId);
      expect(result.databaseDeleted).toBe(true);
      expect(result.storageDeleted).toBe(false);
      expect(result.storageWarning).toContain("Physical storage cleanup exception: Supabase Storage network gateway timeout");
      expect(result.storageWarning).toContain("may remain orphaned");
      expect(removeSpy).toHaveBeenCalledTimes(1);
      expect(mockPrisma.mediaAsset.delete).toHaveBeenCalledWith({
        where: { id: testAssetId },
      });
    });
  });
});
