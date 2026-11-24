import { NextResponse } from "next/server";
import { forbiddenIfNotErpOperator } from "@/lib/access-guard";
import { prisma } from "@/lib/prisma";
import { CreateReservationSchema, UpdateReservationSchema } from "@/lib/schemas";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  const forbidden = await forbiddenIfNotErpOperator();
  if (forbidden) return forbidden;

  await ensureSeeded();
  const reservations = await prisma.tableReservation.findMany({
    include: { table: true },
    orderBy: [{ reservedFor: "asc" }, { id: "desc" }],
    take: 50,
  });
  return NextResponse.json({ reservations });
}

export async function POST(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator([
    "ADMIN",
    "GERENTE",
    "CAIXA",
    "GARCOM",
  ]);
  if (forbidden) return forbidden;

  try {
    await ensureSeeded();
    const parsed = CreateReservationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados da reserva inválidos." }, { status: 400 });
    }

    const reservation = await prisma.tableReservation.create({
      data: {
        tableId: parsed.data.tableId ?? null,
        customerName: parsed.data.customerName.trim(),
        customerPhone: parsed.data.customerPhone.trim(),
        partySize: parsed.data.partySize,
        reservedFor: parsed.data.reservedFor.trim(),
        notes: parsed.data.notes?.trim() || null,
        status: "CONFIRMADA",
      },
      include: { table: true },
    });

    if (parsed.data.tableId) {
      const table = await prisma.diningTable.findUnique({
        where: { id: parsed.data.tableId },
      });
      if (table && table.status === "LIVRE") {
        await prisma.diningTable.update({
          where: { id: table.id },
          data: { status: "RESERVADA" },
        });
      }
    }

    return NextResponse.json({ reservation }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao criar reserva.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator([
    "ADMIN",
    "GERENTE",
    "CAIXA",
    "GARCOM",
  ]);
  if (forbidden) return forbidden;

  try {
    const parsed = UpdateReservationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Atualização de reserva inválida." }, { status: 400 });
    }

    const existing = await prisma.tableReservation.findUnique({
      where: { id: parsed.data.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });
    }

    const updated = await prisma.tableReservation.update({
      where: { id: parsed.data.id },
      data: {
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.tableId !== undefined
          ? { tableId: parsed.data.tableId }
          : {}),
      },
      include: { table: true },
    });

    if (updated.tableId && parsed.data.status === "SENTADA") {
      await prisma.diningTable.update({
        where: { id: updated.tableId },
        data: { status: "OCUPADA" },
      });
    } else if (
      updated.tableId &&
      (parsed.data.status === "CANCELADA" || parsed.data.status === "CONCLUIDA")
    ) {
      const tbl = await prisma.diningTable.findUnique({
        where: { id: updated.tableId },
        include: {
          orders: { where: { status: { notIn: ["PAGO", "CANCELADO"] } } },
        },
      });
      if (tbl && tbl.orders.length === 0 && tbl.status === "RESERVADA") {
        await prisma.diningTable.update({
          where: { id: tbl.id },
          data: { status: "LIVRE" },
        });
      }
    }

    return NextResponse.json({ reservation: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao atualizar reserva.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator(["ADMIN", "GERENTE", "CAIXA"]);
  if (forbidden) return forbidden;

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }
  try {
    await prisma.tableReservation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });
  }
}
