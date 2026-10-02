import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/products/$id")({
  server: {
    handlers: {
      PUT: async (c) => (await import("@/lib/api-handlers.server")).adminUpdateProduct(c as never),
      DELETE: async (c) => (await import("@/lib/api-handlers.server")).adminDeleteProduct(c as never),
    },
  },
});
