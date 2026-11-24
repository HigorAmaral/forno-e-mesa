import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CheckoutOrderSchema } from "@/lib/schemas";
import {
  calculateLoyaltyPointsEarned,
  calculateOrderTotals,
  roundMoney,
  validateSplitPayments,
} from "@/lib/domain";
import { registerCashSale } from "@/lib/workspace-service";
import {
  forbiddenIfNotErpOperator,
  getServerOperatorSession,
  recordAuditLog,
} from "@/lib/access-guard";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const forbidden = await forbiddenIfNotErpOperator([
      "ADMIN",
      "GERENTE",
      "CAIXA",
      "GARCOM",
    ]);
    if (forbidden) return forbidden;

    const session = await getServerOperatorSession();
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
    if (order.status === "CANCELADO") {
      return NextResponse.json({ error: "Pedido cancelado não pode ser cobrado." }, { status: 400 });
    }

    const storeSettings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
    const serviceFeeRate = (storeSettings?.defaultServiceFeePct ?? 10) / 100;

    const isDeliveryChannel = order.channel === "DELIVERY" || order.channel === "RETIRADA";
    const totals = calculateOrderTotals({
      items: order.items.map((i) => ({ qty: i.qty, unitPrice: i.unitPrice })),
      discount: parsed.data.discount ?? order.discount,
      applyServiceFee:
        !isDeliveryChannel &&
        (parsed.data.applyServiceFee ??
          (order.channel === "MESA" || order.channel === "QR_MESA")),
      serviceFeeRate,
      deliveryFee: order.deliveryFee,
    });

    const splitParts = parsed.data.splitPayments?.length
      ? parsed.data.splitPayments
      : null;

    if (splitParts) {
      const check = validateSplitPayments(totals.total, splitParts);
      if (!check.valid) {
        return NextResponse.json(
          { error: check.error ?? "Pagamento dividido não fecha com o total." },
          { status: 400 },
        );
      }
    } else if (parsed.data.paymentMethod === "MISTO") {
      return NextResponse.json(
        { error: "Informe as parcelas para pagamento misto." },
        { status: 400 },
      );
    }

    const effectiveMethod = splitParts
      ? splitParts.length === 1
        ? splitParts[0].method
        : "MISTO"
      : parsed.data.paymentMethod;

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "PAGO",
        paymentMethod: effectiveMethod,
        splitPayments: splitParts ? JSON.stringify(splitParts) : null,
        subtotal: totals.subtotal,
        discount: totals.discount,
        serviceFee: totals.serviceFee,
        total: totals.total,
        paidAt: new Date(),
        operatorName: session?.name ?? order.operatorName,
      },
      include: { items: true, table: true },
    });

    const deliveryStillRunning =
      isDeliveryChannel &&
      order.deliveryStatus !== "ENTREGUE" &&
      order.deliveryStatus !== "CANCELADO";
    if (!deliveryStillRunning) {
      await prisma.orderItem.updateMany({
        where: { orderId },
        data: { itemStatus: "ENTREGUE" },
      });
    }

    if (order.tableId) {
      await prisma.diningTable.update({
        where: { id: order.tableId },
        data: { status: "LIVRE", waiterCalledAt: null },
      });
    }

    if (splitParts) {
      for (const part of splitParts) {
        await registerCashSale(updated.code, part.amount, part.method);
      }
    } else if (parsed.data.paymentMethod !== "MISTO") {
      await registerCashSale(updated.code, updated.total, parsed.data.paymentMethod);
    }

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

    await recordAuditLog({
      actorName: session?.name ?? "Operador",
      actorRole: session?.role ?? "ADMIN",
      action: "FECHAR_CONTA",
      entity: "Order",
      details: `${updated.code} · R$ ${updated.total.toFixed(2)} (${effectiveMethod})`,
    });

    return NextResponse.json({ order: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao finalizar pagamento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
