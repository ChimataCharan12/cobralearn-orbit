import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import React from "react";
import { ProjectForm, type ProjectFormData } from "@/components/projects/ProjectForm";
import {
  projectToItem,
  projectToShowcaseItem,
  projectToPublicDetailItem,
  type ProjectItem,
} from "@/lib/projects-data";
import {
  createAdminProjectOperation,
  updateAdminProjectOperation,
  deleteAdminProjectOperation,
  getPublicProjectBySlugOperation,
} from "@/lib/server/projects-operations";
import { DetailPage } from "@/components/public/DetailPage";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PrismaClient, Project, ProjectGalleryItem, MediaAsset, AdminRole } from "@prisma/client";
import type { User } from "@supabase/supabase-js";
import type { MediaItem } from "@/lib/media-data";
import { adminClient } from "@/lib/api/admin-client";
import { ProjectsLoadingState } from "@/components/projects/ProjectsLoadingState";

// ---------------------------------------------------------------------------
// Module Mocks
// ---------------------------------------------------------------------------

let thumbnailPickerProps: any = null;
let galleryPickerProps: any = null;

// Mock MediaLibraryPicker and track each picker instance separately
vi.mock("@/components/media/MediaLibraryPicker", () => ({
  MediaLibraryPicker: (props: any) => {
    if (props.title?.includes("Thumbnail")) {
      thumbnailPickerProps = props;
    } else {
      galleryPickerProps = props;
    }
    if (!props.open) return null;
    return (
      <div data-testid="media-library-picker" data-title={props.title}>
        <span>Picker Open: {props.title}</span>
      </div>
    );
  },
}));

vi.mock("@/lib/api/admin-client", () => ({
  adminClient: {
    uploadMediaAsset: vi.fn(),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useBlocker: vi.fn().mockReturnValue({
    status: "unblocked",
    proceed: vi.fn(),
    reset: vi.fn(),
  }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to, hash, className }: any) => (
    <a href={`${to || ""}${hash ? `#${hash}` : ""}`} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Test Data & Helpers
// ---------------------------------------------------------------------------

function makeTestFile(name = "test.png", type = "image/png", size = 1024): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

function createMockMediaItem(id: string, url: string, name = "image.png"): MediaItem {
  return {
    id,
    name,
    url,
    thumbnail: url,
    type: "Image",
    category: "Projects",
    mimeType: "image/png",
    size: "1 KB",
    date: new Date().toISOString().split("T")[0]!,
    dimensions: "1920x1080",
    tags: ["test"],
    createdAt: new Date().toISOString(),
  };
}

describe("Projects ↔ Persistent Media Integration (Phase B4.4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllMocks();
    thumbnailPickerProps = null;
    galleryPickerProps = null;
  });

  // =========================================================================
  // Section 1: Form State and Payloads (Part A & Part B)
  // =========================================================================
  const baseFormProject: ProjectItem = {
    id: "test-init",
    name: "Campus Connect",
    description: "Portal for campus communities",
    fullDescription: "",
    technologies: [],
    status: "Draft",
    order: 1,
    image: "",
    category: "Full Stack Development",
    thumbnailId: null,
    galleryMediaIds: [],
    galleryPreviews: [],
  };

  const baseFormProjectWithThumb: ProjectItem = {
    ...baseFormProject,
    image: "https://cdn.example.com/thumb.png",
    thumbnailId: "thumb-valid-default",
  };

  describe("1. Form State and Media Payloads", () => {
    it("initializes create form with null thumbnailId and empty galleryMediaIds and blocks submission", () => {
      let currentFormData: ProjectFormData | null = null;
      render(
        <ProjectForm
          isEdit={false}
          onSave={(data) => {
            currentFormData = data;
          }}
          onCancel={vi.fn()}
        />
      );

      const draftButton = screen.getByRole("button", { name: /Save as Draft/i });
      fireEvent.click(draftButton);

      // Submission must be blocked because thumbnail is required
      expect(currentFormData).toBeNull();
      expect(screen.getByText(/A thumbnail or cover image is required before saving/i)).toBeInTheDocument();
    });

    it("renders separate explicit buttons for thumbnail upload and library selection", () => {
      render(
        <ProjectForm
          project={baseFormProject}
          isEdit={false}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: /Upload Thumbnail/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Choose Thumbnail from Library/i })).toBeInTheDocument();
    });

    it("direct thumbnail upload calls uploadMediaAsset with PROJECTS category and attaches persistent asset", async () => {
      vi.mocked(adminClient.uploadMediaAsset).mockResolvedValueOnce({
        success: true,
        data: {
          id: "uploaded-thumb-uuid-1",
          name: "direct-thumb.png",
          originalFilename: "direct-thumb.png",
          publicUrl: "https://cdn.example.com/direct-thumb.png",
          category: "PROJECTS",
          mimeType: "image/png",
          fileSize: BigInt(2048),
          fileExtension: "png",
          storagePath: "projects/direct-thumb.png",
          bucket: "media-library",
          mediaType: "IMAGE",
          dimensions: null,
          duration: null,
          altText: "direct-thumb",
          description: null,
          tags: [],
          uploadedById: "admin-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      });

      let savedData: ProjectFormData | null = null;
      const { container } = render(
        <ProjectForm
          project={baseFormProject}
          isEdit={false}
          onSave={(data) => {
            savedData = data;
          }}
          onCancel={vi.fn()}
        />
      );

      const thumbFileInput = container.querySelector('input[aria-label="Upload thumbnail image"]') as HTMLInputElement;
      expect(thumbFileInput).not.toBeNull();

      const testFile = makeTestFile("direct-thumb.png", "image/png", 2048);
      await act(async () => {
        fireEvent.change(thumbFileInput, { target: { files: [testFile] } });
      });

      await waitFor(() => {
        expect(adminClient.uploadMediaAsset).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "direct-thumb.png",
            originalFilename: "direct-thumb.png",
            category: "PROJECTS",
            mimeType: "image/png",
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Save as Draft/i })).not.toBeDisabled();
      });

      // Save form
      fireEvent.click(screen.getByRole("button", { name: /Save as Draft/i }));

      expect(savedData).not.toBeNull();
      expect(savedData!.thumbnailId).toBe("uploaded-thumb-uuid-1");
      expect(savedData!.thumbnailPreview).toBe("https://cdn.example.com/direct-thumb.png");
    });

    it("direct thumbnail upload rejects SVG and oversized files without calling server", async () => {
      const { container } = render(
        <ProjectForm
          project={baseFormProject}
          isEdit={false}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const thumbFileInput = container.querySelector('input[aria-label="Upload thumbnail image"]') as HTMLInputElement;

      // SVG file
      const svgFile = makeTestFile("malicious.svg", "image/svg+xml", 100);
      await act(async () => {
        fireEvent.change(thumbFileInput, { target: { files: [svgFile] } });
      });

      expect(adminClient.uploadMediaAsset).not.toHaveBeenCalled();

      // Oversized file (> 50 MB)
      const bigFile = makeTestFile("huge.png", "image/png", 51 * 1024 * 1024);
      await act(async () => {
        fireEvent.change(thumbFileInput, { target: { files: [bigFile] } });
      });

      expect(adminClient.uploadMediaAsset).not.toHaveBeenCalled();
    });

    it("direct thumbnail upload correctly resolves MIME type for JPEG and WebP images", async () => {
      vi.mocked(adminClient.uploadMediaAsset).mockResolvedValue({
        success: true,
        data: {
          id: "thumb-jpg-id",
          name: "photo.jpg",
          publicUrl: "https://cdn.example.com/photo.jpg",
        } as any,
      });

      const { container } = render(
        <ProjectForm
          project={baseFormProject}
          isEdit={false}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const thumbFileInput = container.querySelector('input[aria-label="Upload thumbnail image"]') as HTMLInputElement;

      // JPEG file
      const jpegFile = makeTestFile("photo.jpg", "image/jpeg", 2048);
      await act(async () => {
        fireEvent.change(thumbFileInput, { target: { files: [jpegFile] } });
      });

      await waitFor(() => {
        expect(adminClient.uploadMediaAsset).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "photo.jpg",
            originalFilename: "photo.jpg",
            mimeType: "image/jpeg",
          })
        );
      });
    });

    it("selecting a thumbnail from library stores real media ID and persistent preview", () => {
      let savedData: ProjectFormData | null = null;
      render(
        <ProjectForm
          project={baseFormProject}
          isEdit={false}
          onSave={(data) => {
            savedData = data;
          }}
          onCancel={vi.fn()}
        />
      );

      // Open thumbnail library picker
      const selectThumbBtn = screen.getByRole("button", { name: /Choose Thumbnail from Library/i });
      fireEvent.click(selectThumbBtn);

      expect(thumbnailPickerProps).not.toBeNull();
      expect(thumbnailPickerProps.open).toBe(true);

      // Simulate asset selection with a persistent ID and URL
      const mockAsset = createMockMediaItem("media-thumb-123", "https://cdn.example.com/thumb.png");
      act(() => {
        thumbnailPickerProps.onSelect([mockAsset]);
      });

      // Re-trigger save
      const draftButton = screen.getByRole("button", { name: /Save as Draft/i });
      fireEvent.click(draftButton);

      expect(savedData).not.toBeNull();
      expect(savedData!.thumbnailId).toBe("media-thumb-123");
      expect(savedData!.thumbnailPreview).toBe("https://cdn.example.com/thumb.png");
    });

    it("removing a thumbnail clears both thumbnailId and thumbnailPreview", () => {
      let savedData: ProjectFormData | null = null;
      render(
        <ProjectForm
          project={baseFormProject}
          isEdit={false}
          onSave={(data) => {
            savedData = data;
          }}
          onCancel={vi.fn()}
        />
      );

      // Select thumbnail from library
      fireEvent.click(screen.getByRole("button", { name: /Choose Thumbnail from Library/i }));
      act(() => {
        thumbnailPickerProps.onSelect([createMockMediaItem("thumb-to-remove", "https://cdn.example.com/to-remove.png")]);
      });

      // Verify remove button appears and click it
      const removeBtn = screen.getByRole("button", { name: /Remove thumbnail/i });
      act(() => {
        fireEvent.click(removeBtn);
      });

      // Saving without replacement must be blocked per Requirement 4
      fireEvent.click(screen.getByRole("button", { name: /Save as Draft/i }));
      expect(savedData).toBeNull();
      expect(screen.getByText(/A thumbnail or cover image is required before saving/i)).toBeInTheDocument();

      // Now replace thumbnail with a new asset and verify saving succeeds
      fireEvent.click(screen.getByRole("button", { name: /Choose Thumbnail from Library/i }));
      act(() => {
        thumbnailPickerProps.onSelect([createMockMediaItem("thumb-replacement", "https://cdn.example.com/replacement.png")]);
      });

      fireEvent.click(screen.getByRole("button", { name: /Save as Draft/i }));
      expect(savedData!.thumbnailId).toBe("thumb-replacement");
      expect(savedData!.thumbnailPreview).toBe("https://cdn.example.com/replacement.png");
    });

    it("replacing a thumbnail synchronizes ID and preview with the new asset", () => {
      let savedData: ProjectFormData | null = null;
      render(
        <ProjectForm
          project={baseFormProject}
          isEdit={false}
          onSave={(data) => {
            savedData = data;
          }}
          onCancel={vi.fn()}
        />
      );

      // Select initial from library
      fireEvent.click(screen.getByRole("button", { name: /Choose Thumbnail from Library/i }));
      act(() => {
        thumbnailPickerProps.onSelect([createMockMediaItem("thumb-initial", "https://cdn.example.com/initial.png")]);
      });

      // Change thumbnail via library
      const changeBtn = screen.getByRole("button", { name: /Choose Thumbnail from Library/i });
      fireEvent.click(changeBtn);

      // Select replacement
      act(() => {
        thumbnailPickerProps.onSelect([createMockMediaItem("thumb-replacement", "https://cdn.example.com/replacement.png")]);
      });

      fireEvent.click(screen.getByRole("button", { name: /Save as Draft/i }));

      expect(savedData!.thumbnailId).toBe("thumb-replacement");
      expect(savedData!.thumbnailPreview).toBe("https://cdn.example.com/replacement.png");
    });

    it("renders separate controls for direct gallery upload and library picker", () => {
      render(
        <ProjectForm
          project={baseFormProject}
          isEdit={false}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: /Upload New Gallery Images/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Choose Gallery Images from Library/i })).toBeInTheDocument();
    });

    it("direct multi-file gallery upload uploads multiple files and attaches them in order", async () => {
      vi.mocked(adminClient.uploadMediaAsset)
        .mockResolvedValueOnce({
          success: true,
          data: {
            id: "gal-direct-1",
            name: "shot-1.png",
            publicUrl: "https://cdn.example.com/shot-1.png",
          } as any,
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            id: "gal-direct-2",
            name: "shot-2.png",
            publicUrl: "https://cdn.example.com/shot-2.png",
          } as any,
        });

      let savedData: ProjectFormData | null = null;
      const { container } = render(
        <ProjectForm
          project={baseFormProjectWithThumb}
          isEdit={false}
          onSave={(data) => {
            savedData = data;
          }}
          onCancel={vi.fn()}
        />
      );

      const galleryInput = container.querySelector('input[aria-label="Upload gallery images"]') as HTMLInputElement;
      expect(galleryInput).not.toBeNull();

      const files = [
        makeTestFile("shot-1.png", "image/png", 1000),
        makeTestFile("shot-2.png", "image/png", 2000),
      ];

      await act(async () => {
        fireEvent.change(galleryInput, { target: { files } });
      });

      await waitFor(() => {
        expect(adminClient.uploadMediaAsset).toHaveBeenCalledTimes(2);
      });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Save as Draft/i })).not.toBeDisabled();
      });

      fireEvent.click(screen.getByRole("button", { name: /Save as Draft/i }));

      expect(savedData!.galleryMediaIds).toEqual(["gal-direct-1", "gal-direct-2"]);
      expect(savedData!.galleryPreviews).toEqual([
        "https://cdn.example.com/shot-1.png",
        "https://cdn.example.com/shot-2.png",
      ]);
    });

    it("mixed gallery editing allows combining library selections and direct uploads", async () => {
      vi.mocked(adminClient.uploadMediaAsset).mockResolvedValueOnce({
        success: true,
        data: {
          id: "gal-direct-new",
          name: "uploaded.png",
          publicUrl: "https://cdn.example.com/uploaded.png",
        } as any,
      });

      let savedData: ProjectFormData | null = null;
      const { container } = render(
        <ProjectForm
          project={baseFormProjectWithThumb}
          isEdit={false}
          onSave={(data) => {
            savedData = data;
          }}
          onCancel={vi.fn()}
        />
      );

      // 1. Select from library first
      fireEvent.click(screen.getByRole("button", { name: /Choose Gallery Images from Library/i }));
      act(() => {
        galleryPickerProps.onSelect([
          createMockMediaItem("gal-lib-1", "https://cdn.example.com/lib-1.png"),
        ]);
      });

      // 2. Upload directly from computer
      const galleryInput = container.querySelector('input[aria-label="Upload gallery images"]') as HTMLInputElement;
      await act(async () => {
        fireEvent.change(galleryInput, { target: { files: [makeTestFile("uploaded.png", "image/png", 1000)] } });
      });

      await waitFor(() => {
        expect(adminClient.uploadMediaAsset).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Save as Draft/i })).not.toBeDisabled();
      });

      fireEvent.click(screen.getByRole("button", { name: /Save as Draft/i }));

      expect(savedData!.galleryMediaIds).toEqual(["gal-lib-1", "gal-direct-new"]);
      expect(savedData!.galleryPreviews).toEqual([
        "https://cdn.example.com/lib-1.png",
        "https://cdn.example.com/uploaded.png",
      ]);
    });

    it("enforces maximum of 10 gallery images and prevents duplicate references", async () => {
      let savedData: ProjectFormData | null = null;
      render(
        <ProjectForm
          project={baseFormProjectWithThumb}
          isEdit={false}
          onSave={(data) => {
            savedData = data;
          }}
          onCancel={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /Choose Gallery Images from Library/i }));

      // Select 12 assets
      const twelveAssets = Array.from({ length: 12 }, (_, i) =>
        createMockMediaItem(`gal-${i + 1}`, `https://cdn.example.com/gal-${i + 1}.png`)
      );
      act(() => {
        galleryPickerProps.onSelect(twelveAssets);
      });

      fireEvent.click(screen.getByRole("button", { name: /Save as Draft/i }));

      expect(savedData!.galleryMediaIds).toHaveLength(10);
      expect(savedData!.galleryPreviews).toHaveLength(10);
    });

    it("handles partial failure during multi-file gallery upload gracefully", async () => {
      vi.mocked(adminClient.uploadMediaAsset)
        .mockResolvedValueOnce({
          success: true,
          data: {
            id: "gal-success",
            name: "success.png",
            publicUrl: "https://cdn.example.com/success.png",
          } as any,
        })
        .mockResolvedValueOnce({
          success: false,
          error: "Storage quota exceeded",
        });

      let savedData: ProjectFormData | null = null;
      const { container } = render(
        <ProjectForm
          project={baseFormProjectWithThumb}
          isEdit={false}
          onSave={(data) => {
            savedData = data;
          }}
          onCancel={vi.fn()}
        />
      );

      const galleryInput = container.querySelector('input[aria-label="Upload gallery images"]') as HTMLInputElement;
      const files = [
        makeTestFile("success.png", "image/png", 1000),
        makeTestFile("failed.png", "image/png", 1000),
      ];

      await act(async () => {
        fireEvent.change(galleryInput, { target: { files } });
      });

      await waitFor(() => {
        expect(adminClient.uploadMediaAsset).toHaveBeenCalledTimes(2);
      });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Save as Draft/i })).not.toBeDisabled();
      });

      fireEvent.click(screen.getByRole("button", { name: /Save as Draft/i }));

      // The successful one was added despite the second failing
      expect(savedData!.galleryMediaIds).toEqual(["gal-success"]);
      expect(savedData!.galleryPreviews).toEqual(["https://cdn.example.com/success.png"]);
    });

    it("resets file inputs so user can select the same file repeatedly", async () => {
      vi.mocked(adminClient.uploadMediaAsset).mockResolvedValue({
        success: true,
        data: {
          id: "same-file-id",
          name: "repeated.png",
          publicUrl: "https://cdn.example.com/repeated.png",
        } as any,
      });

      const { container } = render(
        <ProjectForm
          project={baseFormProject}
          isEdit={false}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const thumbFileInput = container.querySelector('input[aria-label="Upload thumbnail image"]') as HTMLInputElement;
      const file = makeTestFile("repeated.png", "image/png", 1000);

      await act(async () => {
        fireEvent.change(thumbFileInput, { target: { files: [file] } });
      });

      // After upload finishes, file input value should be cleared
      await waitFor(() => {
        expect(thumbFileInput.value).toBe("");
      });
    });

    it("disables project submission buttons while uploads are in flight", async () => {
      let resolveUpload: any;
      const pendingUploadPromise = new Promise<{ success: boolean; data: any }>((resolve) => {
        resolveUpload = resolve;
      });

      vi.mocked(adminClient.uploadMediaAsset).mockReturnValueOnce(pendingUploadPromise as any);

      const { container } = render(
        <ProjectForm
          project={baseFormProject}
          isEdit={false}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const thumbFileInput = container.querySelector('input[aria-label="Upload thumbnail image"]') as HTMLInputElement;
      const file = makeTestFile("in-flight.png", "image/png", 1000);

      // Trigger upload
      act(() => {
        fireEvent.change(thumbFileInput, { target: { files: [file] } });
      });

      // While upload is pending, submit buttons should be disabled and show "Uploading Media..."
      const uploadButtons = screen.getAllByRole("button", { name: /Uploading Media.../i });
      expect(uploadButtons.length).toBeGreaterThanOrEqual(1);
      uploadButtons.forEach((btn) => expect(btn).toBeDisabled());

      // Resolve the upload
      await act(async () => {
        resolveUpload({
          success: true,
          data: {
            id: "resolved-thumb",
            name: "in-flight.png",
            publicUrl: "https://cdn.example.com/in-flight.png",
          },
        });
      });

      // After upload resolves, submit button is enabled again
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Save as Draft/i })).not.toBeDisabled();
      });
    });

    it("removing a gallery item keeps IDs and previews aligned", () => {
      let savedData: ProjectFormData | null = null;
      render(
        <ProjectForm
          project={baseFormProjectWithThumb}
          isEdit={false}
          onSave={(data) => {
            savedData = data;
          }}
          onCancel={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /Choose Gallery Images from Library/i }));
      act(() => {
        galleryPickerProps.onSelect([
          createMockMediaItem("gal-A", "https://cdn.example.com/gal-A.png"),
          createMockMediaItem("gal-B", "https://cdn.example.com/gal-B.png"),
          createMockMediaItem("gal-C", "https://cdn.example.com/gal-C.png"),
        ]);
      });

      // Remove middle item (gal-B)
      const removeButtons = screen.getAllByRole("button", { name: /Remove gallery image/i });
      expect(removeButtons).toHaveLength(3);
      act(() => {
        fireEvent.click(removeButtons[1]!);
      });

      fireEvent.click(screen.getByRole("button", { name: /Save as Draft/i }));

      expect(savedData!.galleryMediaIds).toEqual(["gal-A", "gal-C"]);
      expect(savedData!.galleryPreviews).toEqual([
        "https://cdn.example.com/gal-A.png",
        "https://cdn.example.com/gal-C.png",
      ]);
    });

    it("editing an existing project hydrates saved thumbnailId and galleryMediaIds", () => {
      const existingProject: ProjectItem = {
        id: "proj-campus-connect",
        name: "Campus Connect",
        description: "Collaborative portal for campus communities.",
        fullDescription: "Detailed description of Campus Connect.",
        category: "Full Stack Development",
        technologies: ["React", "TypeScript"],
        status: "Published",
        order: 1,
        image: "https://cdn.example.com/saved-thumb.png",
        thumbnailId: "media-saved-thumb",
        galleryMediaIds: ["media-gal-101", "media-gal-102"],
        galleryPreviews: [
          "https://cdn.example.com/saved-gal-101.png",
          "https://cdn.example.com/saved-gal-102.png",
        ],
        liveUrl: "https://campusconnect.edu",
        featured: true,
        tags: ["EdTech"],
      };

      let savedData: ProjectFormData | null = null;
      render(
        <ProjectForm
          isEdit={true}
          project={existingProject}
          onSave={(data) => {
            savedData = data;
          }}
          onCancel={vi.fn()}
        />
      );

      // Save without changes
      fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

      expect(savedData).not.toBeNull();
      expect(savedData!.thumbnailId).toBe("media-saved-thumb");
      expect(savedData!.thumbnailPreview).toBe("https://cdn.example.com/saved-thumb.png");
      expect(savedData!.galleryMediaIds).toEqual(["media-gal-101", "media-gal-102"]);
      expect(savedData!.galleryPreviews).toEqual([
        "https://cdn.example.com/saved-gal-101.png",
        "https://cdn.example.com/saved-gal-102.png",
      ]);
    });
  });

  // =========================================================================
  // Section 2: Server-Side Validation and Data Integrity (Part C)
  // =========================================================================
  describe("2. Server-Side Validation and Data Integrity", () => {
    const adminUser: User = {
      id: "admin-uuid-1",
      email: "admin@cobralearn.com",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };

    const editorUser: User = {
      id: "editor-uuid-1",
      email: "editor@cobralearn.com",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };

    function createAuthRequest(user: User, currentLevel: "aal1" | "aal2" = "aal1"): Request {
      (getSupabaseServerClient as any).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user },
            error: null,
          }),
          mfa: {
            getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
              data: { currentLevel, nextLevel: currentLevel, currentAuthenticationMethods: [] },
              error: null,
            }),
          },
        },
      });

      return new Request("https://api.internal/admin/projects", {
        headers: {
          authorization: `Bearer mock-token-${user.id}`,
          cookie: `sb-access-token=mock-token-${user.id}`,
        },
      });
    }

    function createMockPrismaWithAssets(existingAssetIds: string[]) {
      const mockProjects: Project[] = [];
      let mockGalleryItems: ProjectGalleryItem[] = [];

      const prisma = {
        adminProfile: {
          findUnique: vi.fn().mockImplementation(({ where }: any) => {
            if (where.id === adminUser.id || where.email === adminUser.email) {
              return Promise.resolve({
                id: adminUser.id,
                email: adminUser.email,
                role: "ADMIN" as AdminRole,
                isActive: true,
                fullName: "Admin User",
              });
            }
            if (where.id === editorUser.id || where.email === editorUser.email) {
              return Promise.resolve({
                id: editorUser.id,
                email: editorUser.email,
                role: "EDITOR" as AdminRole,
                isActive: true,
                fullName: "Editor User",
              });
            }
            return Promise.resolve(null);
          }),
        },
        mediaAsset: {
          findUnique: vi.fn().mockImplementation(({ where }: any) => {
            if (existingAssetIds.includes(where.id)) {
              return Promise.resolve({
                id: where.id,
                filename: `${where.id}.png`,
                publicUrl: `https://cdn.example.com/${where.id}.png`,
              } as unknown as MediaAsset);
            }
            return Promise.resolve(null);
          }),
          findMany: vi.fn().mockImplementation(({ where }: any) => {
            const requested: string[] = where?.id?.in || [];
            const matches = requested.filter((id) => existingAssetIds.includes(id));
            return Promise.resolve(
              matches.map((id) => ({
                id,
                filename: `${id}.png`,
                publicUrl: `https://cdn.example.com/${id}.png`,
              } as unknown as MediaAsset))
            );
          }),
          delete: vi.fn(),
        },
        project: {
          findFirst: vi.fn().mockImplementation(({ where }: any) => {
            const match = mockProjects.find((p) => (where.slug && p.slug === where.slug) || (where.id && p.id === where.id));
            if (!match) return Promise.resolve(null);
            return Promise.resolve({
              ...match,
              thumbnail: match.thumbnailId ? { id: match.thumbnailId, publicUrl: `https://cdn.example.com/${match.thumbnailId}.png` } : null,
              gallery: mockGalleryItems
                .filter((g) => g.projectId === match.id)
                .map((g) => ({ ...g, media: { id: g.mediaId, publicUrl: `https://cdn.example.com/${g.mediaId}.png` } })),
            });
          }),
          findUnique: vi.fn().mockImplementation(({ where }: any) => {
            const match = mockProjects.find((p) => p.id === where.id || p.slug === where.slug);
            if (!match) return Promise.resolve(null);
            return Promise.resolve({
              ...match,
              thumbnail: match.thumbnailId ? { id: match.thumbnailId, publicUrl: `https://cdn.example.com/${match.thumbnailId}.png` } : null,
              gallery: mockGalleryItems
                .filter((g) => g.projectId === match.id)
                .map((g) => ({ ...g, media: { id: g.mediaId, publicUrl: `https://cdn.example.com/${g.mediaId}.png` } })),
            });
          }),
          create: vi.fn().mockImplementation(({ data }: any) => {
            const proj: Project = {
              id: `proj-${Date.now()}`,
              name: data.name,
              slug: data.slug,
              description: data.description,
              fullDescription: data.fullDescription || null,
              category: data.category || "Full Stack",
              status: data.status || "DRAFT",
              featured: Boolean(data.featured),
              displayOrder: data.displayOrder ?? 0,
              projectDuration: data.projectDuration || null,
              teamSize: data.teamSize || null,
              technologies: data.technologies || [],
              tags: data.tags || [],
              liveUrl: data.liveUrl || null,
              githubUrl: data.githubUrl || null,
              videoUrl: data.videoUrl || null,
              thumbnailId: data.thumbnailId || null,
              publishedAt: data.publishedAt || null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockProjects.push(proj);
            return Promise.resolve(proj);
          }),
          update: vi.fn().mockImplementation(({ where, data }: any) => {
            const idx = mockProjects.findIndex((p) => p.id === where.id);
            if (idx === -1) throw new Error("Not found");
            const updated = { ...mockProjects[idx]!, ...data, updatedAt: new Date() };
            mockProjects[idx] = updated;
            return Promise.resolve(updated);
          }),
          delete: vi.fn().mockImplementation(({ where }: any) => {
            const idx = mockProjects.findIndex((p) => p.id === where.id);
            if (idx === -1) throw new Error("Not found");
            const deleted = mockProjects.splice(idx, 1)[0];
            mockGalleryItems = mockGalleryItems.filter((g) => g.projectId !== where.id);
            return Promise.resolve(deleted);
          }),
        },
        projectGalleryItem: {
          create: vi.fn().mockImplementation(({ data }: any) => {
            const item: ProjectGalleryItem = {
              id: `gal-item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              projectId: data.projectId,
              mediaId: data.mediaId,
              displayOrder: data.displayOrder,
            };
            mockGalleryItems.push(item);
            return Promise.resolve(item);
          }),
          deleteMany: vi.fn().mockImplementation(({ where }: any) => {
            if (where.projectId) {
              mockGalleryItems = mockGalleryItems.filter((g) => g.projectId !== where.projectId);
            }
            return Promise.resolve({ count: 1 });
          }),
        },
        adminAuditLog: {
          create: vi.fn().mockResolvedValue({ id: "log-1" }),
        },
        $transaction: vi.fn().mockImplementation(async (cb: any) => cb(prisma)),
      };

      return { prisma: prisma as unknown as PrismaClient, mockProjects, mockGalleryItems };
    }

    it("rejects project creation when gallery has more than 10 media IDs", async () => {
      const existingAssets = Array.from({ length: 15 }, (_, i) => `asset-${i + 1}`);
      const { prisma } = createMockPrismaWithAssets(["thumb-valid", ...existingAssets]);
      const req = createAuthRequest(adminUser);

      await expect(
        createAdminProjectOperation(
          req,
          {
            name: "Oversized Gallery Project",
            description: "Test description",
            thumbnailId: "thumb-valid",
            galleryMediaIds: existingAssets.slice(0, 11),
          },
          prisma
        )
      ).rejects.toThrow(/Maximum of 10 gallery images allowed/i);

      expect(prisma.project.create).not.toHaveBeenCalled();
    });

    it("rejects project creation when gallery contains duplicate IDs", async () => {
      const { prisma } = createMockPrismaWithAssets(["thumb-valid", "asset-1", "asset-2"]);
      const req = createAuthRequest(adminUser);

      await expect(
        createAdminProjectOperation(
          req,
          {
            name: "Duplicate Gallery Project",
            description: "Test description",
            thumbnailId: "thumb-valid",
            galleryMediaIds: ["asset-1", "asset-1"],
          },
          prisma
        )
      ).rejects.toThrow(/Duplicate gallery media items/i);

      expect(prisma.project.create).not.toHaveBeenCalled();
    });

    it("rejects non-existent thumbnailId", async () => {
      const { prisma } = createMockPrismaWithAssets(["valid-asset"]);
      const req = createAuthRequest(adminUser);

      await expect(
        createAdminProjectOperation(
          req,
          {
            name: "Invalid Thumbnail Project",
            description: "Test description",
            thumbnailId: "non-existent-thumb-id",
          },
          prisma
        )
      ).rejects.toThrow(/Referenced thumbnail media asset.*does not exist/i);

      expect(prisma.project.create).not.toHaveBeenCalled();
    });

    it("rejects non-existent galleryMediaIds", async () => {
      const { prisma } = createMockPrismaWithAssets(["thumb-valid", "valid-asset-1"]);
      const req = createAuthRequest(adminUser);

      await expect(
        createAdminProjectOperation(
          req,
          {
            name: "Invalid Gallery Project",
            description: "Test description",
            thumbnailId: "thumb-valid",
            galleryMediaIds: ["valid-asset-1", "ghost-asset-2"],
          },
          prisma
        )
      ).rejects.toThrow(/Referenced gallery media asset\(s\) not found/i);

      expect(prisma.project.create).not.toHaveBeenCalled();
    });

    it("persists valid thumbnail and gallery relationships in order", async () => {
      const { prisma } = createMockPrismaWithAssets(["thumb-valid", "gal-1", "gal-2"]);
      const req = createAuthRequest(adminUser);

      const res = await createAdminProjectOperation(
        req,
        {
          name: "Valid Project",
          description: "Test description",
          thumbnailId: "thumb-valid",
          galleryMediaIds: ["gal-1", "gal-2"],
        },
        prisma
      );

      expect(res.project).toBeDefined();
      expect(prisma.project.create).toHaveBeenCalled();
      expect(prisma.projectGalleryItem.create).toHaveBeenCalledTimes(2);
      expect(prisma.projectGalleryItem.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: expect.objectContaining({
            mediaId: "gal-1",
            displayOrder: 0,
          }),
        })
      );
      expect(prisma.projectGalleryItem.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: expect.objectContaining({
            mediaId: "gal-2",
            displayOrder: 1,
          }),
        })
      );
    });

    it("updating gallery replaces join records without deleting underlying MediaAsset records", async () => {
      const { prisma, mockProjects } = createMockPrismaWithAssets(["gal-1", "gal-2", "gal-3", "thumb-existing"]);
      const req = createAuthRequest(adminUser);

      // Seed initial project
      mockProjects.push({
        id: "proj-existing",
        name: "Existing Project",
        slug: "existing-project",
        description: "Desc",
        fullDescription: null,
        category: "Full Stack",
        status: "PUBLISHED",
        featured: false,
        displayOrder: 0,
        projectDuration: null,
        teamSize: null,
        technologies: [],
        tags: [],
        liveUrl: null,
        githubUrl: null,
        videoUrl: null,
        thumbnailId: "thumb-existing",
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await updateAdminProjectOperation(
        req,
        "proj-existing",
        {
          galleryMediaIds: ["gal-3"],
        },
        prisma
      );

      expect(res.project).toBeDefined();
      // Join records were deleted via deleteMany
      expect(prisma.projectGalleryItem.deleteMany).toHaveBeenCalledWith({
        where: { projectId: "proj-existing" },
      });
      // New join record created
      expect(prisma.projectGalleryItem.create).toHaveBeenCalledWith({
        data: {
          projectId: "proj-existing",
          mediaId: "gal-3",
          displayOrder: 0,
        },
      });
      // MediaAsset was NEVER deleted
      expect(prisma.mediaAsset.delete).not.toHaveBeenCalled();
    }, 15000);

    it("preserves RBAC delete restriction for EDITOR role", async () => {
      const { prisma, mockProjects } = createMockPrismaWithAssets([]);
      const req = createAuthRequest(editorUser, "aal2");

      mockProjects.push({
        id: "proj-locked",
        name: "Locked Project",
        slug: "locked-project",
        description: "Desc",
        fullDescription: null,
        category: "Full Stack",
        status: "DRAFT",
        featured: false,
        displayOrder: 0,
        projectDuration: null,
        teamSize: null,
        technologies: [],
        tags: [],
        liveUrl: null,
        githubUrl: null,
        videoUrl: null,
        thumbnailId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(deleteAdminProjectOperation(req, "proj-locked", prisma)).rejects.toThrow(
        /Forbidden: Role "EDITOR" lacks required permission/i
      );
      expect(prisma.project.delete).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Section 3: Public Project Detail Mapping & Rendering (Part D)
  // =========================================================================
  describe("3. Public Project Detail Mapping & Rendering", () => {
    const fullProjectWithMedia = {
      id: "proj-campus-connect-full",
      name: "Campus Connect",
      slug: "campus-connect",
      description: "Collaborative portal for campus communities.",
      fullDescription: "Campus Connect is a comprehensive community portal featuring real-time messaging and event management.",
      category: "Full Stack Development",
      status: "PUBLISHED" as const,
      featured: true,
      displayOrder: 1,
      projectDuration: "3 Months",
      teamSize: "4 Engineers",
      technologies: ["React", "TypeScript", "Tailwind CSS", "Prisma"],
      tags: ["EdTech", "Community", "WebSockets"],
      liveUrl: "https://campusconnect.edu",
      githubUrl: "https://github.com/cobralearn/campus-connect",
      videoUrl: "https://youtube.com/watch?v=demo123",
      thumbnailId: "thumb-campus-media-id",
      thumbnail: {
        id: "thumb-campus-media-id",
        publicUrl: "https://cdn.example.com/campus-connect-thumb.png",
      },
      gallery: [
        {
          id: "gal-rel-1",
          projectId: "proj-campus-connect-full",
          mediaId: "media-shot-1",
          displayOrder: 0,
          media: {
            id: "media-shot-1",
            name: "dashboard.png",
            altText: "Campus Connect Dashboard",
            publicUrl: "https://cdn.example.com/shot-1.png",
          },
        },
        {
          id: "gal-rel-2",
          projectId: "proj-campus-connect-full",
          mediaId: "media-shot-2",
          displayOrder: 1,
          media: {
            id: "media-shot-2",
            name: "chat.png",
            altText: "Campus Connect Realtime Chat",
            publicUrl: "https://cdn.example.com/shot-2.png",
          },
        },
      ],
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("projectToPublicDetailItem maps all rich fields and ordered gallery", () => {
      const publicDetail = projectToPublicDetailItem(fullProjectWithMedia as any);

      expect(publicDetail.title).toBe("Campus Connect");
      expect(publicDetail.slug).toBe("campus-connect");
      expect(publicDetail.description).toBe("Collaborative portal for campus communities.");
      expect(publicDetail.fullDescription).toBe(fullProjectWithMedia.fullDescription);
      expect(publicDetail.image).toBe("https://cdn.example.com/campus-connect-thumb.png");
      expect(publicDetail.thumbnailId).toBe("thumb-campus-media-id");
      expect(publicDetail.projectDuration).toBe("3 Months");
      expect(publicDetail.teamSize).toBe("4 Engineers");
      expect(publicDetail.technologies).toEqual(["React", "TypeScript", "Tailwind CSS", "Prisma"]);
      expect(publicDetail.tags).toEqual(["EdTech", "Community", "WebSockets"]);
      expect(publicDetail.liveUrl).toBe("https://campusconnect.edu");
      expect(publicDetail.githubUrl).toBe("https://github.com/cobralearn/campus-connect");
      expect(publicDetail.videoUrl).toBe("https://youtube.com/watch?v=demo123");
      expect(publicDetail.gallery).toHaveLength(2);
      expect(publicDetail.gallery[0]).toEqual({
        id: "gal-rel-1",
        mediaId: "media-shot-1",
        url: "https://cdn.example.com/shot-1.png",
        name: "dashboard.png",
        altText: "Campus Connect Dashboard",
        displayOrder: 0,
      });
      expect(publicDetail.gallery[1]).toEqual({
        id: "gal-rel-2",
        mediaId: "media-shot-2",
        url: "https://cdn.example.com/shot-2.png",
        name: "chat.png",
        altText: "Campus Connect Realtime Chat",
        displayOrder: 1,
      });
    });

    it("projectToItem maps thumbnailId and galleryMediaIds for admin edit hydration", () => {
      const item = projectToItem(fullProjectWithMedia as any);

      expect(item.thumbnailId).toBe("thumb-campus-media-id");
      expect(item.image).toBe("https://cdn.example.com/campus-connect-thumb.png");
      expect(item.galleryMediaIds).toEqual(["media-shot-1", "media-shot-2"]);
      expect(item.galleryPreviews).toEqual([
        "https://cdn.example.com/shot-1.png",
        "https://cdn.example.com/shot-2.png",
      ]);
    });

    it("DetailPage renders persistent thumbnail and rich project details", () => {
      const detailItem = projectToPublicDetailItem(fullProjectWithMedia as any);

      render(<DetailPage item={detailItem} type="projects" />);

      // Hero image is rendered with real persistent URL
      const heroImg = screen.getByRole("img", { name: "Campus Connect" });
      expect(heroImg).toHaveAttribute("src", "https://cdn.example.com/campus-connect-thumb.png");

      // Metadata badges
      expect(screen.getByText("3 Months")).toBeInTheDocument();
      expect(screen.getByText("4 Engineers")).toBeInTheDocument();

      // External Links
      const liveLink = screen.getByRole("link", { name: /Live Demo/i });
      expect(liveLink).toHaveAttribute("href", "https://campusconnect.edu");
      const githubLink = screen.getByRole("link", { name: /Source Code/i });
      expect(githubLink).toHaveAttribute("href", "https://github.com/cobralearn/campus-connect");
      const videoLink = screen.getByRole("link", { name: /Watch Demo/i });
      expect(videoLink).toHaveAttribute("href", "https://youtube.com/watch?v=demo123");

      // Technologies
      expect(screen.getByText("React")).toBeInTheDocument();
      expect(screen.getByText("TypeScript")).toBeInTheDocument();
      expect(screen.getByText("Prisma")).toBeInTheDocument();

      // Full description
      expect(screen.getByText(fullProjectWithMedia.fullDescription)).toBeInTheDocument();

      // Tags
      expect(screen.getByText("#EdTech")).toBeInTheDocument();
      expect(screen.getByText("#WebSockets")).toBeInTheDocument();

      // Gallery Images
      const galleryImg1 = screen.getByRole("img", { name: "Campus Connect Dashboard" });
      expect(galleryImg1).toHaveAttribute("src", "https://cdn.example.com/shot-1.png");
      const galleryImg2 = screen.getByRole("img", { name: "Campus Connect Realtime Chat" });
      expect(galleryImg2).toHaveAttribute("src", "https://cdn.example.com/shot-2.png");
    });

    it("DetailPage does NOT silently inject static Smart Home placeholder when thumbnail is absent", () => {
      const projectWithoutThumb = {
        ...fullProjectWithMedia,
        thumbnailId: null,
        thumbnail: null,
        gallery: [],
      };

      const detailItem = projectToPublicDetailItem(projectWithoutThumb as any);
      expect(detailItem.image).toBe("");

      render(<DetailPage item={detailItem} type="projects" />);

      // Ensure no image references static fallback thumb-project.jpg
      const allImages = screen.getAllByRole("img");
      for (const img of allImages) {
        expect(img.getAttribute("src")).not.toContain("thumb-project.jpg");
      }
      expect(screen.queryByAltText("Campus Connect")).not.toBeInTheDocument();
    });

    it("draft projects remain inaccessible via getPublicProjectBySlugOperation", async () => {
      const prisma = {
        project: {
          findFirst: vi.fn().mockImplementation(({ where }: any) => {
            // Security invariant check: query filters by status: 'PUBLISHED'
            expect(where.status).toBe("PUBLISHED");
            return Promise.resolve(null);
          }),
        },
      } as unknown as PrismaClient;

      const res = await getPublicProjectBySlugOperation("draft-project-slug", prisma);
      expect(res.project).toBeNull();
    });

    it("projectToShowcaseItem retains backwards-compatible homepage showcase mapping", () => {
      const showcaseItem = projectToShowcaseItem(fullProjectWithMedia as any);

      expect(showcaseItem.title).toBe("Campus Connect");
      expect(showcaseItem.slug).toBe("campus-connect");
      expect(showcaseItem.image).toBe("https://cdn.example.com/campus-connect-thumb.png");
      expect(showcaseItem.accent).toBe("orange");
      expect(showcaseItem.published).toBe(true);
      expect(showcaseItem.order).toBe(1);
    });
  });

  describe("7. Projects Module Enhancements: Gallery Reordering & Truthful Loading State", () => {
    const mockMultiGalleryProject: ProjectItem = {
      id: "proj-multi-gallery",
      name: "Smart City Traffic",
      category: "AI / ML",
      description: "Intelligent camera tracking system",
      technologies: ["Python", "TensorFlow"],
      status: "Published",
      order: 1,
      image: "https://cdn.example.com/thumb.jpg",
      thumbnailId: "thumb-1",
      galleryPreviews: [
        "https://cdn.example.com/gallery-1.jpg",
        "https://cdn.example.com/gallery-2.jpg",
        "https://cdn.example.com/gallery-3.jpg",
      ],
      galleryMediaIds: ["media-1", "media-2", "media-3"],
    };

    it("renders Move Left and Move Right controls with correct boundary disabled states", () => {
      render(
        <ProjectForm
          project={mockMultiGalleryProject}
          isEdit={true}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const moveLeftButtons = screen.getAllByRole("button", { name: "Move gallery image left" });
      const moveRightButtons = screen.getAllByRole("button", { name: "Move gallery image right" });

      expect(moveLeftButtons).toHaveLength(3);
      expect(moveRightButtons).toHaveLength(3);

      // First image (index 0): Move Left disabled, Move Right enabled
      expect(moveLeftButtons[0]).toBeDisabled();
      expect(moveRightButtons[0]).toBeEnabled();

      // Middle image (index 1): Both enabled
      expect(moveLeftButtons[1]).toBeEnabled();
      expect(moveRightButtons[1]).toBeEnabled();

      // Last image (index 2): Move Left enabled, Move Right disabled
      expect(moveLeftButtons[2]).toBeEnabled();
      expect(moveRightButtons[2]).toBeDisabled();
    });

    it("swaps image sequence immediately when Move Right is clicked and marks form dirty", () => {
      const onDirtyChange = vi.fn();
      let savedData: ProjectFormData | null = null;

      render(
        <ProjectForm
          project={mockMultiGalleryProject}
          isEdit={true}
          onSave={(data) => {
            savedData = data;
          }}
          onCancel={vi.fn()}
          onDirtyChange={onDirtyChange}
        />
      );

      const moveRightButtons = screen.getAllByRole("button", { name: "Move gallery image right" });

      // Move first image ("media-1") to the right (to index 1)
      fireEvent.click(moveRightButtons[0]!);

      expect(onDirtyChange).toHaveBeenCalledWith(true, expect.objectContaining({
        galleryMediaIds: ["media-2", "media-1", "media-3"],
        galleryPreviews: [
          "https://cdn.example.com/gallery-2.jpg",
          "https://cdn.example.com/gallery-1.jpg",
          "https://cdn.example.com/gallery-3.jpg",
        ],
      }));

      // Click save button to inspect submitted payload
      const saveBtn = screen.getByRole("button", { name: /save changes/i });
      fireEvent.click(saveBtn);

      expect(savedData).not.toBeNull();
      expect((savedData as any).galleryMediaIds).toEqual(["media-2", "media-1", "media-3"]);
    });

    it("swaps image sequence immediately when Move Left is clicked", () => {
      const onDirtyChange = vi.fn();

      render(
        <ProjectForm
          project={mockMultiGalleryProject}
          isEdit={true}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onDirtyChange={onDirtyChange}
        />
      );

      const moveLeftButtons = screen.getAllByRole("button", { name: "Move gallery image left" });

      // Move last image ("media-3" at index 2) to the left (to index 1)
      fireEvent.click(moveLeftButtons[2]!);

      expect(onDirtyChange).toHaveBeenCalledWith(true, expect.objectContaining({
        galleryMediaIds: ["media-1", "media-3", "media-2"],
        galleryPreviews: [
          "https://cdn.example.com/gallery-1.jpg",
          "https://cdn.example.com/gallery-3.jpg",
          "https://cdn.example.com/gallery-2.jpg",
        ],
      }));
    });

    it("restores saved gallery sequence when rehydrating edit form from database record", () => {
      const dbProject: any = {
        id: "proj-saved",
        name: "Restored Project",
        slug: "restored-project",
        description: "Rehydrated test",
        category: "Full Stack",
        status: "PUBLISHED",
        displayOrder: 1,
        technologies: ["Vue", "Node"],
        tags: [],
        thumbnail: { publicUrl: "https://cdn.example.com/thumb.png" },
        gallery: [
          { id: "g-1", mediaId: "media-c", displayOrder: 0, media: { publicUrl: "https://cdn.example.com/img-c.png" } },
          { id: "g-2", mediaId: "media-a", displayOrder: 1, media: { publicUrl: "https://cdn.example.com/img-a.png" } },
          { id: "g-3", mediaId: "media-b", displayOrder: 2, media: { publicUrl: "https://cdn.example.com/img-b.png" } },
        ],
      };

      const hydratedItem = projectToItem(dbProject);
      expect(hydratedItem.galleryMediaIds).toEqual(["media-c", "media-a", "media-b"]);
      expect(hydratedItem.galleryPreviews).toEqual([
        "https://cdn.example.com/img-c.png",
        "https://cdn.example.com/img-a.png",
        "https://cdn.example.com/img-b.png",
      ]);

      const { container } = render(
        <ProjectForm
          project={hydratedItem}
          isEdit={true}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const images = Array.from(container.querySelectorAll("img"));
      const gallerySrcs = images.map((img) => img.getAttribute("src")).filter((src) => src?.includes("img-"));
      expect(gallerySrcs).toEqual([
        "https://cdn.example.com/img-c.png",
        "https://cdn.example.com/img-a.png",
        "https://cdn.example.com/img-b.png",
      ]);
    });

    it("public project detail gallery renders items in exact saved display order", () => {
      const publicProjectWithOrderedGallery: any = {
        id: "proj-public-ordered",
        name: "Ordered Public Gallery",
        slug: "ordered-public-gallery",
        description: "Testing public gallery order",
        category: "Mobile",
        status: "PUBLISHED",
        displayOrder: 1,
        thumbnail: { publicUrl: "https://cdn.example.com/thumb.png" },
        gallery: [
          { id: "g-1", mediaId: "m-first", displayOrder: 0, media: { publicUrl: "https://cdn.example.com/step-1.jpg", name: "Step 1" } },
          { id: "g-2", mediaId: "m-second", displayOrder: 1, media: { publicUrl: "https://cdn.example.com/step-2.jpg", name: "Step 2" } },
          { id: "g-3", mediaId: "m-third", displayOrder: 2, media: { publicUrl: "https://cdn.example.com/step-3.jpg", name: "Step 3" } },
        ],
      };

      const publicDetail = projectToPublicDetailItem(publicProjectWithOrderedGallery);
      expect(publicDetail.gallery.map((g) => g.url)).toEqual([
        "https://cdn.example.com/step-1.jpg",
        "https://cdn.example.com/step-2.jpg",
        "https://cdn.example.com/step-3.jpg",
      ]);

      const { container } = render(<DetailPage item={publicDetail} type="projects" />);

      expect(screen.getByText("Project Gallery (3)")).toBeInTheDocument();
      const galleryImages = Array.from(container.querySelectorAll("img")).filter((img) => img.getAttribute("src")?.includes("step-"));
      expect(galleryImages.map((img) => img.getAttribute("src"))).toEqual([
        "https://cdn.example.com/step-1.jpg",
        "https://cdn.example.com/step-2.jpg",
        "https://cdn.example.com/step-3.jpg",
      ]);
    });

    it("ProjectsLoadingState renders truthful indeterminate progress by default without fabricated percentage", () => {
      render(<ProjectsLoadingState />);

      // Must have role="status"
      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByText("Loading Projects...")).toBeInTheDocument();
      expect(screen.getByText("Please wait while we fetch your data.")).toBeInTheDocument();

      // Indeterminate progress bar and status badge present
      expect(screen.getByTestId("indeterminate-progress-bar")).toBeInTheDocument();
      expect(screen.getByTestId("loading-status-badge")).toHaveTextContent("Fetching...");

      // Must NOT display any fabricated percentage (e.g. 75% or 68%)
      expect(screen.queryByTestId("progress-percentage")).toBeNull();
      expect(screen.queryByText("75%")).toBeNull();
      expect(screen.queryByText("68%")).toBeNull();
    });

    it("ProjectsLoadingState renders determinate progress bar and percentage when measurable progress is supplied", () => {
      render(<ProjectsLoadingState progress={45} statusText="Downloading assets..." />);

      expect(screen.getByText("Downloading assets...")).toBeInTheDocument();
      const progressBar = screen.getByTestId("determinate-progress-bar");
      expect(progressBar).toBeInTheDocument();
      expect(progressBar.style.width).toBe("45%");

      const percentage = screen.getByTestId("progress-percentage");
      expect(percentage).toHaveTextContent("45%");
    });
  });
});
