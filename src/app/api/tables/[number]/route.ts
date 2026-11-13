import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import { TableActionSchema } from "@/lib/schemas";
import { isServerErpAuthorized } from "@/lib/access-guard";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ number: string }> },
) {
  try {
    await ensureSeeded();
    const { number } = await context.params;
    const tableNumber = Number(number);
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    const table = await prisma.diningTable.findUnique({
      where: { number: tableNumber },
      include: {
        orders: {
          where: { status: { notIn: ["PAGO", "CANCELADO"] } },
          include: { items: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!table) {
      return NextResponse.json({ error: "Mesa não encontrada." }, { status: 404 });
    }

    const erpAuthorized = await isServerErpAuthorized();
    const tokenValid = Boolean(token && token === table.qrToken);
    if (!erpAuthorized && !tokenValid) {
      return NextResponse.json(
        { error: "Token QR inválido para esta mesa." },
        { status: 403 },
      );
    }

    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        products: {
          where: { isAvailable: true },
          orderBy: { name: "asc" },
        },
      },
    });

    return NextResponse.json({
      table,
      tokenValid: true,
      categories,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao consultar mesa.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ number: string }> },
) {
  try {
    const { number } = await context.params;
    const tableNumber = Number(number);
    const body = await request.json();
    const parsed = TableActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Status da mesa inválido." }, { status: 400 });
    }

    const erpAuthorized = await isServerErpAuthorized();
    if (!erpAuthorized) {
      const existing = await prisma.diningTable.findUnique({
        where: { number: tableNumber },
      });
      if (
        !existing ||
        parsed.data.status !== "CONTA" ||
        !parsed.data.qrToken ||
        parsed.data.qrToken !== existing.qrToken
      ) {
        return NextResponse.json(
          { error: "Operação restrita ao painel interno." },
          { status: 403 },
        );
      }
    }

    const table = await prisma.diningTable.update({
      where: { number: tableNumber },
      data: { status: parsed.data.status },
    });
    return NextResponse.json({ table });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao atualizar mesa.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
