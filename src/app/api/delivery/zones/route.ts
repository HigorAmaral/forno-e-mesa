import { NextResponse } from "next/server";
import { forbiddenIfNotErpOperator, isServerErpAuthorized } from "@/lib/access-guard";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import { DeliveryZoneSchema, UpdateDeliveryZoneSchema } from "@/lib/schemas";

/** Public: active zones (operators also receive inactive ones). */
export async function GET() {
  await ensureSeeded();
  const isOperator = await isServerErpAuthorized();
  const zones = await prisma.deliveryZone.findMany({
    where: isOperator ? {} : { isActive: true },
    orderBy: [{ isActive: "desc" }, { fee: "asc" }],
  });
  return NextResponse.json({ zones });
}

export async function POST(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator();
  if (forbidden) return forbidden;
  const parsed = DeliveryZoneSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados da região inválidos." }, { status: 400 });
  }
  try {
    const zone = await prisma.deliveryZone.create({ data: parsed.data });
    return NextResponse.json({ zone }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Já existe uma região com esse nome." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator();
  if (forbidden) return forbidden;
  const parsed = UpdateDeliveryZoneSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados da região inválidos." }, { status: 400 });
  }
  const { id, ...data } = parsed.data;
  try {
    const zone = await prisma.deliveryZone.update({ where: { id }, data });
    return NextResponse.json({ zone });
  } catch {
    return NextResponse.json({ error: "Região não encontrada." }, { status: 404 });
  }
}

export async function DELETE(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator();
  if (forbidden) return forbidden;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }
  try {
    await prisma.deliveryZone.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Região não encontrada." }, { status: 404 });
  }
}
