import crypto from "node:crypto";
import {
  safeEqualString,
  signSessionPayload,
  verifySessionPayload,
} from "./auth-crypto.ts";
import type { StaffRole } from "../types/erp.ts";

export const OPERATOR_COOKIE_NAME = "forno_operator_session";
export const OPERATOR_LOCKED_COOKIE = "forno_operator_locked";
export const CUSTOMER_COOKIE_NAME = "forno_customer_session";

const DEFAULT_PIN = "2026";

export interface OperatorSessionPayload {
  userId: number;
  name: string;
  email: string;
  role: StaffRole;
  exp: number;
}

export interface CustomerSessionPayload {
  customerId: number;
  name: string;
  phone: string;
  exp: number;
}

export function getOperatorPin(): string {
  return process.env.ERP_OPERATOR_PIN?.trim() || DEFAULT_PIN;
}

export function buildOperatorToken(pin: string): string {
  const secret =
    process.env.AUTH_SECRET?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "forno-e-mesa-internal-secret";
  return crypto
    .createHmac("sha256", secret)
    .update(`operator:${pin}`)
    .digest("hex");
}

export function buildSignedOperatorToken(
  session: Omit<OperatorSessionPayload, "exp">,
  ttlMs = 1000 * 60 * 60 * 12,
): string {
  return signSessionPayload<OperatorSessionPayload>({
    ...session,
    exp: Date.now() + ttlMs,
  });
}

export function parseSignedOperatorToken(
  token: string | null | undefined,
): OperatorSessionPayload | null {
  const payload = verifySessionPayload<OperatorSessionPayload>(token);
  if (!payload || !payload.role || !payload.name) return null;
  return payload;
}

export function buildSignedCustomerToken(
  session: Omit<CustomerSessionPayload, "exp">,
  ttlMs = 1000 * 60 * 60 * 24 * 30,
): string {
  return signSessionPayload<CustomerSessionPayload>({
    ...session,
    exp: Date.now() + ttlMs,
  });
}

export function parseSignedCustomerToken(
  token: string | null | undefined,
): CustomerSessionPayload | null {
  const payload = verifySessionPayload<CustomerSessionPayload>(token);
  if (!payload || !payload.customerId || !payload.phone) return null;
  return payload;
}

export function extractHostname(hostHeader: string | null | undefined): string {
  const raw = (hostHeader ?? "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.startsWith("[")) {
    const endIdx = raw.indexOf("]");
    return endIdx > 0 ? raw.slice(1, endIdx) : raw;
  }
  return raw.split(":")[0] ?? "";
}

/**
 * Allows ERP access on desktop localhost/loopback without login (unless locked),
 * while blocking mobile browsers and LAN/external hosts unless unlocked with a
 * valid operator cookie (legacy HMAC or signed RBAC session token).
 */
export function isErpAllowedContext(params: {
  host: string | null | undefined;
  userAgent: string | null | undefined;
  cookieToken: string | null | undefined;
  expectedToken?: string;
  lockedCookie?: string | null | undefined;
}): boolean {
  if (params.cookieToken) {
    const expected = params.expectedToken ?? buildOperatorToken(getOperatorPin());
    if (safeEqualString(params.cookieToken, expected)) {
      return true;
    }
    if (parseSignedOperatorToken(params.cookieToken)) {
      return true;
    }
  }

  if (params.lockedCookie === "1") {
    return false;
  }

  const hostname = extractHostname(params.host);
  const isLocalHost =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  const isMobileUa =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(
      params.userAgent ?? "",
    );

  return isLocalHost && !isMobileUa;
}
