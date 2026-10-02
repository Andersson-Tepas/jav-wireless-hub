import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/commercial-pages";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "JAV Wireless — Phones, accessories, fragrances, and jewelry" },
    { name: "description", content: "Shop phones, accessories, fragrances, jewelry, and more for in-store pickup or delivery." },
    { property: "og:title", content: "JAV Wireless" },
    { property: "og:description", content: "Featured products, deals, and new arrivals." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: HomePage,
});
