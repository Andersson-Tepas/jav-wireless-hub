import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/products")({
  server: {
    handlers: {
      GET: async (c) => (await import("@/lib/api-handlers.server")).listProducts(c as never),
    },
  },
});
