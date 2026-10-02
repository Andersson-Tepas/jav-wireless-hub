import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/commercial-pages";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "JAV Wireless — Tecnología que te mantiene conectado" },
    { name: "description", content: "Equipos, accesorios, financiamiento, reparaciones y conectividad móvil." },
    { property: "og:title", content: "JAV Wireless" },
    { property: "og:description", content: "Tecnología, conectividad y soporte móvil." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: HomePage,
});
