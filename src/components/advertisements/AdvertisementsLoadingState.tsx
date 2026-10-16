import { CmsLoadingState } from "@/components/common/CmsLoadingState";

export interface AdvertisementsLoadingStateProps {
  progress?: number | undefined;
  statusText?: string | undefined;
}

export function AdvertisementsLoadingState({
  progress,
  statusText = "Please wait while we fetch your active campaigns and ad creatives.",
}: AdvertisementsLoadingStateProps = {}) {
  return (
    <CmsLoadingState
      title="Loading Advertisements..."
      statusText={statusText}
      progress={progress}
      ariaLabel="Loading advertisements"
    />
  );
}

