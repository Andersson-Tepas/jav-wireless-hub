import { z } from "zod";

const contact = {
  return_origin: z.string().url().max(200).optional(),
  customer_name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(7).max(30),
};

export const orderSchema = z
  .object({
    ...contact,
    address: z.string().trim().max(300).optional(),
    delivery_method: z.enum(["pickup", "shipping"]),
    payment_method: z.enum(["card", "paypal", "zelle"]),
    payment_reference: z.string().trim().max(2000).optional(),
    notes: z.string().trim().max(500).optional(),
    items: z
      .array(
        z.object({
          id: z.string().uuid(),
          quantity: z.number().int().min(1).max(50),
        }),
      )
      .min(1)
      .max(50),
  })
  .refine(
    (d) =>
      d.delivery_method !== "shipping" ||
      (d.address && d.address.length > 5),
    {
      message: "Shipping address is required",
      path: ["address"],
    },
  )
  .refine(
    (d) =>
      d.payment_method !== "zelle" ||
      (d.payment_reference && d.payment_reference.length > 10),
    {
      message: "Zelle payment receipt is required",
      path: ["payment_reference"],
    },
  );

export const lookupSchema = z.object({
  order_number: z.string().trim().min(3).max(20),
  contact: z.string().trim().min(3).max(255),
});

export const serviceSchema = z
  .object({
    ...contact,
    service_slug: z.string().max(60),
    service_name: z.string().max(100).optional(),
    details: z.record(z.string(), z.string().max(1000)),
    amount: z.number().min(0).max(100000).nullable(),
    payment_method: z.enum(["card", "paypal", "zelle", "store"]),
    payment_reference: z.string().trim().max(2000).optional(),
  })
  .refine(
    (d) =>
      d.payment_method !== "zelle" ||
      (d.payment_reference && d.payment_reference.length > 10),
    {
      message: "Zelle payment receipt is required",
      path: ["payment_reference"],
    },
  );

export const serviceLookupSchema = z.object({
  reference: z.string().trim().min(3).max(20),
  contact: z.string().trim().min(3).max(255),
});

export type OrderInput = z.infer<typeof orderSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;

// Bill Payments: company fee is fixed per carrier and always computed (never entered by the customer).
export const billCarrierFees: Record<string, number> = {
  "T-Mobile": 3,
  "Ultra Mobile": 3,
  Lycamobile: 3,
  GenMobile: 3,
  "AT&T Prepaid": 3,
  "Verizon Prepaid": 3,
  "Page Plus": 3,
  "Simple Mobile": 3,
  "Net-10": 3,
  H2O: 3,
  "Boost Mobile": 4,
  Cricket: 5,
  "Metro PCS": 5,
};