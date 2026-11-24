import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildSignedOperatorToken,
  getOperatorPin,
  getServerOperatorSession,
  OPERATOR_COOKIE_NAME,
  OPERATOR_LOCKED_COOKIE,
  recordAuditLog,
} from "@/lib/access-guard";
import { checkRateLimit, safeEqualString, verifySecret } from "@/lib/auth-crypto";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import type { StaffRole } from "@/types/erp";

const OperatorLoginSchema = z.union([
  z.object({
    pin: z.string().min(2).max(32),
  }),
  z.object({
    email: z.string().email().max(120),
    password: z.string().min(4).max(120),
  }),
]);

function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "local";
}

export async function GET() {
  const session = await getServerOperatorSession();
  return NextResponse.json({
    authenticated: session !== null,
    session,
  });
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`operator-login:${ip}`, 12, 5 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: `Muitas tentativas. Aguarde ${rl.retryAfterSec}s e tente novamente.`,
        },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = OperatorLoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Informe um PIN válido ou e-mail e senha." },
        { status: 400 },
      );
    }

    await ensureSeeded();

    let matchedUser: {
      id: number;
      name: string;
      email: string;
      role: StaffRole;
    } | null = null;

    if ("email" in parsed.data) {
      const normalizedEmail = parsed.data.email.trim().toLowerCase();
      const user = await prisma.staffUser.findUnique({
        where: { email: normalizedEmail },
      });
      if (
        user &&
        user.isActive &&
        verifySecret(parsed.data.password, user.passwordHash)
      ) {
        matchedUser = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as StaffRole,
        };
      }
    } else {
      const pin = parsed.data.pin.trim();
      const activeUsers = await prisma.staffUser.findMany({
        where: { isActive: true, pinHash: { not: null } },
        orderBy: { id: "asc" },
      });

      for (const user of activeUsers) {
        if (verifySecret(pin, user.pinHash)) {
          matchedUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role as StaffRole,
          };
          break;
        }
      }

      if (!matchedUser && safeEqualString(pin, getOperatorPin())) {
        matchedUser = {
          id: 0,
          name: "Operador Master",
          email: "admin@fornoemesa.com",
          role: "ADMIN",
        };
      }
    }

    if (!matchedUser) {
      return NextResponse.json(
        { error: "Credenciais ou PIN de operador incorretos." },
        { status: 401 },
      );
    }

    if (matchedUser.id > 0) {
      await prisma.staffUser
        .update({
          where: { id: matchedUser.id },
          data: { lastLoginAt: new Date() },
        })
        .catch(() => null);
    }

    await recordAuditLog({
      actorName: matchedUser.name,
      actorRole: matchedUser.role,
      action: "LOGIN_OPERADOR",
      entity: "StaffUser",
      details: `Acesso via ${"email" in parsed.data ? "e-mail/senha" : "PIN"}`,
    });

    const isHttps = request.headers.get("x-forwarded-proto") === "https";
    const signedToken = buildSignedOperatorToken({
      userId: matchedUser.id,
      name: matchedUser.name,
      email: matchedUser.email,
      role: matchedUser.role,
    });

    const res = NextResponse.json({
      ok: true,
      session: {
        userId: matchedUser.id,
        name: matchedUser.name,
        email: matchedUser.email,
        role: matchedUser.role,
      },
    });

    res.cookies.set(OPERATOR_COOKIE_NAME, signedToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    res.cookies.set(OPERATOR_LOCKED_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch {
    return NextResponse.json(
      { error: "Erro ao validar operador." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getServerOperatorSession();
  if (session) {
    await recordAuditLog({
      actorName: session.name,
      actorRole: session.role,
      action: "LOGOUT_OPERADOR",
      entity: "StaffUser",
    });
  }

  const isHttps = request.headers.get("x-forwarded-proto") === "https";
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OPERATOR_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: 0,
  });
  res.cookies.set(OPERATOR_LOCKED_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
