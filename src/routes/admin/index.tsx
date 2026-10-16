import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AdminBranding } from "@/components/AdminBranding";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { useAuth } from "@/lib/auth/use-auth";
import environment from "@/assets/cobralearn-admin-environment.jpg";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Sign In — CobraLearn Innotechcore" },
      { name: "description", content: "Sign in to the private CobraLearn Innotechcore Showcase Admin Portal." },
      { property: "og:title", content: "Admin Sign In — CobraLearn Innotechcore" },
      { property: "og:description", content: "Secure access to the CobraLearn showcase administration portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "manifest", href: "/manifest-admin.webmanifest" },
    ],
  }),
  component: Index,
});

function Index() {
  const { isAuthenticated, isEligibleAdmin, isLoading, isEligibilityLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isEligibilityLoading && isAuthenticated && isEligibleAdmin) {
      navigate({ to: "/admin/dashboard" });
    }
  }, [isAuthenticated, isEligibleAdmin, isLoading, isEligibilityLoading, navigate]);
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
        <AdminLoginForm />
      </div>
    </main>
  );
}


