import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/products/$id/variants")({
  server: { handlers: {
    GET: async c => (await import("@/lib/variants-api.server")).adminGetVariants(c),
    PUT: async c => (await import("@/lib/variants-api.server")).adminConfigureVariants(c),
  } },
});