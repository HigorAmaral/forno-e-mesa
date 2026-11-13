import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CheckoutOrderSchema } from "@/lib/schemas";
import { calculateLoyaltyPointsEarned, calculateOrderTotals, roundMoney } from "@/lib/domain";
import { registerCashSale } from "@/lib/workspace-service";

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

    const body = await request.json();
    const parsed = CheckoutOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados de pagamento inválidos." }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }
    if (order.status === "PAGO") {
      return NextResponse.json({ error: "Pedido já foi pago." }, { status: 400 });
    }

    const totals = calculateOrderTotals({
      items: order.items.map((i) => ({ qty: i.qty, unitPrice: i.unitPrice })),
      discount: parsed.data.discount ?? order.discount,
      applyServiceFee:
        parsed.data.applyServiceFee ??
        (order.channel === "MESA" || order.channel === "QR_MESA"),
    });

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "PAGO",
        paymentMethod: parsed.data.paymentMethod,
        subtotal: totals.subtotal,
        discount: totals.discount,
        serviceFee: totals.serviceFee,
        total: totals.total,
        paidAt: new Date(),
      },
      include: { items: true, table: true },
    });

    await prisma.orderItem.updateMany({
      where: { orderId },
      data: { itemStatus: "ENTREGUE" },
    });

    if (order.tableId) {
      await prisma.diningTable.update({
        where: { id: order.tableId },
        data: { status: "LIVRE" },
      });
    }

    await registerCashSale(updated.code, updated.total, parsed.data.paymentMethod);

    if (updated.customerId) {
      const customer = await prisma.customerProfile.findUnique({
        where: { id: updated.customerId },
      });
      if (customer) {
        const earned = calculateLoyaltyPointsEarned(updated.total);
        await prisma.customerProfile.update({
          where: { id: customer.id },
          data: {
            loyaltyPoints: customer.loyaltyPoints + earned,
            totalSpent: roundMoney(customer.totalSpent + updated.total),
            visitsCount: customer.visitsCount + 1,
          },
        });
      }
    }

    return NextResponse.json({ order: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao finalizar pagamento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
