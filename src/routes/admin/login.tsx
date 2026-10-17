import { createFileRoute, redirect } from "@tanstack/react-router";
import { safeRedirect } from "@/lib/auth/safe-redirect";

interface LoginSearch {
  next?: string | undefined;
}

export const Route = createFileRoute("/admin/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    next: typeof search["next"] === "string" ? search["next"] : undefined,
  }),
  beforeLoad: ({ search }) => {
    const safeNext = safeRedirect(search.next, "");
    throw redirect({
      to: "/admin",
      search: safeNext ? { next: safeNext } : undefined,
    });
  },
});
