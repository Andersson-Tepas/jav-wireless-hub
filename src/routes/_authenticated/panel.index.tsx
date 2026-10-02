import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/admin/dashboard";

export const Route = createFileRoute("/_authenticated/panel/")({
  head: () => ({ meta: [{ title: "Dashboard — Panel JAV Wireless" }, { name: "description", content: "Indicadores del negocio." }, { property: "og:title", content: "Dashboard — Panel JAV Wireless" }, { property: "og:description", content: "Indicadores del negocio." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});
