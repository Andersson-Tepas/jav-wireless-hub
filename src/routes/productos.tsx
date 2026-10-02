import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { PageIntro } from "@/components/site-shell";
import { ProductBrowser } from "@/components/product-catalog";

export const Route = createFileRoute("/productos")({
  validateSearch: zodValidator(z.object({ categoria: fallback(z.string(), "").default("") })),
  head: () => ({ meta: [{ title: "Productos — JAV Wireless" }, { name: "description", content: "Teléfonos, accesorios, perfumes, joyería, trajes, herramientas y gift shop en JAV Wireless." }, { property: "og:title", content: "Catálogo de productos — JAV Wireless" }, { property: "og:description", content: "Busca, filtra y compra en línea con recogida en tienda o envío." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: ProductsPage,
});

function ProductsPage() {
  const { categoria } = Route.useSearch();
  return <><PageIntro eyebrow="Catálogo" title="Nuestros productos" description="Filtra por categoría, marca, precio y disponibilidad. Abre cualquier producto para ver todos sus detalles." /><section className="section-pad"><div className="container-page"><ProductBrowser key={categoria} initialCategory={categoria} /></div></section></>;
}
