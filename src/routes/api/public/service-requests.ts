import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/service-requests")({
  server: {
    handlers: {
      POST: async (c) => (await import("@/lib/api-handlers.server")).postServiceRequest(c as never),
    },
  },
});
