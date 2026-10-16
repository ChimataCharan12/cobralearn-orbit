import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/contact")({
  head: () => ({
    meta: [
      { title: "Contact Page Management — CobraLearn Innotechcore Admin" },
      {
        name: "description",
        content:
          "Manage public contact page content, direct contact info, social links, FAQs, and form settings.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ContactAdminLayout,
});

function ContactAdminLayout() {
  return <Outlet />;
}
