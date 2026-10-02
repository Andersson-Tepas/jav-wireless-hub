import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/categories/$id")({
  server: {
    handlers: {
      PUT: async (c) => (await import("@/lib/api-handlers.server")).adminUpdateCategory(c as never),
      DELETE: async (c) => (await import("@/lib/api-handlers.server")).adminDeleteCategory(c as never),
    },
  },
});
