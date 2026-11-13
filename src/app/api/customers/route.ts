import { NextResponse } from "next/server";
import { forbiddenIfNotErpOperator } from "@/lib/access-guard";
import { prisma } from "@/lib/prisma";
import { CreateCustomerSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator();
  if (forbidden) return forbidden;
  try {
    const body = await request.json();
    const parsed = CreateCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados do cliente inválidos." }, { status: 400 });
    }

    const customer = await prisma.customerProfile.create({
      data: {
        name: parsed.data.name.trim(),
        phone: parsed.data.phone.trim(),
        email: parsed.data.email?.trim() || null,
        favoriteItem: parsed.data.favoriteItem?.trim() || null,
        notes: parsed.data.notes?.trim() || null,
      },
    });
    return NextResponse.json({ customer }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao cadastrar cliente.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator();
  if (forbidden) return forbidden;
  try {
    const body = (await request.json()) as { id?: number; pointsDelta?: number };
    if (!body.id || !Number.isInteger(body.id) || typeof body.pointsDelta !== "number") {
      return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
    }

    const existing = await prisma.customerProfile.findUnique({ where: { id: body.id } });
    if (!existing) {
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    }

    const updated = await prisma.customerProfile.update({
      where: { id: body.id },
      data: { loyaltyPoints: Math.max(0, existing.loyaltyPoints + body.pointsDelta) },
    });
    return NextResponse.json({ customer: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao atualizar pontos.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
