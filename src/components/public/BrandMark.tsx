import { Link } from "@tanstack/react-router";
import logoImg from "@/assets/cobralearn-official-logo.png";
import { usePublicAppearance } from "@/lib/theme/public-appearance-context";

export function BrandMark({
  compact = false,
  logoUrl,
}: {
  compact?: boolean;
  logoUrl?: string | null;
}) {
  const appearance = usePublicAppearance();
  const effectiveLogo = logoUrl || appearance.logoUrl || logoImg;

  return (
    <Link to="/" className="brand-mark" aria-label="CobraLearn Innotechcore home">
      <img
        src={effectiveLogo}
        alt="CobraLearn InnoTechCore"
        className={`brand-logo-img ${compact ? "brand-logo-compact" : ""}`.trim()}
        width={660}
        height={190}
        onError={(e) => {
          // Graceful fallback if a custom remote asset fails to load
          if (e.currentTarget.src !== logoImg) {
            e.currentTarget.src = logoImg;
          }
        }}
      />
    </Link>
  );
}
