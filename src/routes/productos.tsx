import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { PageIntro } from "@/components/site-shell";
import { ProductBrowser } from "@/components/product-catalog";

export const Route = createFileRoute("/productos")({
  validateSearch: zodValidator(z.object({ categoria: fallback(z.string(), "").default("") })),
  head: () => ({ meta: [{ title: "Products — JAV Wireless" }, { name: "description", content: "Phones, accessories, fragrances, jewelry, suits, tools, and gifts at JAV Wireless." }, { property: "og:title", content: "Product Catalog — JAV Wireless" }, { property: "og:description", content: "Search, filter, and shop online for in-store pickup or delivery." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: ProductsPage,
});

function ProductsPage() {
  const { categoria } = Route.useSearch();
  return <><PageIntro eyebrow="Catalog" title="Our Products" description="Filter by category, brand, price, and availability. Open any product to see all details." /><section className="section-pad"><div className="container-page"><ProductBrowser key={categoria} initialCategory={categoria} /></div></section></>;
}
