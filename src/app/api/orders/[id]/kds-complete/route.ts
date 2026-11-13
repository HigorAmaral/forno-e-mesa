import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deriveOrderStatusFromItems, type ItemStatus } from "@/lib/domain";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "ID do pedido inválido." }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as { targetStatus?: string };
    const targetStatus: ItemStatus =
      body.targetStatus === "ENTREGUE" ? "ENTREGUE" : "PRONTO";

    const items = await prisma.orderItem.findMany({ where: { orderId } });
    if (items.length === 0) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    await prisma.orderItem.updateMany({
      where: {
        orderId,
        itemStatus: targetStatus === "PRONTO" ? { in: ["PENDENTE", "PREPARANDO"] } : { not: "ENTREGUE" },
      },
      data: { itemStatus: targetStatus },
    });

    const refreshedItems = await prisma.orderItem.findMany({ where: { orderId } });
    const nextOrderStatus = deriveOrderStatusFromItems(
      refreshedItems.map((i) => i.itemStatus as ItemStatus),
    );

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: nextOrderStatus },
      include: { items: true, table: true },
    });

    return NextResponse.json({ order: updatedOrder });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao concluir ticket no KDS.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
