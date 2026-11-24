import { ALL_STAFF_ROLES, type StaffRole } from "./rbac.ts";

export type RouteAccessDecision =
  | { access: "public" }
  | { access: "operator"; allowedRoles?: StaffRole[]; isApi: boolean };

const ADMIN_GERENTE: StaffRole[] = ["ADMIN", "GERENTE"];
const POS_ROLES: StaffRole[] = ["ADMIN", "GERENTE", "CAIXA"];
const SALAO_ROLES: StaffRole[] = ["ADMIN", "GERENTE", "CAIXA", "GARCOM"];
const DELIVERY_OPS_ROLES: StaffRole[] = ["ADMIN", "GERENTE", "CAIXA", "COZINHA"];
const KITCHEN_ROLES: StaffRole[] = ["ADMIN", "GERENTE", "COZINHA"];

function normalizePath(pathname: string): string {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

/**
 * Declarative, fail-closed access policy evaluated both by Next.js `src/proxy.ts`
 * and unit tests.
 */
export function resolveRoutePolicy(
  rawPathname: string,
  rawMethod = "GET",
): RouteAccessDecision {
  const pathname = normalizePath(rawPathname);
  const method = rawMethod.toUpperCase();

  // Public customer-facing pages and entry portals
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/delivery" ||
    pathname === "/conta" ||
    pathname === "/manifest.webmanifest" ||
    /^\/mesa\/[^/]+$/.test(pathname) ||
    /^\/delivery\/acompanhar\/[^/]+$/.test(pathname)
  ) {
    return { access: "public" };
  }

  // Protected internal page routes
  if (
    pathname === "/erp" ||
    pathname.startsWith("/erp/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/painel" ||
    pathname.startsWith("/painel/")
  ) {
    return { access: "operator", isApi: false };
  }

  // API endpoints
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    // Auth endpoints are public
    if (pathname === "/api/auth/operator" || pathname === "/api/auth/customer") {
      return { access: "public" };
    }

    // Public read / token-validated storefront & QR endpoints
    if (pathname === "/api/settings") {
      return method === "GET"
        ? { access: "public" }
        : { access: "operator", allowedRoles: ADMIN_GERENTE, isApi: true };
    }

    if (pathname === "/api/delivery/zones") {
      return method === "GET"
        ? { access: "public" }
        : { access: "operator", allowedRoles: ADMIN_GERENTE, isApi: true };
    }

    if (pathname === "/api/coupons") {
      return method === "GET"
        ? { access: "public" }
        : { access: "operator", allowedRoles: ADMIN_GERENTE, isApi: true };
    }

    if (pathname === "/api/menu" && method === "GET") {
      return { access: "public" };
    }

    if (pathname === "/api/delivery/track" && method === "GET") {
      return { access: "public" };
    }

    if (pathname === "/api/reviews") {
      return method === "POST"
        ? { access: "public" }
        : { access: "operator", allowedRoles: ADMIN_GERENTE, isApi: true };
    }

    if (pathname === "/api/orders" && method === "POST") {
      return { access: "public" };
    }

    if (/^\/api\/tables\/[^/]+\/qr$/.test(pathname)) {
      return { access: "operator", allowedRoles: SALAO_ROLES, isApi: true };
    }

    if (/^\/api\/tables\/[^/]+$/.test(pathname)) {
      if (method === "GET" || method === "PATCH") {
        return { access: "public" };
      }
      return { access: "operator", allowedRoles: ADMIN_GERENTE, isApi: true };
    }

    // Protected ERP APIs with strict RBAC
    if (pathname === "/api/staff" || pathname === "/api/finance") {
      return { access: "operator", allowedRoles: ADMIN_GERENTE, isApi: true };
    }

    if (pathname === "/api/tables") {
      return { access: "operator", allowedRoles: ADMIN_GERENTE, isApi: true };
    }

    if (
      pathname === "/api/cash" ||
      pathname === "/api/customers" ||
      pathname === "/api/reports/export"
    ) {
      return { access: "operator", allowedRoles: POS_ROLES, isApi: true };
    }

    if (pathname === "/api/inventory") {
      return {
        access: "operator",
        allowedRoles: method === "DELETE" ? ADMIN_GERENTE : POS_ROLES,
        isApi: true,
      };
    }

    if (pathname === "/api/batches" || /^\/api\/batches\/[^/]+$/.test(pathname)) {
      return { access: "operator", allowedRoles: KITCHEN_ROLES, isApi: true };
    }

    if (pathname === "/api/cakes" || /^\/api\/cakes\/[^/]+$/.test(pathname)) {
      return { access: "operator", allowedRoles: DELIVERY_OPS_ROLES, isApi: true };
    }

    if (pathname === "/api/reservations") {
      return {
        access: "operator",
        allowedRoles: method === "DELETE" ? POS_ROLES : SALAO_ROLES,
        isApi: true,
      };
    }

    if (/^\/api\/orders\/[^/]+\/checkout$/.test(pathname)) {
      return { access: "operator", allowedRoles: POS_ROLES, isApi: true };
    }

    if (/^\/api\/orders\/[^/]+\/delivery$/.test(pathname)) {
      return { access: "operator", allowedRoles: DELIVERY_OPS_ROLES, isApi: true };
    }

    if (/^\/api\/orders\/[^/]+$/.test(pathname)) {
      return { access: "operator", allowedRoles: SALAO_ROLES, isApi: true };
    }

    if (
      /^\/api\/orders\/[^/]+\/items\/[^/]+$/.test(pathname) ||
      /^\/api\/orders\/[^/]+\/kds-complete$/.test(pathname) ||
      pathname === "/api/workspace" ||
      pathname === "/api/notes"
    ) {
      return { access: "operator", allowedRoles: ALL_STAFF_ROLES, isApi: true };
    }

    // Fail-closed fallback for any other /api/* route
    return { access: "operator", isApi: true };
  }

  return { access: "public" };
}

/**
 * Sanitizes post-login redirect paths to prevent open-redirect vulnerabilities.
 */
export function sanitizeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/";
  }
  if (trimmed === "/login" || trimmed.startsWith("/login?")) {
    return "/";
  }
  return trimmed;
}
