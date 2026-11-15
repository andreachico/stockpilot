/**
 * Shopify embedded-app configuration (OAuth + sessions + webhooks).
 *
 * This is the "Shopify authentication" layer: it wires up the OAuth install
 * flow, token-exchange session auth for the embedded admin, Prisma-backed
 * session storage and the admin GraphQL client used by loaders/actions.
 *
 * In MOCK MODE (no credentials) `authenticate.admin` is simply never called —
 * loaders short-circuit to fixtures — so the app still runs offline.
 */
import "dotenv/config";
import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";

import prisma from "./db.server";

const shopify = shopifyApp({
  // Fallbacks keep the app bootable in MOCK MODE (no credentials); they are
  // never used because `authenticate.*` is only called when USE_MOCK is false.
  apiKey: process.env.SHOPIFY_API_KEY || "mock-api-key",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "mock-api-secret",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "http://localhost:3000",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
