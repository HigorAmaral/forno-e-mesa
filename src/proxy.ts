import { NextResponse, type NextRequest } from "next/server";
import {
  buildOperatorToken,
  getOperatorPin,
  OPERATOR_COOKIE_NAME,
  OPERATOR_LOCKED_COOKIE,
  parseSignedOperatorToken,
} from "./lib/access-policy";
import { safeEqualString } from "./lib/auth-crypto";
import { hasAnyRole } from "./lib/rbac";
import { resolveRoutePolicy } from "./lib/route-auth";
import type { StaffRole } from "./types/erp";

function resolveCookieRole(
  token: string | undefined,
  locked: string | undefined,
): StaffRole | null {
  if (!token || (locked === "1" && !token)) {
    return null;
  }

  const signed = parseSignedOperatorToken(token);
  if (signed) {
    return signed.role;
  }

  const expectedLegacy = buildOperatorToken(getOperatorPin());
  if (safeEqualString(token, expectedLegacy)) {
    return "ADMIN";
  }

  return null;
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export function proxy(request: NextRequest) {
  const decision = resolveRoutePolicy(request.nextUrl.pathname, request.method);

  if (decision.access === "operator") {
    const token = request.cookies.get(OPERATOR_COOKIE_NAME)?.value;
    const locked = request.cookies.get(OPERATOR_LOCKED_COOKIE)?.value;
    const role = resolveCookieRole(token, locked);

    if (!role) {
      if (decision.isApi) {
        return applySecurityHeaders(
          NextResponse.json(
            { error: "Autenticação obrigatória para acessar esta rota." },
            { status: 401 },
          ),
        );
      }

      const loginUrl = new URL("/login", request.url);
      const target = `${request.nextUrl.pathname}${request.nextUrl.search}`;
      if (target && target !== "/") {
        loginUrl.searchParams.set("next", target);
      }
      loginUrl.searchParams.set("reason", "auth");
      return applySecurityHeaders(NextResponse.redirect(loginUrl));
    }

    if (decision.allowedRoles && !hasAnyRole(role, decision.allowedRoles)) {
      if (decision.isApi) {
        return applySecurityHeaders(
          NextResponse.json(
            { error: "Acesso negado. Seu perfil não tem permissão para esta rota." },
            { status: 403 },
          ),
        );
      }

      const homeUrl = new URL("/", request.url);
      homeUrl.searchParams.set("reason", "forbidden");
      return applySecurityHeaders(NextResponse.redirect(homeUrl));
    }
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
