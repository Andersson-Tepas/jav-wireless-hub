import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/services/$id")({
  server: {
    handlers: {
      PUT: async (c) => (await import("@/lib/api-handlers.server")).adminUpdateService(c as never),
    },
  },
});
