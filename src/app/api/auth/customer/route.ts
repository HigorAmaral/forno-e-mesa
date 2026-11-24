import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildSignedCustomerToken,
  CUSTOMER_COOKIE_NAME,
  getServerCustomerSession,
} from "@/lib/access-guard";
import { checkRateLimit, hashSecret, verifySecret } from "@/lib/auth-crypto";
import { getLoyaltyTier } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";

function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "local";
}

const CustomerAuthSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("login"),
    phone: z.string().min(8).max(40),
    pin: z.string().min(4).max(16),
  }),
  z.object({
    action: z.literal("register"),
    name: z.string().min(2).max(120),
    phone: z.string().min(8).max(40),
    email: z.string().email().max(120).optional().or(z.literal("")),
    pin: z.string().min(4).max(16),
    defaultAddress: z.string().max(240).optional(),
    defaultNeighborhood: z.string().max(120).optional(),
    defaultReference: z.string().max(240).optional(),
  }),
]);

const UpdateCustomerProfileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().max(120).optional().or(z.literal("")),
  favoriteItem: z.string().max(120).optional(),
  defaultAddress: z.string().max(240).optional(),
  defaultNeighborhood: z.string().max(120).optional(),
  defaultReference: z.string().max(240).optional(),
});

async function findCustomerByPhone(rawPhone: string) {
  const trimmed = rawPhone.trim();
  const exact = await prisma.customerProfile.findUnique({
    where: { phone: trimmed },
  });
  if (exact) return exact;

  const digits = normalizePhoneDigits(trimmed);
  if (digits.length < 8) return null;
  const all = await prisma.customerProfile.findMany();
  return (
    all.find((c) => {
      const cDigits = normalizePhoneDigits(c.phone);
      return cDigits === digits || cDigits.endsWith(digits) || digits.endsWith(cDigits);
    }) ?? null
  );
}

function serializeCustomer(customer: {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  favoriteItem: string | null;
  loyaltyPoints: number;
  totalSpent: number;
  visitsCount: number;
  defaultAddress: string | null;
  defaultNeighborhood: string | null;
  defaultReference: string | null;
}) {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    favoriteItem: customer.favoriteItem,
    loyaltyPoints: customer.loyaltyPoints,
    loyaltyTier: getLoyaltyTier(customer.loyaltyPoints),
    totalSpent: customer.totalSpent,
    visitsCount: customer.visitsCount,
    defaultAddress: customer.defaultAddress,
    defaultNeighborhood: customer.defaultNeighborhood,
    defaultReference: customer.defaultReference,
  };
}

export async function GET() {
  try {
    await ensureSeeded();
    const session = await getServerCustomerSession();
    if (!session) {
      return NextResponse.json({ authenticated: false, customer: null, orders: [] });
    }

    const customer = await prisma.customerProfile.findUnique({
      where: { id: session.customerId },
    });
    if (!customer) {
      return NextResponse.json({ authenticated: false, customer: null, orders: [] });
    }

    const orders = await prisma.order.findMany({
      where: { customerId: customer.id },
      include: { items: true, review: true },
      orderBy: { createdAt: "desc" },
      take: 15,
    });

    return NextResponse.json({
      authenticated: true,
      customer: serializeCustomer(customer),
      orders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao carregar conta.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`customer-auth:${ip}`, 15, 5 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Muitas tentativas. Aguarde ${rl.retryAfterSec}s.` },
        { status: 429 },
      );
    }

    await ensureSeeded();
    const body = await request.json();
    const parsed = CustomerAuthSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Verifique os dados informados (PIN mínimo de 4 dígitos)." },
        { status: 400 },
      );
    }

    let customer;
    if (parsed.data.action === "login") {
      const existing = await findCustomerByPhone(parsed.data.phone);
      if (!existing) {
        return NextResponse.json(
          { error: "Telefone ou PIN não encontrados." },
          { status: 401 },
        );
      }

      if (!existing.pinHash) {
        // Legacy customer without PIN yet: allow setting PIN if matches "1234"
        if (parsed.data.pin.trim() !== "1234") {
          return NextResponse.json(
            { error: "PIN incorreto. Use 1234 para primeiro acesso." },
            { status: 401 },
          );
        }
        customer = await prisma.customerProfile.update({
          where: { id: existing.id },
          data: { pinHash: hashSecret("1234") },
        });
      } else if (!verifySecret(parsed.data.pin.trim(), existing.pinHash)) {
        return NextResponse.json(
          { error: "Telefone ou PIN incorretos." },
          { status: 401 },
        );
      } else {
        customer = existing;
      }
    } else {
      const existing = await findCustomerByPhone(parsed.data.phone);
      if (existing) {
        return NextResponse.json(
          { error: "Já existe uma conta cadastrada com este telefone. Faça login." },
          { status: 400 },
        );
      }
      customer = await prisma.customerProfile.create({
        data: {
          name: parsed.data.name.trim(),
          phone: parsed.data.phone.trim(),
          email: parsed.data.email?.trim() || null,
          pinHash: hashSecret(parsed.data.pin.trim()),
          defaultAddress: parsed.data.defaultAddress?.trim() || null,
          defaultNeighborhood: parsed.data.defaultNeighborhood?.trim() || null,
          defaultReference: parsed.data.defaultReference?.trim() || null,
        },
      });
    }

    const token = buildSignedCustomerToken({
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone,
    });
    const isHttps = request.headers.get("x-forwarded-proto") === "https";
    const res = NextResponse.json({
      ok: true,
      customer: serializeCustomer(customer),
    });
    res.cookies.set(CUSTOMER_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro na autenticação do cliente.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerCustomerSession();
    if (!session) {
      return NextResponse.json({ error: "Faça login primeiro." }, { status: 401 });
    }
    const body = await request.json();
    const parsed = UpdateCustomerProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const updated = await prisma.customerProfile.update({
      where: { id: session.customerId },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.email !== undefined
          ? { email: parsed.data.email.trim() || null }
          : {}),
        ...(parsed.data.favoriteItem !== undefined
          ? { favoriteItem: parsed.data.favoriteItem.trim() || null }
          : {}),
        ...(parsed.data.defaultAddress !== undefined
          ? { defaultAddress: parsed.data.defaultAddress.trim() || null }
          : {}),
        ...(parsed.data.defaultNeighborhood !== undefined
          ? { defaultNeighborhood: parsed.data.defaultNeighborhood.trim() || null }
          : {}),
        ...(parsed.data.defaultReference !== undefined
          ? { defaultReference: parsed.data.defaultReference.trim() || null }
          : {}),
      },
    });

    return NextResponse.json({ customer: serializeCustomer(updated) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao atualizar perfil.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const isHttps = request.headers.get("x-forwarded-proto") === "https";
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CUSTOMER_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: 0,
  });
  return res;
}
