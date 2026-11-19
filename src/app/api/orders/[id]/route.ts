import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderManageSchema } from "@/lib/schemas";
import { forbiddenIfNotErpOperator } from "@/lib/access-guard";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const forbidden = await forbiddenIfNotErpOperator();
    if (forbidden) return forbidden;
    const { id } = await context.params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "ID do pedido inválido." }, { status: 400 });
    }

    const body = await request.json();
    const parsed = OrderManageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    if (order.status === "PAGO" || order.status === "CANCELADO") {
      return NextResponse.json(
        { error: "Não é possível alterar um pedido já pago ou cancelado." },
        { status: 400 },
      );
    }

    if (parsed.data.action === "CANCEL") {
      const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: "CANCELADO",
          ...(order.deliveryStatus ? { deliveryStatus: "CANCELADO" } : {}),
        },
        include: { table: true, items: true },
      });

      if (order.tableId) {
        const remaining = await prisma.order.count({
          where: {
            tableId: order.tableId,
            status: { notIn: ["PAGO", "CANCELADO"] },
          },
        });
        if (remaining === 0) {
          await prisma.diningTable.update({
            where: { id: order.tableId },
            data: { status: "LIVRE" },
          });
        }
      }
      return NextResponse.json({ order: updated });
    }

    if (parsed.data.action === "TRANSFER") {
      if (!parsed.data.targetTableNumber) {
        return NextResponse.json(
          { error: "Informe a mesa de destino." },
          { status: 400 },
        );
      }

      const targetTable = await prisma.diningTable.findUnique({
        where: { number: parsed.data.targetTableNumber },
      });
      if (!targetTable) {
        return NextResponse.json({ error: "Mesa de destino não encontrada." }, { status: 404 });
      }
      if (targetTable.id === order.tableId) {
        return NextResponse.json({ error: "O pedido já está nesta mesa." }, { status: 400 });
      }

      const conflict = await prisma.order.findFirst({
        where: {
          tableId: targetTable.id,
          status: { notIn: ["PAGO", "CANCELADO"] },
        },
      });
      if (conflict) {
        return NextResponse.json(
          { error: `${targetTable.name} já possui a comanda aberta ${conflict.code}.` },
          { status: 400 },
        );
      }

      const previousTableId = order.tableId;
      const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
          tableId: targetTable.id,
          channel: "MESA",
          customerName: `${targetTable.name}`,
        },
        include: { table: true, items: true },
      });

      await prisma.diningTable.update({
        where: { id: targetTable.id },
        data: { status: "OCUPADA" },
      });

      if (previousTableId) {
        await prisma.diningTable.update({
          where: { id: previousTableId },
          data: { status: "LIVRE" },
        });
      }

      return NextResponse.json({ order: updated });
    }

    return NextResponse.json({ error: "Ação não suportada." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao atualizar pedido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
