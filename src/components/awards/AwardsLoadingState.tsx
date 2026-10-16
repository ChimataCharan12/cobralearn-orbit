import { CmsLoadingState } from "@/components/common/CmsLoadingState";

export interface AwardsLoadingStateProps {
  progress?: number | undefined;
  statusText?: string | undefined;
}

export function AwardsLoadingState({
  progress,
  statusText = "Please wait while we fetch your recognitions, honors, and certificates.",
}: AwardsLoadingStateProps = {}) {
  return (
    <CmsLoadingState
      title="Loading Awards..."
      statusText={statusText}
      progress={progress}
      ariaLabel="Loading awards"
    />
  );
}
