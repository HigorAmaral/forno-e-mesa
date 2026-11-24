import { NextResponse } from "next/server";
import { forbiddenIfNotErpOperator } from "@/lib/access-guard";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import {
  CreateFinancialEntrySchema,
  UpdateFinancialEntrySchema,
} from "@/lib/schemas";

export async function GET() {
  const forbidden = await forbiddenIfNotErpOperator(["ADMIN", "GERENTE"]);
  if (forbidden) return forbidden;
  try {
    await ensureSeeded();
    const entries = await prisma.financialEntry.findMany({
      orderBy: [{ dueDate: "asc" }, { id: "desc" }],
      take: 100,
    });
    const cashSessions = await prisma.cashRegisterSession.findMany({
      orderBy: { openedAt: "desc" },
      take: 10,
      include: { movements: { orderBy: { createdAt: "desc" }, take: 20 } },
    });
    return NextResponse.json({ entries, cashSessions });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro ao carregar financeiro.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator(["ADMIN", "GERENTE"]);
  if (forbidden) return forbidden;
  try {
    const body = await request.json();
    const parsed = CreateFinancialEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados do lançamento financeiro inválidos." },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const entry = await prisma.financialEntry.create({
      data: {
        type: data.type,
        category: data.category,
        description: data.description.trim(),
        counterparty: data.counterparty?.trim() || null,
        amount: data.amount,
        dueDate: data.dueDate,
        status: data.status,
        paymentMethod: data.paymentMethod ?? null,
        paidAt: data.status === "PAGO" ? new Date() : null,
        notes: data.notes?.trim() || null,
      },
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro ao criar lançamento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator(["ADMIN", "GERENTE"]);
  if (forbidden) return forbidden;
  try {
    const body = await request.json();
    const parsed = UpdateFinancialEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Atualização financeira inválida." },
        { status: 400 },
      );
    }

    const entry = await prisma.financialEntry.update({
      where: { id: parsed.data.id },
      data: {
        status: parsed.data.status,
        paymentMethod: parsed.data.paymentMethod,
        paidAt: parsed.data.status === "PAGO" ? new Date() : null,
      },
    });

    return NextResponse.json({ entry });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro ao atualizar lançamento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator(["ADMIN", "GERENTE"]);
  if (forbidden) return forbidden;
  try {
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "ID financeiro inválido." },
        { status: 400 },
      );
    }

    await prisma.financialEntry.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro ao remover lançamento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
