import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/categories")({
  server: {
    handlers: {
      GET: async (c) => (await import("@/lib/api-handlers.server")).adminListCategories(c as never),
      POST: async (c) => (await import("@/lib/api-handlers.server")).adminCreateCategory(c as never),
    },
  },
});
