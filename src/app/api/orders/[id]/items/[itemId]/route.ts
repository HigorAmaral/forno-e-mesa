import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateOrderItemStatusSchema } from "@/lib/schemas";
import { deriveOrderStatusFromItems, type ItemStatus } from "@/lib/domain";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const { id, itemId } = await context.params;
    const orderId = Number(id);
    const parsedItemId = Number(itemId);

    const body = await request.json();
    const parsed = UpdateOrderItemStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }

    const item = await prisma.orderItem.findFirst({
      where: { id: parsedItemId, orderId },
    });
    if (!item) {
      return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
    }

    await prisma.orderItem.update({
      where: { id: parsedItemId },
      data: { itemStatus: parsed.data.itemStatus },
    });

    const siblingItems = await prisma.orderItem.findMany({ where: { orderId } });
    const orderStatus = deriveOrderStatusFromItems(
      siblingItems.map((i) => i.itemStatus as ItemStatus),
    );

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: orderStatus },
      include: { items: true, table: true },
    });

    return NextResponse.json({ order: updatedOrder });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao atualizar item.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
