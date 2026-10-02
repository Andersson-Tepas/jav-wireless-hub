import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/commercial-pages";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "JAV Wireless — Teléfonos, accesorios, perfumes y joyería" },
    { name: "description", content: "Compra teléfonos, accesorios, perfumes, joyería y más con recogida en tienda o envío." },
    { property: "og:title", content: "JAV Wireless" },
    { property: "og:description", content: "Productos destacados, ofertas y novedades." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: HomePage,
});
