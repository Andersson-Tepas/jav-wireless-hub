import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/admin/dashboard";

export const Route = createFileRoute("/_authenticated/panel/")({
  head: () => ({ meta: [{ title: "Dashboard — JAV Wireless Admin" }, { name: "description", content: "Business metrics." }, { property: "og:title", content: "Dashboard — JAV Wireless Admin" }, { property: "og:description", content: "Business metrics." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});
