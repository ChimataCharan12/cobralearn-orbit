import { createFileRoute } from "@tanstack/react-router";
import { AdminBranding } from "@/components/AdminBranding";
import { AccessDeniedCard } from "@/components/auth/AccessDeniedCard";
import environment from "@/assets/cobralearn-admin-environment.jpg";

export const Route = createFileRoute("/admin/access-denied")({
  head: () => ({
    meta: [
      { title: "Access Denied — CobraLearn Innotechcore Admin" },
      { name: "description", content: "You do not have permission to access this area." },
      { property: "og:title", content: "Access Denied — CobraLearn Innotechcore Admin" },
      { property: "og:description", content: "Administrator permission required to view this area." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccessDeniedPage,
});

function AccessDeniedPage() {
  return (
    <main className="relative min-h-screen lg:h-dvh lg:min-h-0 lg:max-h-dvh lg:overflow-hidden w-full overflow-x-hidden bg-[#020604] flex items-center justify-center select-none">
      {/* Pure Scenery Environment Background Plate */}
      <img
        src={environment}
        alt=""
        aria-hidden="true"
        className="fixed inset-0 h-full w-full object-cover object-center pointer-events-none z-0"
      />

      {/* Real Responsive DOM Container */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1560px] min-h-screen lg:min-h-0 lg:h-full flex-col lg:flex-row items-center justify-between px-5 sm:px-8 lg:px-10 xl:px-14 py-6 lg:py-2.5 gap-6 lg:gap-8">
        <AdminBranding />
        <AccessDeniedCard />
      </div>
    </main>
  );
}
