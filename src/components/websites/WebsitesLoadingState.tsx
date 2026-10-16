import { CmsLoadingState } from "@/components/common/CmsLoadingState";

export interface WebsitesLoadingStateProps {
  progress?: number | undefined;
  statusText?: string | undefined;
}

export function WebsitesLoadingState({
  progress,
  statusText = "Please wait while we fetch your deployments and web showcases.",
}: WebsitesLoadingStateProps = {}) {
  return (
    <CmsLoadingState
      title="Loading Websites..."
      statusText={statusText}
      progress={progress}
      ariaLabel="Loading websites"
    />
  );
}

