import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildOperatorToken,
  CUSTOMER_COOKIE_NAME,
  getOperatorPin,
  OPERATOR_COOKIE_NAME,
  OPERATOR_LOCKED_COOKIE,
  parseSignedCustomerToken,
  parseSignedOperatorToken,
} from "./access-policy";
import { safeEqualString } from "./auth-crypto";
import { hasAnyRole, isValidStaffRole } from "./rbac";
import { prisma } from "./prisma";
import type { OperatorSessionDto, StaffRole } from "@/types/erp";

export {
  buildOperatorToken,
  buildSignedCustomerToken,
  buildSignedOperatorToken,
  CUSTOMER_COOKIE_NAME,
  getOperatorPin,
  OPERATOR_COOKIE_NAME,
  OPERATOR_LOCKED_COOKIE,
} from "./access-policy";

export async function getServerOperatorSession(): Promise<OperatorSessionDto | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(OPERATOR_COOKIE_NAME)?.value;
  const locked = cookieStore.get(OPERATOR_LOCKED_COOKIE)?.value;

  if (!token || (locked === "1" && !token)) {
    return null;
  }

  const signed = parseSignedOperatorToken(token);
  if (signed) {
    if (signed.userId > 0) {
      const dbUser = await prisma.staffUser.findUnique({
        where: { id: signed.userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      });
      if (!dbUser || !dbUser.isActive || !isValidStaffRole(dbUser.role)) {
        return null;
      }
      return {
        userId: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
      };
    }

    if (!isValidStaffRole(signed.role)) {
      return null;
    }

    return {
      userId: signed.userId,
      name: signed.name,
      email: signed.email,
      role: signed.role,
    };
  }

  const expectedLegacy = buildOperatorToken(getOperatorPin());
  if (safeEqualString(token, expectedLegacy)) {
    return {
      userId: 0,
      name: "Operador Master",
      email: "admin@fornoemesa.com",
      role: "ADMIN",
    };
  }

  return null;
}

export async function isServerErpAuthorized(): Promise<boolean> {
  const session = await getServerOperatorSession();
  return session !== null;
}

export async function forbiddenIfNotErpOperator(
  allowedRoles?: StaffRole[],
): Promise<NextResponse | null> {
  const session = await getServerOperatorSession();
  if (!session) {
    return NextResponse.json(
      { error: "Autenticação obrigatória. Faça login para acessar esta rota." },
      { status: 401 },
    );
  }
  if (!hasAnyRole(session.role, allowedRoles)) {
    return NextResponse.json(
      { error: "Acesso negado. Seu perfil não possui permissão para esta rota." },
      { status: 403 },
    );
  }
  return null;
}

export async function getServerCustomerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_COOKIE_NAME)?.value;
  return parseSignedCustomerToken(token);
}

export async function recordAuditLog(params: {
  actorName: string;
  actorRole: string;
  action: string;
  entity?: string;
  details?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorName: params.actorName.slice(0, 80),
        actorRole: params.actorRole.slice(0, 30),
        action: params.action.slice(0, 120),
        entity: params.entity?.slice(0, 80) ?? null,
        details: params.details?.slice(0, 400) ?? null,
      },
    });
  } catch {
    // Non-blocking audit logging
  }
}
