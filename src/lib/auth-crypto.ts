import crypto from "node:crypto";

const RATE_LIMIT_STORE = new Map<string, { count: number; resetAt: number }>();

function getAuthSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "forno-e-mesa-internal-secret"
  );
}

/**
 * Constant-time string comparison using SHA-256 digests so lengths do not leak.
 */
export function safeEqualString(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Hashes a password or PIN with a random 16-byte salt using scrypt.
 */
export function hashSecret(plain: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(plain, salt, 32).toString("hex");
  return `${salt}:${derived}`;
}

/**
 * Verifies a password or PIN against a stored `salt:hash` string.
 */
export function verifySecret(
  plain: string,
  stored: string | null | undefined,
): boolean {
  if (!stored || !plain) return false;
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, hexHash] = parts;
  if (!salt || !hexHash) return false;
  try {
    const derived = crypto.scryptSync(plain, salt, 32);
    const expected = Buffer.from(hexHash, "hex");
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * Signs an arbitrary JSON session payload with HMAC-SHA256 (`base64url.hex`).
 */
export function signSessionPayload<T extends object>(payload: T): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getAuthSecret())
    .update(body)
    .digest("hex");
  return `${body}.${sig}`;
}

/**
 * Verifies and decodes an HMAC-signed session token, validating `exp` if present.
 */
export function verifySessionPayload<T extends { exp?: number }>(
  token: string | null | undefined,
): T | null {
  if (!token) return null;
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return null;
  const body = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!body || !sig) return null;

  const expectedSig = crypto
    .createHmac("sha256", getAuthSecret())
    .update(body)
    .digest("hex");

  if (!safeEqualString(sig, expectedSig)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as T;
    if (
      typeof parsed.exp === "number" &&
      Number.isFinite(parsed.exp) &&
      parsed.exp <= Date.now()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Simple sliding-window in-memory rate limiter for authentication endpoints.
 */
export function checkRateLimit(
  key: string,
  maxAttempts = 10,
  windowMs = 5 * 60 * 1000,
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  if (RATE_LIMIT_STORE.size > 500) {
    for (const [k, entry] of RATE_LIMIT_STORE.entries()) {
      if (entry.resetAt <= now) RATE_LIMIT_STORE.delete(k);
    }
  }

  const current = RATE_LIMIT_STORE.get(key);
  if (!current || current.resetAt <= now) {
    RATE_LIMIT_STORE.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (current.count >= maxAttempts) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  RATE_LIMIT_STORE.set(key, current);
  return { allowed: true, retryAfterSec: 0 };
}
