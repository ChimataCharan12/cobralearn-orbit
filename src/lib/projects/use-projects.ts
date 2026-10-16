import { useState, useEffect, useCallback, useRef } from "react";
import { adminClient } from "@/lib/api/admin-client";
import type { ProjectWithMedia, CreateProjectPayload, UpdateProjectPayload } from "@/lib/server/projects-operations";
import { toast } from "sonner";
import type { PublishStatus } from "@prisma/client";

export function useProjects(options?: { status?: PublishStatus; search?: string }) {
  const [projects, setProjects] = useState<ProjectWithMedia[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const activeRequestIdRef = useRef(0);

  const fetchProjects = useCallback(async () => {
    const currentRequestId = ++activeRequestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const res = await adminClient.listAdminProjects(options);
      if (currentRequestId !== activeRequestIdRef.current) return;

      if (res.success && res.data) {
        setProjects(res.data);
      } else {
        setError(res.error || "Failed to load projects from database");
      }
    } catch (err: unknown) {
      if (currentRequestId !== activeRequestIdRef.current) return;
      const message = err instanceof Error ? err.message : "Failed to load projects from database";
      setError(message);
    } finally {
      if (currentRequestId === activeRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [options?.status, options?.search]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = async (payload: CreateProjectPayload): Promise<ProjectWithMedia | null> => {
    try {
      const res = await adminClient.createAdminProject(payload);
      if (res.success && res.data) {
        toast.success(`Project "${res.data.name}" created successfully.`);
        await fetchProjects();
        return res.data;
      } else {
        toast.error(res.error || "Failed to create project");
        return null;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create project";
      toast.error(msg);
      return null;
    }
  };

  const updateProject = async (id: string, payload: UpdateProjectPayload): Promise<ProjectWithMedia | null> => {
    try {
      const res = await adminClient.updateAdminProject(id, payload);
      if (res.success && res.data) {
        toast.success(`Project "${res.data.name}" updated successfully.`);
        await fetchProjects();
        return res.data;
      } else {
        toast.error(res.error || "Failed to update project");
        return null;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update project";
      toast.error(msg);
      return null;
    }
  };

  const deleteProject = async (id: string): Promise<boolean> => {
    try {
      const res = await adminClient.deleteAdminProject(id);
      if (res.success) {
        toast.success("Project deleted successfully.");
        await fetchProjects();
        return true;
      } else {
        toast.error(res.error || "Failed to delete project. CMS_DELETE permission required.");
        return false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete project";
      toast.error(msg);
      return false;
    }
  };

  const reorderProjects = async (orderedIds: string[]): Promise<boolean> => {
    try {
      const res = await adminClient.reorderAdminProjects(orderedIds);
      if (res.success) {
        toast.success("Projects reordered successfully.");
        await fetchProjects();
        return true;
      } else {
        toast.error(res.error || "Failed to reorder projects");
        return false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reorder projects";
      toast.error(msg);
      return false;
    }
  };

  return {
    projects,
    isLoading,
    error,
    refreshProjects: fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    reorderProjects,
  };
}
