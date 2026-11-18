import { config as dotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

dotenv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});
const origin = z
  .url()
  .refine((value) => new URL(value).origin === value && /^https?:/.test(value));
export const settings = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.url(),
    WEB_ORIGIN: origin.default("http://localhost:5173"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    ALLOW_REGISTRATION: z.enum(["true", "false"]).optional(),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    DEMO_VIEW: z.enum(["true", "false"]).default("false"),
  })
  .refine(
    (value) =>
      value.NODE_ENV !== "production" ||
      value.WEB_ORIGIN.startsWith("https://"),
    "WEB_ORIGIN requiere HTTPS",
  )
  .parse(process.env);
