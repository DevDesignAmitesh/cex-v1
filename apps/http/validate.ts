import z from "zod";

export const orderInput = z.object({
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["LIMIT", "MARKET"]),
  symbol: z.string().includes("/"),
  price: z.number().optional(),
  qty: z.number().optional(),
  userId: z.uuid(),
  ioc: z.boolean().default(false),
})