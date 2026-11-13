import crypto from "node:crypto";

export const OPERATOR_COOKIE_NAME = "forno_operator_session";

const DEFAULT_PIN = "2026";

export function getOperatorPin(): string {
  return process.env.ERP_OPERATOR_PIN?.trim() || DEFAULT_PIN;
}

export function buildOperatorToken(pin: string): string {
  const secret =
    process.env.DATABASE_URL?.trim() || "forno-e-mesa-internal-secret";
  return crypto
    .createHmac("sha256", secret)
    .update(`operator:${pin}`)
    .digest("hex");
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
 * Allows ERP access on desktop localhost/loopback without login, while blocking
 * mobile browsers and LAN/external hosts unless unlocked with a valid operator cookie.
 */
export function isErpAllowedContext(params: {
  host: string | null | undefined;
  userAgent: string | null | undefined;
  cookieToken: string | null | undefined;
  expectedToken?: string;
}): boolean {
  const expected = params.expectedToken ?? buildOperatorToken(getOperatorPin());
  if (params.cookieToken && params.cookieToken === expected) {
    return true;
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
