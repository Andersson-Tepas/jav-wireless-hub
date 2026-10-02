import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/products/$id")({
  server: {
    handlers: {
      GET: async (c) => (await import("@/lib/api-handlers.server")).getProduct(c as never),
    },
  },
});
