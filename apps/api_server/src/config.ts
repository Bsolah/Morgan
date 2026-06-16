import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });
config({ path: resolve(__dirname, "../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32).default("dev-only-jwt-secret-change-in-production-32chars"),
  ENCRYPTION_KEY: z
    .string()
    .min(16)
    .default("dev-only-encryption-key-change-in-production"),
  SHOPIFY_API_KEY: z.string().optional(),
  SHOPIFY_API_SECRET: z.string().optional(),
  SHOPIFY_APP_SCOPES: z
    .string()
    .default(
      "read_orders,read_products,read_inventory,read_locations,read_shopify_payments_payouts,read_customers",
    ),
  SHOPIFY_APP_URL: z.string().url().optional(),
  MOBILE_DEEP_LINK_SCHEME: z.string().default("morgan"),
  BRONZE_STORAGE_PATH: z.string().default("./data/bronze"),
});

export const env = envSchema.parse(process.env);

export function isShopifyOAuthConfigured(): boolean {
  return Boolean(env.SHOPIFY_API_KEY && env.SHOPIFY_API_SECRET);
}

export function getShopifyOAuthCallbackUrl(): string {
  const base = (env.SHOPIFY_APP_URL ?? `http://localhost:${env.PORT}`).replace(/\/$/, "");
  return `${base}/api/v1/auth/shopify/callback`;
}

export function getMobileDeepLink(path: string, params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params).toString();
  const suffix = query ? `?${query}` : "";
  return `${env.MOBILE_DEEP_LINK_SCHEME}://${path}${suffix}`;
}
