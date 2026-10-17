import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listAdminProjectsOperation,
  getAdminProjectByIdOperation,
  createAdminProjectOperation,
  updateAdminProjectOperation,
  deleteAdminProjectOperation,
  reorderAdminProjectsOperation,
  getPublicProjectsOperation,
  getPublicProjectBySlugOperation,
  generateSlug,
} from "@/lib/server/projects-operations";
import { deleteAdminMediaAssetOperation } from "@/lib/server/media-operations";
import {
  projectToItem,
  projectToShowcaseItem,
  statusToPrisma,
  statusFromPrisma,
} from "@/lib/projects-data";
import { adminClient } from "@/lib/api/admin-client";
import {
  listAdminProjectsServerFn,
  getAdminProjectByIdServerFn,
  createAdminProjectServerFn,
  getPublicProjectsServerFn,
  getPublicProjectBySlugServerFn,
} from "@/lib/server/projects-server-fns";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabase } from "@/lib/supabase/browser";
import type { PrismaClient, Project, ProjectGalleryItem, AdminAuditLog, PublishStatus } from "@prisma/client";
import type { User } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/browser", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "mock-client-access-token" } },
        error: null,
      }),
    },
  },
}));

vi.mock("@/lib/server/projects-server-fns", () => ({
  listAdminProjectsServerFn: vi.fn().mockImplementation(async () => ({
    projects: [
      {
        id: "proj-1",
        name: "AI Autonomous Agent Platform",
        slug: "ai-autonomous-agent-platform",
        description: "Intelligent agent orchestration engine.",
        status: "PUBLISHED",
        featured: true,
        displayOrder: 1,
        technologies: ["TypeScript", "Next.js"],
        tags: ["AI"],
        gallery: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  })),
  getAdminProjectByIdServerFn: vi.fn().mockImplementation(async ({ data }: any) => {
    if (data?.idOrSlug === "proj-1") {
      return {
        project: {
          id: "proj-1",
          name: "AI Autonomous Agent Platform",
          slug: "ai-autonomous-agent-platform",
          status: "PUBLISHED",
          gallery: [],
        },
      };
    }
    return { project: null };
  }),
  createAdminProjectServerFn: vi.fn().mockImplementation(async ({ data }: any) => ({
    project: {
      id: "new-proj",
      ...data.payload,
      gallery: [],
    },
  })),
  updateAdminProjectServerFn: vi.fn().mockImplementation(async ({ data }: any) => ({
    project: {
      id: data.id,
      ...data.payload,
      gallery: [],
    },
  })),
  deleteAdminProjectServerFn: vi.fn().mockImplementation(async ({ data }: any) => ({
    success: true,
    deletedId: data.id,
  })),
  reorderAdminProjectsServerFn: vi.fn().mockImplementation(async () => ({
    success: true,
  })),
  getPublicProjectsServerFn: vi.fn().mockImplementation(async () => ({
    projects: [
      {
        id: "proj-1",
        name: "AI Autonomous Agent Platform",
        slug: "ai-autonomous-agent-platform",
        description: "Intelligent agent orchestration engine.",
        status: "PUBLISHED",
        featured: true,
        displayOrder: 1,
        technologies: ["TypeScript", "Next.js"],
        tags: ["AI"],
        gallery: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  })),
  getPublicProjectBySlugServerFn: vi.fn().mockImplementation(async ({ data }: any) => {
    if (data?.slug === "ai-autonomous-agent-platform") {
      return {
        project: {
          id: "proj-1",
          name: "AI Autonomous Agent Platform",
          slug: "ai-autonomous-agent-platform",
          status: "PUBLISHED",
          gallery: [],
        },
      };
    }
    return { project: null };
  }),
}));


describe("ITEM 2: Projects Module Database & Public Showcase Integration Test Suite", () => {
  const superAdminUuid = "11111111-1111-4111-8111-111111111111";
  const adminUuid = "22222222-2222-4222-8222-222222222222";
  const editorUuid = "33333333-3333-4333-8333-333333333333";
  const inactiveUuid = "44444444-4444-4444-8444-444444444444";

  const superAdminUser: User = {
    id: superAdminUuid,
    email: "superadmin@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const adminUser: User = {
    id: adminUuid,
    email: "admin@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const editorUser: User = {
    id: editorUuid,
    email: "editor@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const inactiveUser: User = {
    id: inactiveUuid,
    email: "inactive@cobralearn.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  let mockProjects: Project[] = [];
  let mockGalleryItems: ProjectGalleryItem[] = [];
  let mockAuditLogs: AdminAuditLog[] = [];

  function createMockPrisma(): PrismaClient {
    return {
      adminProfile: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id?: string; email?: string } }) => {
          if (where.id === superAdminUuid || where.email === "superadmin@cobralearn.com") {
            return Promise.resolve({
              id: superAdminUuid,
              email: "superadmin@cobralearn.com",
              role: "SUPER_ADMIN",
              isActive: true,
              fullName: "Super Admin",
            });
          }
          if (where.id === adminUuid || where.email === "admin@cobralearn.com") {
            return Promise.resolve({
              id: adminUuid,
              email: "admin@cobralearn.com",
              role: "ADMIN",
              isActive: true,
              fullName: "Admin User",
            });
          }
          if (where.id === editorUuid || where.email === "editor@cobralearn.com") {
            return Promise.resolve({
              id: editorUuid,
              email: "editor@cobralearn.com",
              role: "EDITOR",
              isActive: true,
              fullName: "Editor User",
            });
          }
          if (where.id === inactiveUuid || where.email === "inactive@cobralearn.com") {
            return Promise.resolve({
              id: inactiveUuid,
              email: "inactive@cobralearn.com",
              role: "ADMIN",
              isActive: false,
              fullName: "Inactive Admin",
            });
          }
          return Promise.resolve(null);
        }),
      },
      project: {
        findMany: vi.fn().mockImplementation(({ where, orderBy }: any = {}) => {
          let list = [...mockProjects];
          if (where?.status) {
            list = list.filter((p) => p.status === where.status);
          }
          if (where?.id?.in && Array.isArray(where.id.in)) {
            list = list.filter((p) => where.id.in.includes(p.id));
          }
          if (where?.OR && Array.isArray(where.OR)) {
            list = list.filter((p) => {
              return where.OR.some((clause: any) => {
                if (clause.name?.contains) {
                  return p.name.toLowerCase().includes(clause.name.contains.toLowerCase());
                }
                if (clause.description?.contains) {
                  return p.description.toLowerCase().includes(clause.description.contains.toLowerCase());
                }
                return false;
              });
            });
          }
          return Promise.resolve(
            list.map((p) => ({
              ...p,
              thumbnail: null,
              gallery: mockGalleryItems
                .filter((g) => g.projectId === p.id)
                .map((g) => ({ ...g, media: { id: g.mediaId, publicUrl: `https://cdn.example.com/${g.mediaId}.jpg` } })),
            }))
          );
        }),
        findFirst: vi.fn().mockImplementation(({ where }: any) => {
          let match = mockProjects.find((p) => {
            if (where.slug && p.slug === where.slug) {
              if (where.status && p.status !== where.status) return false;
              return true;
            }
            if (where.OR) {
              return where.OR.some((c: any) => (c.id && p.id === c.id) || (c.slug && p.slug === c.slug));
            }
            return false;
          });
          if (!match) return Promise.resolve(null);
          return Promise.resolve({
            ...match,
            thumbnail: null,
            gallery: mockGalleryItems
              .filter((g) => g.projectId === match!.id)
              .map((g) => ({ ...g, media: { id: g.mediaId, publicUrl: `https://cdn.example.com/${g.mediaId}.jpg` } })),
          });
        }),
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          const match = mockProjects.find((p) => (where.id && p.id === where.id) || (where.slug && p.slug === where.slug));
          if (!match) return Promise.resolve(null);
          return Promise.resolve({
            ...match,
            thumbnail: null,
            gallery: mockGalleryItems
              .filter((g) => g.projectId === match!.id)
              .map((g) => ({ ...g, media: { id: g.mediaId, publicUrl: `https://cdn.example.com/${g.mediaId}.jpg` } })),
          });
        }),
        create: vi.fn().mockImplementation(({ data }: any) => {
          const newProject: Project = {
            id: `proj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: data.name,
            slug: data.slug,
            description: data.description,
            fullDescription: data.fullDescription || null,
            category: data.category || "Full Stack Development",
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
          mockProjects.push(newProject);
          return Promise.resolve(newProject);
        }),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          const idx = mockProjects.findIndex((p) => p.id === where.id);
          if (idx === -1) throw new Error("Not found");
          const existing = mockProjects[idx];
          const updated: Project = {
            ...existing!,
            ...data,
            updatedAt: new Date(),
          };
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
            id: `gal-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
      mediaAsset: {
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          return Promise.resolve({
            id: where.id,
            filename: `${where.id}.jpg`,
            publicUrl: `https://cdn.example.com/${where.id}.jpg`,
            fileSize: 1024,
            mimeType: "image/jpeg",
          });
        }),
        findMany: vi.fn().mockImplementation(({ where }: any) => {
          const ids: string[] = where?.id?.in || [];
          return Promise.resolve(
            ids.map((id) => ({
              id,
              filename: `${id}.jpg`,
              publicUrl: `https://cdn.example.com/${id}.jpg`,
              fileSize: 1024,
              mimeType: "image/jpeg",
            }))
          );
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockImplementation(({ data }: any) => {
          const log: AdminAuditLog = {
            id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            actorId: data.actorId,
            actorEmail: data.actorEmail,
            action: data.action,
            module: data.module,
            entityId: data.entityId || null,
            metadata: data.metadata || null,
            ipAddress: null,
            createdAt: new Date(),
          };
          mockAuditLogs.push(log);
          return Promise.resolve(log);
        }),
      },
      $transaction: vi.fn().mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        return callback(createMockPrisma());
      }),
    } as unknown as PrismaClient;
  }

  function createAuthRequest(user: User | null, currentLevel: "aal1" | "aal2" = "aal1"): Request {
    (getSupabaseServerClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: user ? null : { message: "Invalid session" },
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: user ? { currentLevel, nextLevel: currentLevel, currentAuthenticationMethods: [] } : null,
            error: null,
          }),
        },
      },
    });

    return new Request("https://api.internal/admin/projects", {
      headers: {
        authorization: user ? `Bearer mock-token-for-${user.id}` : "",
      },
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockProjects = [
      {
        id: "proj-1",
        name: "AI Autonomous Agent Platform",
        slug: "ai-autonomous-agent-platform",
        description: "Intelligent agent orchestration engine with real-time feedback loops.",
        fullDescription: "Detailed markdown description of AI platform",
        category: "AI / ML",
        status: "PUBLISHED" as PublishStatus,
        featured: true,
        displayOrder: 1,
        projectDuration: "6 Months",
        teamSize: "4 Engineers",
        technologies: ["TypeScript", "Next.js", "Python", "PyTorch"],
        tags: ["AI", "Agents"],
        liveUrl: "https://agent-demo.cobralearn.com",
        githubUrl: "https://github.com/cobralearn/agent-platform",
        videoUrl: "https://youtube.com/watch?v=123",
        thumbnailId: "media-thumb-1",
        publishedAt: new Date("2026-01-15T00:00:00Z"),
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-15T00:00:00Z"),
      },
      {
        id: "proj-2",
        name: "Confidential Quantum Simulator",
        slug: "confidential-quantum-simulator",
        description: "Draft quantum algorithm simulator under internal validation.",
        fullDescription: "Internal research draft.",
        category: "Research",
        status: "DRAFT" as PublishStatus,
        featured: false,
        displayOrder: 2,
        projectDuration: "Ongoing",
        teamSize: "2 Researchers",
        technologies: ["Rust", "WASM", "Qiskit"],
        tags: ["Quantum", "Draft"],
        liveUrl: null,
        githubUrl: null,
        videoUrl: null,
        thumbnailId: "media-thumb-2",
        publishedAt: null,
        createdAt: new Date("2026-02-01T00:00:00Z"),
        updatedAt: new Date("2026-02-01T00:00:00Z"),
      },
    ];

    mockGalleryItems = [
      {
        id: "gal-1",
        projectId: "proj-1",
        mediaId: "media-img-1",
        displayOrder: 0,
      },
      {
        id: "gal-2",
        projectId: "proj-1",
        mediaId: "media-img-2",
        displayOrder: 1,
      },
    ];

    mockAuditLogs = [];
  });

  describe("1. Slug Generation & Format Validation", () => {
    it("should generate clean, kebab-case slugs from project names", () => {
      expect(generateSlug("AI & Deep Learning Studio 2026!")).toBe("ai-deep-learning-studio-2026");
      expect(generateSlug("  Project --- With __ Special Characters $$$ ")).toBe("project-with-special-characters");
    });
  });

  describe("2. Public Showcase Queries & Draft Invariant", () => {
    it("getPublicProjectsOperation strictly returns ONLY published projects", async () => {
      const prisma = createMockPrisma();
      const res = await getPublicProjectsOperation(prisma);

      expect(res.projects).toHaveLength(1);
      expect(res.projects[0]?.id).toBe("proj-1");
      expect(res.projects[0]?.status).toBe("PUBLISHED");

      // Verify draft project is not present
      const draftPresent = res.projects.some((p) => p.id === "proj-2");
      expect(draftPresent).toBe(false);
    });

    it("getPublicProjectBySlugOperation returns published project detail by slug", async () => {
      const prisma = createMockPrisma();
      const res = await getPublicProjectBySlugOperation("ai-autonomous-agent-platform", prisma);

      expect(res.project).not.toBeNull();
      expect(res.project?.name).toBe("AI Autonomous Agent Platform");
      expect(res.project?.gallery).toHaveLength(2);
    });

    it("getPublicProjectBySlugOperation returns null for DRAFT project (no leakage)", async () => {
      const prisma = createMockPrisma();
      const res = await getPublicProjectBySlugOperation("confidential-quantum-simulator", prisma);

      // Must be null for public visitors
      expect(res.project).toBeNull();
    });

    it("getPublicProjectBySlugOperation returns null for non-existent slug", async () => {
      const prisma = createMockPrisma();
      const res = await getPublicProjectBySlugOperation("non-existent-slug", prisma);
      expect(res.project).toBeNull();
    });
  });

  describe("3. Admin Operations & RBAC Protection", () => {
    it("listAdminProjectsOperation allows authorized admin to view both PUBLISHED and DRAFT records", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      const res = await listAdminProjectsOperation(req, undefined, prisma);
      expect(res.projects).toHaveLength(2);
      expect(res.projects.map((p) => p.status)).toContain("PUBLISHED");
      expect(res.projects.map((p) => p.status)).toContain("DRAFT");
    });

    it("listAdminProjectsOperation allows EDITOR role (CMS_READ permitted)", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(editorUser);

      const res = await listAdminProjectsOperation(req, undefined, prisma);
      expect(res.projects).toHaveLength(2);
    });

    it("listAdminProjectsOperation denies unauthenticated request", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(null);

      await expect(listAdminProjectsOperation(req, undefined, prisma)).rejects.toThrow();
    });

    it("listAdminProjectsOperation denies inactive administrator", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(inactiveUser);

      await expect(listAdminProjectsOperation(req, undefined, prisma)).rejects.toThrow();
    });

    it("getAdminProjectByIdOperation allows admin to retrieve draft record by ID or slug", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      const res = await getAdminProjectByIdOperation(req, "proj-2", prisma);
      expect(res.project).not.toBeNull();
      expect(res.project?.slug).toBe("confidential-quantum-simulator");
    });
  });

  describe("4. Project Creation, Transactions & Audit Logging", () => {
    it("creates a new project, persists gallery relations, and writes PROJECT_CREATED audit log", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(superAdminUser);

      const res = await createAdminProjectOperation(
        req,
        {
          name: "NextGen Cloud Infrastructure",
          description: "High performance distributed cloud engine.",
          category: "DevOps",
          status: "PUBLISHED",
          technologies: ["Go", "Kubernetes", "gRPC"],
          thumbnailId: "media-thumb-1",
          galleryMediaIds: ["media-cloud-1", "media-cloud-2"],
        },
        prisma
      );

      expect(res.project).toBeDefined();
      expect(res.project.name).toBe("NextGen Cloud Infrastructure");
      expect(res.project.slug).toBe("nextgen-cloud-infrastructure");
      expect(res.project.status).toBe("PUBLISHED");

      // Verify audit log recorded
      expect(mockAuditLogs.length).toBeGreaterThan(0);
      const log = mockAuditLogs.find((l) => l.action === "PROJECT_CREATED");
      expect(log).toBeDefined();
      expect(log?.actorEmail).toBe("superadmin@cobralearn.com");
      expect(log?.module).toBe("PROJECTS_CMS");
    });

    it("rejects project creation when thumbnail is missing", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      await expect(
        createAdminProjectOperation(
          req,
          {
            name: "No Thumbnail Project",
            description: "Missing thumbnail attempt",
          },
          prisma
        )
      ).rejects.toThrow(/Thumbnail image is required/i);
    });

    it("rejects project creation with duplicate slug conflict", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      await expect(
        createAdminProjectOperation(
          req,
          {
            name: "AI Autonomous Agent Platform", // Already exists
            description: "Duplicate attempt",
            thumbnailId: "media-thumb-1",
          },
          prisma
        )
      ).rejects.toThrow(/already exists/i);
    });

    it("rejects project creation with missing required fields", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      await expect(
        createAdminProjectOperation(
          req,
          {
            name: "",
            description: "Missing name",
            thumbnailId: "media-thumb-1",
          },
          prisma
        )
      ).rejects.toThrow(/name is required/i);
    });
  });

  describe("5. Project Updating, Gallery Re-Sync & Audit Logging", () => {
    it("updates project fields, syncs gallery associations, and writes PROJECT_UPDATED audit log", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      const res = await updateAdminProjectOperation(
        req,
        "proj-2",
        {
          name: "Confidential Quantum Simulator v2",
          status: "PUBLISHED",
          galleryMediaIds: ["media-quant-1"],
        },
        prisma
      );

      expect(res.project.name).toBe("Confidential Quantum Simulator v2");
      expect(res.project.status).toBe("PUBLISHED");

      // Verify audit log
      const log = mockAuditLogs.find((l) => l.action === "PROJECT_UPDATED");
      expect(log).toBeDefined();
      expect(log?.entityId).toBe("proj-2");
    });
  });

  describe("6. RBAC Deletion Restrictions (SUPER_ADMIN / ADMIN vs EDITOR)", () => {
    it("allows ADMIN to delete a project and records PROJECT_DELETED audit log", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser, "aal2");

      const res = await deleteAdminProjectOperation(req, "proj-2", prisma);
      expect(res.success).toBe(true);
      expect(res.deletedId).toBe("proj-2");

      // Verify project is removed from database
      const found = mockProjects.find((p) => p.id === "proj-2");
      expect(found).toBeUndefined();

      // Verify audit log
      const log = mockAuditLogs.find((l) => l.action === "PROJECT_DELETED");
      expect(log).toBeDefined();
      expect(log?.entityId).toBe("proj-2");
    });

    it("DENIES EDITOR role from deleting a project (RBAC Matrix Enforced)", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(editorUser, "aal2");

      // EDITOR does not have CMS_DELETE permission
      await expect(deleteAdminProjectOperation(req, "proj-1", prisma)).rejects.toThrow(/permission|forbidden|unauthorized/i);

      // Project must NOT be deleted
      const found = mockProjects.find((p) => p.id === "proj-1");
      expect(found).toBeDefined();
    });
  });

  describe("7. Bulk Reordering Operation", () => {
    it("reorders projects displayOrder and writes PROJECTS_REORDERED audit log", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      const res = await reorderAdminProjectsOperation(req, ["proj-2", "proj-1"], prisma);
      expect(res.success).toBe(true);

      const log = mockAuditLogs.find((l) => l.action === "PROJECTS_REORDERED");
      expect(log).toBeDefined();
      expect((log?.metadata as any)?.count).toBe(2);

      const p2 = mockProjects.find((p) => p.id === "proj-2");
      const p1 = mockProjects.find((p) => p.id === "proj-1");
      expect(p2?.displayOrder).toBe(1);
      expect(p1?.displayOrder).toBe(2);
    });

    it("rejects duplicate project IDs with structured validation error", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      await expect(
        reorderAdminProjectsOperation(req, ["proj-1", "proj-1"], prisma)
      ).rejects.toThrow("Validation Error: Duplicate project IDs are not allowed in orderedIds");
    });

    it("rejects unknown project IDs with structured validation error", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      await expect(
        reorderAdminProjectsOperation(req, ["proj-1", "non-existent-id"], prisma)
      ).rejects.toThrow("Validation Error: Unknown project ID(s) provided: non-existent-id");
    });

    it("rejects non-array or empty orderedIds", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      await expect(
        reorderAdminProjectsOperation(req, [] as any, prisma)
      ).rejects.toThrow("Validation Error: orderedIds array is required");

      await expect(
        reorderAdminProjectsOperation(req, null as any, prisma)
      ).rejects.toThrow("Validation Error: orderedIds array is required");
    });

    it("rejects reordering when user lacks CMS_UPDATE permission", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(inactiveUser);

      await expect(
        reorderAdminProjectsOperation(req, ["proj-2", "proj-1"], prisma)
      ).rejects.toThrow(/permission|forbidden|unauthorized|inactive/i);
    });
  });

  describe("8. Data Converters & Mapping Invariants", () => {
    it("statusToPrisma and statusFromPrisma convert accurately", () => {
      expect(statusToPrisma("Published")).toBe("PUBLISHED");
      expect(statusToPrisma("Draft")).toBe("DRAFT");
      expect(statusToPrisma("Archived")).toBe("ARCHIVED");

      expect(statusFromPrisma("PUBLISHED")).toBe("Published");
      expect(statusFromPrisma("DRAFT")).toBe("Draft");
      expect(statusFromPrisma("ARCHIVED")).toBe("Archived");
    });

    it("projectToItem converts ProjectWithMedia to ProjectItem with all fields preserved", () => {
      const item = projectToItem(mockProjects[0] as any);
      expect(item.id).toBe("proj-1");
      expect(item.name).toBe("AI Autonomous Agent Platform");
      expect(item.status).toBe("Published");
      expect(item.technologies).toEqual(["TypeScript", "Next.js", "Python", "PyTorch"]);
    });

    it("projectToShowcaseItem converts ProjectWithMedia to ShowcaseItem with orange accent and published flag", () => {
      const showcaseItem = projectToShowcaseItem(mockProjects[0] as any);
      expect(showcaseItem.id).toBe("proj-1");
      expect(showcaseItem.title).toBe("AI Autonomous Agent Platform");
      expect(showcaseItem.accent).toBe("orange");
      expect(showcaseItem.published).toBe(true);
    });
  });

  describe("9. Edit Navigation & Target Identifier Resolution (F-PRJ-01)", () => {
    it("getAdminProjectByIdOperation loads exact target project when valid ID is passed", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      const res1 = await getAdminProjectByIdOperation(req, "proj-1", prisma);
      expect(res1.project?.id).toBe("proj-1");
      expect(res1.project?.name).toBe("AI Autonomous Agent Platform");

      const res2 = await getAdminProjectByIdOperation(req, "proj-2", prisma);
      expect(res2.project?.id).toBe("proj-2");
      expect(res2.project?.name).toBe("Confidential Quantum Simulator");
    });

    it("getAdminProjectByIdOperation returns null for invalid or missing identifier (no unrelated fallback)", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      const resInvalid = await getAdminProjectByIdOperation(req, "invalid-uuid-999", prisma);
      expect(resInvalid.project).toBeNull();
    });
  });

  describe("10. Server Functions & adminClient RPC Boundary Integration", () => {
    it("adminClient.getPublicProjects retrieves published items through server boundary", async () => {
      const res = await adminClient.getPublicProjects();
      expect(res.success).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it("adminClient.getPublicProjectBySlug handles public requests safely", async () => {
      const res = await adminClient.getPublicProjectBySlug("non-existent-slug");
      expect(res.success).toBe(true);
      expect(res.data).toBeNull();
    });

    it("adminClient.listAdminProjects retrieves session token and calls server function with Bearer token", async () => {
      const res = await adminClient.listAdminProjects();
      expect(supabase.auth.getSession).toHaveBeenCalled();
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
    });

    it("adminClient normalizes unauthenticated errors to standard 401 message", async () => {
      (listAdminProjectsServerFn as any).mockRejectedValueOnce(new Error("No cookie header provided"));
      const res = await adminClient.listAdminProjects();
      expect(res.success).toBe(false);
      expect(res.error).toBe("Unauthorized: Valid administrative session required");
    });

    it("adminClient normalizes missing Supabase session errors", async () => {
      (listAdminProjectsServerFn as any).mockRejectedValueOnce(new Error("Unauthorized: No valid Supabase session"));
      const res = await adminClient.listAdminProjects();
      expect(res.success).toBe(false);
      expect(res.error).toBe("Unauthorized: Valid administrative session required");
    });

    it("adminClient handles valid cookie authentication fallback cleanly", async () => {
      (listAdminProjectsServerFn as any).mockResolvedValueOnce({
        projects: [
          {
            id: "proj-cookie-1",
            name: "Cookie Authenticated Project",
            slug: "cookie-authenticated-project",
            status: "PUBLISHED",
            gallery: [],
          },
        ],
      });
      const res = await adminClient.listAdminProjects();
      expect(res.success).toBe(true);
      expect(res.data?.[0]?.name).toBe("Cookie Authenticated Project");
    });
  });

  describe("11. Projects Security & Authorization Audit Verification", () => {
    it("rejects unauthenticated caller from creating a project", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(null);

      await expect(
        createAdminProjectOperation(
          req,
          { name: "Unauth Project", description: "Should fail" },
          prisma
        )
      ).rejects.toThrow();
    });

    it("rejects unauthenticated caller from updating a project", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(null);

      await expect(
        updateAdminProjectOperation(
          req,
          "proj-1",
          { name: "Tampered Name" },
          prisma
        )
      ).rejects.toThrow();
    });

    it("rejects unauthenticated caller from deleting a project", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(null);

      await expect(
        deleteAdminProjectOperation(req, "proj-1", prisma)
      ).rejects.toThrow();
    });

    it("rejects unauthenticated caller from reordering projects", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(null);

      await expect(
        reorderAdminProjectsOperation(req, ["proj-1"], prisma)
      ).rejects.toThrow();
    });

    it("rejects inactive administrator from creating or deleting projects", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(inactiveUser);

      await expect(
        createAdminProjectOperation(req, { name: "Inactive Test", description: "Fail" }, prisma)
      ).rejects.toThrow(/deactivated|forbidden/i);

      await expect(
        deleteAdminProjectOperation(req, "proj-1", prisma)
      ).rejects.toThrow(/deactivated|forbidden/i);
    });

    it("rejects unprovisioned user without AdminProfile from accessing project operations", async () => {
      const prisma = createMockPrisma();
      const unprovisionedUser: User = {
        id: "99999999-9999-4999-8999-999999999999",
        email: "unknown@example.com",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      };
      const req = createAuthRequest(unprovisionedUser);

      await expect(
        listAdminProjectsOperation(req, undefined, prisma)
      ).rejects.toThrow(/not found|forbidden/i);
    });

    it("rejects dangerous URL schemes (javascript:) in project links", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      await expect(
        createAdminProjectOperation(
          req,
          {
            name: "XSS Attempt Project",
            description: "Testing URL scheme safety",
            liveUrl: "javascript:alert('XSS')",
          },
          prisma
        )
      ).rejects.toThrow(/cannot use dangerous protocol scheme/i);

      await expect(
        updateAdminProjectOperation(
          req,
          "proj-1",
          {
            githubUrl: "data:text/html,<script>alert(1)</script>",
          },
          prisma
        )
      ).rejects.toThrow(/cannot use dangerous protocol scheme/i);
    });

    it("rejects invalid project status string values", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      await expect(
        createAdminProjectOperation(
          req,
          {
            name: "Invalid Status Project",
            description: "Test status validation",
            status: "NON_EXISTENT_STATUS" as any,
          },
          prisma
        )
      ).rejects.toThrow(/invalid project status/i);

      await expect(
        updateAdminProjectOperation(
          req,
          "proj-1",
          {
            status: "MALFORMED_STATUS" as any,
          },
          prisma
        )
      ).rejects.toThrow(/invalid project status/i);
    });

    it("rejects excessive string lengths for name and description", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      const longName = "A".repeat(256);
      await expect(
        createAdminProjectOperation(
          req,
          {
            name: longName,
            description: "Valid description",
          },
          prisma
        )
      ).rejects.toThrow(/exceeds maximum length of 255/i);

      const longDesc = "B".repeat(1001);
      await expect(
        createAdminProjectOperation(
          req,
          {
            name: "Valid Name",
            description: longDesc,
          },
          prisma
        )
      ).rejects.toThrow(/exceeds maximum length of 1000/i);
    });

    it("rejects malformed gallery media IDs (non-array, empty string, non-string)", async () => {
      const prisma = createMockPrisma();
      const req = createAuthRequest(adminUser);

      await expect(
        createAdminProjectOperation(
          req,
          {
            name: "Malformed Gallery Project",
            description: "Testing array validation",
            thumbnailId: "media-thumb-1",
            galleryMediaIds: "not-an-array" as any,
          },
          prisma
        )
      ).rejects.toThrow(/must be an array/i);

      await expect(
        createAdminProjectOperation(
          req,
          {
            name: "Empty String Media ID",
            description: "Testing id string validation",
            thumbnailId: "media-thumb-1",
            galleryMediaIds: ["   "],
          },
          prisma
        )
      ).rejects.toThrow(/must be a non-empty string/i);
    });

    it("enforces shared-media deletion protection when media is referenced by a project", async () => {
      const customPrisma = {
        adminProfile: {
          findUnique: vi.fn().mockResolvedValue({
            id: adminUuid,
            email: "admin@cobralearn.com",
            role: "ADMIN",
            isActive: true,
          }),
        },
        mediaAsset: {
          findUnique: vi.fn().mockResolvedValue({
            id: "media-active-thumb",
            name: "hero-image.png",
            projectThumbnails: [{ id: "proj-1", name: "AI Autonomous Agent Platform" }],
            projectGalleryItems: [],
            websiteThumbnails: [],
            websiteGalleryItems: [],
            advertisementThumbnails: [],
            awardThumbnails: [],
            appearanceLogos: [],
            appearanceFavicons: [],
            homepageSections: [],
          }),
        },
      } as unknown as PrismaClient;

      const req = createAuthRequest(adminUser, "aal2");

      // Attempting to delete a media asset referenced by a project thumbnail must be blocked
      await expect(
        deleteAdminMediaAssetOperation(req, "media-active-thumb", customPrisma, {} as any)
      ).rejects.toThrow(/Referential Integrity Error: Cannot delete media asset "hero-image.png" because it is currently in use as thumbnail for Project/i);
    });
  });
});



