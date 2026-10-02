import { createServerFn } from "@tanstack/react-start";
import { lookupSchema, orderSchema, serviceLookupSchema, serviceSchema } from "./commerce.schemas";

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => orderSchema.parse(d))
  .handler(async ({ data }) => (await import("./commerce.server")).createOrderCore(data));

export const lookupOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => lookupSchema.parse(d))
  .handler(async ({ data }) => (await import("./commerce.server")).lookupOrderCore(data.order_number, data.contact));

export const createServiceRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => serviceSchema.parse(d))
  .handler(async ({ data }) => (await import("./commerce.server")).createServiceRequestCore(data));

export const lookupServiceRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => serviceLookupSchema.parse(d))
  .handler(async ({ data }) => (await import("./commerce.server")).lookupServiceRequestCore(data.reference, data.contact));
