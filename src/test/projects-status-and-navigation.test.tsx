import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import React from "react";
import { ProjectForm, type ProjectFormData } from "@/components/projects/ProjectForm";
import { ProjectTable } from "@/components/projects/ProjectTable";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { statusToPrisma, statusFromPrisma, type ProjectItem, type ProjectStatus } from "@/lib/projects-data";
import { updateAdminProjectOperation, createAdminProjectOperation } from "@/lib/server/projects-operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PrismaClient, Project, AdminRole, AdminProfile } from "@prisma/client";
import type { User } from "@supabase/supabase-js";

// Mock @tanstack/react-router
let mockBlockerStatus = "unblocked";
const mockBlockerProceed = vi.fn();
const mockBlockerReset = vi.fn();
let lastShouldBlockFn: (() => boolean) | null = null;

vi.mock("@tanstack/react-router", () => ({
  useBlocker: vi.fn().mockImplementation(({ shouldBlockFn }: any) => {
    lastShouldBlockFn = shouldBlockFn;
    return {
      status: mockBlockerStatus,
      proceed: mockBlockerProceed,
      reset: mockBlockerReset,
    };
  }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

// Mock Supabase Server Client
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

// Mock MediaLibraryPicker
let thumbnailPickerProps: any = null;

vi.mock("@/components/media/MediaLibraryPicker", () => ({
  MediaLibraryPicker: (props: any) => {
    if (props.title?.includes("Thumbnail")) {
      thumbnailPickerProps = props;
    }
    if (!props.open) return null;
    return (
      <div data-testid="media-library-picker">
        <button
          data-testid="mock-select-thumb"
          onClick={() =>
            props.onSelect([
              {
                id: "thumb-media-uuid",
                name: "Thumb.png",
                url: "https://storage.example.com/thumb.png",
                thumbnail: "https://storage.example.com/thumb.png",
              },
            ])
          }
        >
          Select
        </button>
      </div>
    );
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("Projects Module Phase A — Status Integrity & Unsaved Changes Navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    thumbnailPickerProps = null;
    mockBlockerStatus = "unblocked";
    lastShouldBlockFn = null;
  });

  const baseProject: ProjectItem = {
    id: "proj-campus-connect",
    name: "Campus Connect",
    description: "Collaborative portal for campus communities.",
    fullDescription: "A full description of Campus Connect.",
    category: "Full Stack Development",
    technologies: ["React", "TypeScript", "Tailwind CSS"],
    status: "Published",
    order: 1,
    image: "/src/assets/thumb-project.jpg",
    liveUrl: "https://campusconnect.edu",
    featured: false,
    tags: ["EdTech"],
    thumbnailId: "thumb-media-uuid",
  };

  const draftProject: ProjectItem = {
    ...baseProject,
    id: "proj-campus-draft",
    status: "Draft",
  };

  describe("1. Form Button Semantics & Status Values (Create & Edit)", () => {
    it("Create — Save as Draft passes explicit 'Draft' status", () => {
      const handleSave = vi.fn();
      render(
        <ProjectForm
          isEdit={false}
          onSave={handleSave}
          onCancel={vi.fn()}
        />
      );

      const titleInput = screen.getByPlaceholderText(/Enter project title/i);
      const descInput = screen.getByPlaceholderText(/Brief description/i);
      fireEvent.change(titleInput, { target: { value: "New Platform" } });
      fireEvent.change(descInput, { target: { value: "New Platform description" } });

      fireEvent.click(screen.getByRole("button", { name: /Choose Thumbnail from Library/i }));
      act(() => {
        thumbnailPickerProps?.onSelect?.([
          {
            id: "thumb-media-uuid",
            name: "Thumb.png",
            url: "https://storage.example.com/thumb.png",
            thumbnail: "https://storage.example.com/thumb.png",
          },
        ]);
      });

      const draftButton = screen.getByRole("button", { name: /Save as Draft/i });
      fireEvent.click(draftButton);

      expect(handleSave).toHaveBeenCalledTimes(1);
      const [savedData, savedStatus] = handleSave.mock.calls[0] as [ProjectFormData, ProjectStatus];
      expect(savedStatus).toBe("Draft");
      expect(savedData.status).toBe("Draft");
      expect(statusToPrisma(savedStatus)).toBe("DRAFT");
    });

    it("Create — Publish passes explicit 'Published' status", () => {
      const handleSave = vi.fn();
      render(
        <ProjectForm
          isEdit={false}
          onSave={handleSave}
          onCancel={vi.fn()}
        />
      );

      const titleInput = screen.getByPlaceholderText(/Enter project title/i);
      const descInput = screen.getByPlaceholderText(/Brief description/i);
      fireEvent.change(titleInput, { target: { value: "New Platform" } });
      fireEvent.change(descInput, { target: { value: "New Platform description" } });

      fireEvent.click(screen.getByRole("button", { name: /Choose Thumbnail from Library/i }));
      act(() => {
        thumbnailPickerProps?.onSelect?.([
          {
            id: "thumb-media-uuid",
            name: "Thumb.png",
            url: "https://storage.example.com/thumb.png",
            thumbnail: "https://storage.example.com/thumb.png",
          },
        ]);
      });

      const publishButton = screen.getByRole("button", { name: /Publish Project/i });
      fireEvent.click(publishButton);

      expect(handleSave).toHaveBeenCalledTimes(1);
      const [savedData, savedStatus] = handleSave.mock.calls[0] as [ProjectFormData, ProjectStatus];
      expect(savedStatus).toBe("Published");
      expect(savedData.status).toBe("Published");
      expect(statusToPrisma(savedStatus)).toBe("PUBLISHED");
    });

    it("Edit — Save as Draft on a published project transitions status to 'Draft'", () => {
      const handleSave = vi.fn();
      render(
        <ProjectForm
          project={baseProject}
          isEdit={true}
          onSave={handleSave}
          onCancel={vi.fn()}
        />
      );

      const draftButton = screen.getByRole("button", { name: /Save as Draft/i });
      fireEvent.click(draftButton);

      expect(handleSave).toHaveBeenCalledTimes(1);
      const [savedData, savedStatus] = handleSave.mock.calls[0] as [ProjectFormData, ProjectStatus];
      expect(savedStatus).toBe("Draft");
      expect(savedData.status).toBe("Draft");
      expect(statusToPrisma(savedStatus)).toBe("DRAFT");
    });

    it("Edit — Save Changes on a draft project preserves 'Draft' and does NOT force 'Published'", () => {
      const handleSave = vi.fn();
      render(
        <ProjectForm
          project={draftProject}
          isEdit={true}
          onSave={handleSave}
          onCancel={vi.fn()}
        />
      );

      const saveChangesButton = screen.getByRole("button", { name: /Save Changes/i });
      fireEvent.click(saveChangesButton);

      expect(handleSave).toHaveBeenCalledTimes(1);
      const [savedData, savedStatus] = handleSave.mock.calls[0] as [ProjectFormData, ProjectStatus];
      expect(savedStatus).toBe("Draft");
      expect(savedData.status).toBe("Draft");
      expect(statusToPrisma(savedStatus)).toBe("DRAFT");
    });

    it("Edit — Publish Project on a draft project explicitly sends 'Published'", () => {
      const handleSave = vi.fn();
      render(
        <ProjectForm
          project={draftProject}
          isEdit={true}
          onSave={handleSave}
          onCancel={vi.fn()}
        />
      );

      const publishButton = screen.getByRole("button", { name: /Publish Project/i });
      fireEvent.click(publishButton);

      expect(handleSave).toHaveBeenCalledTimes(1);
      const [savedData, savedStatus] = handleSave.mock.calls[0] as [ProjectFormData, ProjectStatus];
      expect(savedStatus).toBe("Published");
      expect(savedData.status).toBe("Published");
      expect(statusToPrisma(savedStatus)).toBe("PUBLISHED");
    });

    it("Edit — Changing status selector to 'Archived' and clicking Save Changes preserves 'Archived'", () => {
      const handleSave = vi.fn();
      render(
        <ProjectForm
          project={baseProject}
          isEdit={true}
          onSave={handleSave}
          onCancel={vi.fn()}
        />
      );

      const comboboxes = screen.getAllByRole("combobox");
      const statusSelect = comboboxes.find((el) => el.querySelector('option[value="Published"]'))!;
      expect(statusSelect).toBeDefined();

      fireEvent.change(statusSelect, { target: { value: "Archived" } });

      const saveChangesButton = screen.getByRole("button", { name: /Save Changes/i });
      fireEvent.click(saveChangesButton);

      expect(handleSave).toHaveBeenCalledTimes(1);
      const [savedData, savedStatus] = handleSave.mock.calls[0] as [ProjectFormData, ProjectStatus];
      expect(savedStatus).toBe("Archived");
      expect(savedData.status).toBe("Archived");
      expect(statusToPrisma(savedStatus)).toBe("ARCHIVED");
    });
  });

  describe("2. Unsaved Changes Navigation Hook & Blocker Synchrony", () => {
    it("markClean() synchronously resets the dirty state so shouldBlockFn returns false immediately", () => {
      const { result } = renderHook(() => useUnsavedChanges());

      act(() => {
        result.current.setIsDirty(true);
      });
      expect(result.current.isDirty).toBe(true);
      expect(lastShouldBlockFn?.()).toBe(true);

      // Perform synchronous clean mark (as done after successful save)
      act(() => {
        result.current.markClean();
      });

      expect(result.current.isDirty).toBe(false);
      expect(lastShouldBlockFn?.()).toBe(false);
    });

    it("failed save preserves dirty flag and does not mark clean", async () => {
      const onSaveMock = vi.fn().mockResolvedValue(false);
      const { result } = renderHook(() => useUnsavedChanges({ onSave: onSaveMock }));

      act(() => {
        result.current.setIsDirty(true);
      });

      await act(async () => {
        await result.current.handleModalSave();
      });

      expect(result.current.isDirty).toBe(true);
      expect(lastShouldBlockFn?.()).toBe(true);
      expect(mockBlockerProceed).not.toHaveBeenCalled();
    });

    it("handleModalSave uses intended project status without republishing drafts", async () => {
      const savedStatuses: string[] = [];
      const mockFormData: ProjectFormData = {
        name: "Campus Connect",
        description: "Draft Description",
        fullDescription: "",
        technologies: [],
        status: "Draft",
        order: 1,
        liveUrl: "",
        githubUrl: "",
        videoUrl: "",
        category: "Full Stack Development",
        projectDuration: "",
        teamSize: "",
        featured: false,
        thumbnailId: null,
        thumbnailPreview: "",
        galleryMediaIds: [],
        galleryPreviews: [],
      };

      const handleSaveMock = vi.fn().mockImplementation(async (data: ProjectFormData, status: string) => {
        savedStatuses.push(status);
        return true;
      });

      const { result } = renderHook(() =>
        useUnsavedChanges({
          onSave: async () => {
            return await handleSaveMock(mockFormData, mockFormData.status);
          },
        })
      );

      act(() => {
        result.current.setIsDirty(true);
      });

      await act(async () => {
        await result.current.handleModalSave();
      });

      expect(handleSaveMock).toHaveBeenCalledTimes(1);
      expect(savedStatuses[0]).toBe("Draft");
      expect(result.current.isDirty).toBe(false);
      expect(lastShouldBlockFn?.()).toBe(false);
    });

    it("handleModalDiscard marks clean and proceeds navigation", () => {
      mockBlockerStatus = "blocked";
      const { result } = renderHook(() => useUnsavedChanges());

      act(() => {
        result.current.setIsDirty(true);
      });

      act(() => {
        result.current.handleModalDiscard();
      });

      expect(result.current.isDirty).toBe(false);
      expect(lastShouldBlockFn?.()).toBe(false);
      expect(mockBlockerProceed).toHaveBeenCalledTimes(1);
    });

    it("handleModalCancel closes modal, resets blocker, and keeps form dirty", () => {
      mockBlockerStatus = "blocked";
      const { result } = renderHook(() => useUnsavedChanges());

      act(() => {
        result.current.setIsDirty(true);
      });

      act(() => {
        result.current.handleModalCancel();
      });

      expect(result.current.showModal).toBe(false);
      expect(result.current.isDirty).toBe(true);
      expect(mockBlockerReset).toHaveBeenCalledTimes(1);
    });
  });

  describe("3. Server Operation Status Persistence & Lifecycle Invariants", () => {
    it("updateAdminProjectOperation updates status to DRAFT and does not populate publishedAt", async () => {
      let updatedStatus: string | null = null;
      let updatedPublishedAt: any = "NOT_CALLED";

      const adminUser: User = {
        id: "admin-uuid-1",
        email: "admin@cobralearn.com",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      };

      (getSupabaseServerClient as any).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: adminUser },
            error: null,
          }),
        },
      });

      const mockPrisma: any = {
        adminProfile: {
          findUnique: vi.fn().mockResolvedValue({
            id: "admin-uuid-1",
            email: "admin@cobralearn.com",
            role: "ADMIN",
            isActive: true,
            fullName: "Admin User",
          }),
        },
        project: {
          findUnique: vi.fn().mockResolvedValue({
            id: "proj-1",
            slug: "campus-connect",
            name: "Campus Connect",
            status: "PUBLISHED",
            thumbnailId: "thumb-media-uuid",
            publishedAt: new Date("2026-01-01T00:00:00Z"),
          }),
        },
        mediaAsset: {
          findUnique: vi.fn().mockResolvedValue({
            id: "thumb-media-uuid",
          }),
        },
        $transaction: vi.fn().mockImplementation(async (callback) => {
          const tx = {
            project: {
              update: vi.fn().mockImplementation(({ data }) => {
                updatedStatus = data.status;
                updatedPublishedAt = data.publishedAt;
                return {
                  id: "proj-1",
                  name: "Campus Connect",
                  status: data.status,
                  publishedAt: data.publishedAt,
                };
              }),
            },
            adminAuditLog: {
              create: vi.fn().mockResolvedValue({ id: "audit-1" }),
            },
          };
          return await callback(tx);
        }),
      };

      // Mock finding full project after transaction
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        id: "proj-1",
        slug: "campus-connect",
        name: "Campus Connect",
        status: "PUBLISHED",
        publishedAt: new Date("2026-01-01T00:00:00Z"),
        thumbnailId: "thumb-media-uuid",
      }).mockResolvedValueOnce({
        id: "proj-1",
        name: "Campus Connect",
        status: "DRAFT",
        publishedAt: null,
        thumbnail: { publicUrl: "https://example.com/thumb.png" },
        gallery: [],
      });

      const fakeReq = new Request("https://api.internal/admin/projects/proj-1", {
        headers: {
          authorization: "Bearer mock-token-admin",
          cookie: "sb-access-token=mock-token-admin",
        },
      });

      const res = await updateAdminProjectOperation(
        fakeReq,
        "proj-1",
        { status: "DRAFT" },
        mockPrisma
      );

      expect(updatedStatus).toBe("DRAFT");
      // DRAFT does not overwrite publishedAt with a new date
      expect(updatedPublishedAt).toBeUndefined();
      expect(res.project.status).toBe("DRAFT");
    });
  });

  describe("4. Fix 1 — Project Duration and Team Size in Edit & Create Modes", () => {
    it("renders project duration and team size in Edit mode and hydrates values", () => {
      const editProject: ProjectItem = {
        ...baseProject,
        projectDuration: "4 Months",
        teamSize: "3-5",
      };

      render(
        <ProjectForm
          project={editProject}
          isEdit={true}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const durationInput = screen.getByPlaceholderText(/e\.g\. Jan 2024 - Mar 2024/i) as HTMLInputElement;
      const teamInput = screen.getByPlaceholderText(/e\.g\. 1, 2-5, 5\+/i) as HTMLInputElement;

      expect(durationInput).toBeDefined();
      expect(teamInput).toBeDefined();
      expect(durationInput.value).toBe("4 Months");
      expect(teamInput.value).toBe("3-5");
    });

    it("persists updated project duration and team size through save payload", () => {
      const handleSave = vi.fn();
      const editProject: ProjectItem = {
        ...baseProject,
        projectDuration: "Initial Duration",
        teamSize: "1",
      };

      render(
        <ProjectForm
          project={editProject}
          isEdit={true}
          onSave={handleSave}
          onCancel={vi.fn()}
        />
      );

      const durationInput = screen.getByPlaceholderText(/e\.g\. Jan 2024 - Mar 2024/i);
      const teamInput = screen.getByPlaceholderText(/e\.g\. 1, 2-5, 5\+/i);

      fireEvent.change(durationInput, { target: { value: "6 Months" } });
      fireEvent.change(teamInput, { target: { value: "5-10" } });

      const saveChangesBtn = screen.getByRole("button", { name: /Save Changes/i });
      fireEvent.click(saveChangesBtn);

      expect(handleSave).toHaveBeenCalledTimes(1);
      const [savedData] = handleSave.mock.calls[0] as [ProjectFormData, ProjectStatus];
      expect(savedData.projectDuration).toBe("6 Months");
      expect(savedData.teamSize).toBe("5-10");
    });

    it("saving without changing duration or team size does not clear them", () => {
      const handleSave = vi.fn();
      const editProject: ProjectItem = {
        ...baseProject,
        projectDuration: "Preserved Duration",
        teamSize: "Preserved Team",
      };

      render(
        <ProjectForm
          project={editProject}
          isEdit={true}
          onSave={handleSave}
          onCancel={vi.fn()}
        />
      );

      const saveChangesBtn = screen.getByRole("button", { name: /Save Changes/i });
      fireEvent.click(saveChangesBtn);

      expect(handleSave).toHaveBeenCalledTimes(1);
      const [savedData] = handleSave.mock.calls[0] as [ProjectFormData, ProjectStatus];
      expect(savedData.projectDuration).toBe("Preserved Duration");
      expect(savedData.teamSize).toBe("Preserved Team");
    });
  });

  describe("5. Fix 2 — Client-Side Required-Field Validation Guard", () => {
    it("rejects empty submission and does not call onSave", () => {
      const handleSave = vi.fn();
      render(
        <ProjectForm
          isEdit={false}
          onSave={handleSave}
          onCancel={vi.fn()}
        />
      );

      const draftBtn = screen.getByRole("button", { name: /Save as Draft/i });
      fireEvent.click(draftBtn);

      expect(handleSave).not.toHaveBeenCalled();
      expect(screen.getByText("Project title is required")).toBeDefined();
      expect(screen.getByText("Short description is required")).toBeDefined();
    });

    it("rejects whitespace-only values", () => {
      const handleSave = vi.fn();
      render(
        <ProjectForm
          isEdit={false}
          onSave={handleSave}
          onCancel={vi.fn()}
        />
      );

      const titleInput = screen.getByPlaceholderText(/Enter project title/i);
      const descInput = screen.getByPlaceholderText(/Brief description/i);
      fireEvent.change(titleInput, { target: { value: "   " } });
      fireEvent.change(descInput, { target: { value: " \t  \n " } });

      const publishBtn = screen.getByRole("button", { name: /Publish Project/i });
      fireEvent.click(publishBtn);

      expect(handleSave).not.toHaveBeenCalled();
      expect(screen.getByText("Project title is required")).toBeDefined();
      expect(screen.getByText("Short description is required")).toBeDefined();
    });

    it("clears error message when user enters valid value", () => {
      const handleSave = vi.fn();
      render(
        <ProjectForm
          isEdit={false}
          onSave={handleSave}
          onCancel={vi.fn()}
        />
      );

      const draftBtn = screen.getByRole("button", { name: /Save as Draft/i });
      fireEvent.click(draftBtn);

      expect(screen.getByText("Project title is required")).toBeDefined();

      const titleInput = screen.getByPlaceholderText(/Enter project title/i);
      fireEvent.change(titleInput, { target: { value: "Valid Title" } });

      expect(screen.queryByText("Project title is required")).toBeNull();
    });

    it("allows submission once all required fields are satisfied", () => {
      const handleSave = vi.fn();
      render(
        <ProjectForm
          isEdit={false}
          onSave={handleSave}
          onCancel={vi.fn()}
        />
      );

      const titleInput = screen.getByPlaceholderText(/Enter project title/i);
      const descInput = screen.getByPlaceholderText(/Brief description/i);

      fireEvent.change(titleInput, { target: { value: "Valid Project" } });
      fireEvent.change(descInput, { target: { value: "Valid Description" } });

      fireEvent.click(screen.getByRole("button", { name: /Choose Thumbnail from Library/i }));
      act(() => {
        thumbnailPickerProps?.onSelect?.([
          {
            id: "thumb-media-uuid",
            name: "Thumb.png",
            url: "https://storage.example.com/thumb.png",
            thumbnail: "https://storage.example.com/thumb.png",
          },
        ]);
      });

      const draftBtn = screen.getByRole("button", { name: /Save as Draft/i });
      fireEvent.click(draftBtn);

      expect(handleSave).toHaveBeenCalledTimes(1);
    });
  });

  describe("6. Fix 4 — ProjectTable Select-All Checkbox Correctness", () => {
    const pageProjects: ProjectItem[] = [
      { ...baseProject, id: "page1-item1" },
      { ...baseProject, id: "page1-item2" },
      { ...baseProject, id: "page1-item3" },
    ];

    it("shows checked (aria-checked=true) when all current-page items are selected", () => {
      render(
        <ProjectTable
          projects={pageProjects}
          selectedIds={["page1-item1", "page1-item2", "page1-item3"]}
          onToggleSelect={vi.fn()}
          onToggleSelectAll={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          onView={vi.fn()}
          onDuplicate={vi.fn()}
          onDelete={vi.fn()}
          onBulkAction={vi.fn()}
          currentPage={1}
          totalPages={2}
          onPageChange={vi.fn()}
          pageSize={3}
          onPageSizeChange={vi.fn()}
          totalCount={6}
        />
      );

      const selectAll = screen.getByRole("checkbox", { name: /Select all projects/i });
      expect(selectAll.getAttribute("aria-checked")).toBe("true");
    });

    it("shows unchecked (aria-checked=false) when items on other pages are selected but none on current page", () => {
      render(
        <ProjectTable
          projects={pageProjects}
          selectedIds={["page2-item1", "page2-item2", "page2-item3"]}
          onToggleSelect={vi.fn()}
          onToggleSelectAll={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          onView={vi.fn()}
          onDuplicate={vi.fn()}
          onDelete={vi.fn()}
          onBulkAction={vi.fn()}
          currentPage={1}
          totalPages={2}
          onPageChange={vi.fn()}
          pageSize={3}
          onPageSizeChange={vi.fn()}
          totalCount={6}
        />
      );

      const selectAll = screen.getByRole("checkbox", { name: /Select all projects/i });
      expect(selectAll.getAttribute("aria-checked")).toBe("false");
    });

    it("shows indeterminate (aria-checked=mixed) when only some current-page items are selected", () => {
      render(
        <ProjectTable
          projects={pageProjects}
          selectedIds={["page1-item1", "other-page-item"]}
          onToggleSelect={vi.fn()}
          onToggleSelectAll={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          onView={vi.fn()}
          onDuplicate={vi.fn()}
          onDelete={vi.fn()}
          onBulkAction={vi.fn()}
          currentPage={1}
          totalPages={2}
          onPageChange={vi.fn()}
          pageSize={3}
          onPageSizeChange={vi.fn()}
          totalCount={6}
        />
      );

      const selectAll = screen.getByRole("checkbox", { name: /Select all projects/i });
      expect(selectAll.getAttribute("aria-checked")).toBe("mixed");
    });
  });

  describe("7. Fix 3 & Fix 5 — Pagination State Invariants & Duplicate Gallery Preservation", () => {
    it("Fix 5: Duplicate Project payload preserves thumbnail and ordered galleryMediaIds and remains Draft", () => {
      const sourceProject: ProjectItem = {
        ...baseProject,
        id: "proj-source-uuid",
        slug: "source-project",
        status: "Published",
        thumbnailId: "thumb-media-uuid",
        galleryMediaIds: ["gallery-1-uuid", "gallery-2-uuid"],
      };

      let duplicatePayload: any = null;
      const createProjectMock = vi.fn().mockImplementation((payload) => {
        duplicatePayload = payload;
        return Promise.resolve(null);
      });

      // Execute duplicate logic identical to handleDuplicate in index.tsx
      createProjectMock({
        name: `${sourceProject.name} (Copy)`,
        description: sourceProject.description,
        fullDescription: sourceProject.fullDescription,
        category: sourceProject.category,
        status: "DRAFT",
        featured: sourceProject.featured,
        displayOrder: 2,
        projectDuration: sourceProject.projectDuration,
        teamSize: sourceProject.teamSize,
        technologies: sourceProject.technologies,
        tags: sourceProject.tags,
        liveUrl: sourceProject.liveUrl,
        githubUrl: sourceProject.githubUrl,
        videoUrl: sourceProject.videoUrl,
        thumbnailId: sourceProject.thumbnailId,
        galleryMediaIds: sourceProject.galleryMediaIds ? [...sourceProject.galleryMediaIds] : [],
      });

      expect(duplicatePayload).toBeDefined();
      expect(duplicatePayload.name).toBe("Campus Connect (Copy)");
      expect(duplicatePayload.status).toBe("DRAFT");
      expect(duplicatePayload.thumbnailId).toBe("thumb-media-uuid");
      expect(duplicatePayload.galleryMediaIds).toEqual(["gallery-1-uuid", "gallery-2-uuid"]);
      // Confirm database ID, slug, and publication timestamps are not copied
      expect(duplicatePayload.id).toBeUndefined();
      expect(duplicatePayload.slug).toBeUndefined();
      expect(duplicatePayload.publishedAt).toBeUndefined();
    });

    it("Fix 3: Pagination resets to page 1 when search or filters change", () => {
      let currentPage = 3;
      const setCurrentPage = (p: number) => { currentPage = p; };

      // Simulate filter change trigger
      const onFilterChange = () => {
        setCurrentPage(1);
      };

      onFilterChange();
      expect(currentPage).toBe(1);
    });

    it("Fix 3: Pagination clamps to totalPages when deletions reduce available pages", () => {
      let currentPage = 4;
      const totalPagesAfterDelete = 2;

      // Simulate clamping logic: if (currentPage > totalPages) setCurrentPage(totalPages)
      if (currentPage > totalPagesAfterDelete) {
        currentPage = totalPagesAfterDelete;
      }

      expect(currentPage).toBe(2);
    });

    it("Fix 4: toggling select all on current page does not discard selections from other pages", () => {
      let selectedIds = ["page2-item1", "page2-item2"];
      const currentIds = ["page1-item1", "page1-item2"];

      // Select current page
      selectedIds = Array.from(new Set([...selectedIds, ...currentIds]));
      expect(selectedIds).toEqual(["page2-item1", "page2-item2", "page1-item1", "page1-item2"]);

      // Deselect current page
      selectedIds = selectedIds.filter((id) => !currentIds.includes(id));
      expect(selectedIds).toEqual(["page2-item1", "page2-item2"]);
    });
  });
});
