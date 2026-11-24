import { NextResponse } from "next/server";
import {
  forbiddenIfNotErpOperator,
  getServerOperatorSession,
  isServerErpAuthorized,
  recordAuditLog,
} from "@/lib/access-guard";
import { resolveCouponBenefit, resolveDynamicCouponBenefit } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { PromoCouponSchema, UpdatePromoCouponSchema } from "@/lib/schemas";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureSeeded();
  const url = new URL(request.url);
  const codeParam = url.searchParams.get("code")?.trim().toUpperCase();
  const subtotalParam = Number(url.searchParams.get("subtotal") ?? "0");

  if (codeParam) {
    const dbCoupon = await prisma.promoCoupon.findUnique({
      where: { code: codeParam },
    });
    const result = dbCoupon
      ? resolveDynamicCouponBenefit(dbCoupon, subtotalParam)
      : resolveCouponBenefit({ code: codeParam, subtotal: subtotalParam });
    return NextResponse.json(result, { status: result.valid ? 200 : 400 });
  }

  const isOperator = await isServerErpAuthorized();
  const coupons = await prisma.promoCoupon.findMany({
    where: isOperator ? {} : { isActive: true },
    orderBy: [{ isActive: "desc" }, { code: "asc" }],
  });
  return NextResponse.json({ coupons });
}

export async function POST(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator(["ADMIN", "GERENTE"]);
  if (forbidden) return forbidden;

  try {
    await ensureSeeded();
    const session = await getServerOperatorSession();
    const parsed = PromoCouponSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados do cupom inválidos." }, { status: 400 });
    }

    const code = parsed.data.code.trim().toUpperCase();
    const coupon = await prisma.promoCoupon.create({
      data: {
        code,
        label: parsed.data.label.trim(),
        type: parsed.data.type,
        value: parsed.data.value,
        maxDiscount: parsed.data.maxDiscount ?? null,
        minOrder: parsed.data.minOrder,
        isActive: true,
      },
    });

    await recordAuditLog({
      actorName: session?.name ?? "Admin",
      actorRole: session?.role ?? "ADMIN",
      action: "CRIAR_CUPOM",
      entity: "PromoCoupon",
      details: `${coupon.code} (${coupon.label})`,
    });

    return NextResponse.json({ coupon }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Já existe um cupom com este código." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator(["ADMIN", "GERENTE"]);
  if (forbidden) return forbidden;

  try {
    const parsed = UpdatePromoCouponSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Atualização de cupom inválida." }, { status: 400 });
    }
    const { id, ...data } = parsed.data;
    const coupon = await prisma.promoCoupon.update({
      where: { id },
      data,
    });
    return NextResponse.json({ coupon });
  } catch {
    return NextResponse.json({ error: "Cupom não encontrado." }, { status: 404 });
  }
}

export async function DELETE(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator(["ADMIN", "GERENTE"]);
  if (forbidden) return forbidden;

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }
  try {
    await prisma.promoCoupon.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Cupom não encontrado." }, { status: 404 });
  }
}
