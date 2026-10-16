import { CmsLoadingState } from "@/components/common/CmsLoadingState";

export interface ProjectsLoadingStateProps {
  progress?: number | undefined;
  statusText?: string | undefined;
}

export function ProjectsLoadingState({
  progress,
  statusText = "Please wait while we fetch your data.",
}: ProjectsLoadingStateProps = {}) {
  return (
    <CmsLoadingState
      title="Loading Projects..."
      statusText={statusText}
      progress={progress}
      ariaLabel="Loading projects"
    />
  );
}

