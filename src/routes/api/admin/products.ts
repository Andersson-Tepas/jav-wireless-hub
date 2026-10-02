import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/products")({
  server: {
    handlers: {
      GET: async (c) => (await import("@/lib/api-handlers.server")).adminListProducts(c as never),
      POST: async (c) => (await import("@/lib/api-handlers.server")).adminCreateProduct(c as never),
    },
  },
});
