import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/categories")({
  server: {
    handlers: {
      GET: async (c) => (await import("@/lib/api-handlers.server")).listCategories(c as never),
    },
  },
});
