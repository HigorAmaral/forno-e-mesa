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
 * Strictly requires a valid signed RBAC operator session cookie or legacy HMAC
 * operator cookie on every host (including localhost). Never bypasses auth automatically.
 */
export function isErpAllowedContext(params: {
  host?: string | null | undefined;
  userAgent?: string | null | undefined;
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

  return false;
}
