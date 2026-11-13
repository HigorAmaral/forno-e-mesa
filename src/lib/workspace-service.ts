import { prisma } from "./prisma";
import { ensureSeeded } from "./seed";
import {
  calculateLoyaltyPointsEarned,
  calculateOrderTotals,
  computeIngredientDeductions,
  deriveOrderStatusFromItems,
  roundMoney,
  type ItemStatus,
} from "./domain";

export async function generateOrderCode(): Promise<string> {
  const count = await prisma.order.count();
  return `PED-${String(count + 1).padStart(4, "0")}`;
}

export async function generateCakeCode(): Promise<string> {
  const count = await prisma.cakeCustomOrder.count();
  return `ENC-${String(count + 1).padStart(4, "0")}`;
}

export async function getWorkspaceSnapshot() {
  await ensureSeeded();

  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  const products = await prisma.product.findMany({
    include: {
      category: true,
      recipeItems: { include: { ingredient: true } },
    },
    orderBy: [{ categoryId: "asc" }, { name: "asc" }],
  });
  const ingredients = await prisma.ingredient.findMany({ orderBy: { name: "asc" } });
  const tables = await prisma.diningTable.findMany({
    orderBy: { number: "asc" },
    include: {
      orders: {
        where: { status: { notIn: ["PAGO", "CANCELADO"] } },
        include: { items: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  const orders = await prisma.order.findMany({
    include: {
      table: true,
      items: true,
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const batches = await prisma.bakeryBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const cakeOrders = await prisma.cakeCustomOrder.findMany({
    orderBy: [{ deliveryDate: "asc" }, { createdAt: "desc" }],
  });
  const openCashSession = await prisma.cashRegisterSession.findFirst({
    where: { status: "ABERTO" },
    include: {
      movements: { orderBy: { createdAt: "desc" }, take: 40 },
    },
    orderBy: { openedAt: "desc" },
  });
  const customers = await prisma.customerProfile.findMany({
    orderBy: { totalSpent: "desc" },
  });
  const shiftNotes = await prisma.shiftNote.findMany({
    orderBy: [{ isDone: "asc" }, { createdAt: "desc" }],
    take: 25,
  });
  const cashSessions = await prisma.cashRegisterSession.findMany({
    orderBy: { openedAt: "desc" },
    take: 10,
    include: {
      movements: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  const financialEntries = await prisma.financialEntry.findMany({
    orderBy: [{ dueDate: "asc" }, { id: "desc" }],
    take: 100,
  });

  const paidOrders = orders.filter((o) => o.status === "PAGO");
  const activeOrders = orders.filter((o) => !["PAGO", "CANCELADO"].includes(o.status));
  const revenueToday = roundMoney(paidOrders.reduce((acc, o) => acc + o.total, 0));
  const avgTicket = paidOrders.length > 0 ? roundMoney(revenueToday / paidOrders.length) : 0;
  const occupiedTables = tables.filter((t) => t.status === "OCUPADA" || t.status === "CONTA").length;
  const lowIngredients = ingredients.filter((i) => i.currentQty <= i.minQty);
  const lowProducts = products.filter((p) => p.trackStock && p.stockQty <= p.minStockQty);
  const activeCakeOrders = cakeOrders.filter((c) => c.status !== "ENTREGUE").length;
  const kdsPendingCount = activeOrders.reduce(
    (sum, o) => sum + o.items.filter((i) => i.itemStatus !== "ENTREGUE").length,
    0,
  );

  return {
    categories,
    products,
    ingredients,
    tables,
    orders,
    batches,
    cakeOrders,
    openCashSession,
    cashSessions,
    customers,
    shiftNotes,
    financialEntries,
    metrics: {
      revenueToday,
      paidCount: paidOrders.length,
      avgTicket,
      activeOrdersCount: activeOrders.length,
      occupiedTables,
      totalTables: tables.length,
      lowStockAlerts: lowIngredients.length + lowProducts.length,
      activeCakeOrders,
      kdsPendingCount,
    },
  };
}

export async function createOrAppendOrder(input: {
  channel: "PDV_BALCAO" | "MESA" | "QR_MESA" | "ENCOMENDA";
  tableNumber?: number;
  qrToken?: string;
  customerId?: number;
  customerName?: string;
  customerPhone?: string;
  redeemLoyaltyPoints?: boolean;
  discount?: number;
  applyServiceFee?: boolean;
  notes?: string;
  payNow?: boolean;
  paymentMethod?: "DINHEIRO" | "PIX" | "CREDITO" | "DEBITO";
  items: Array<{ productId: number; qty: number; notes?: string }>;
}) {
  await ensureSeeded();

  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const dbProducts = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { recipeItems: true },
  });
  const productMap = new Map(dbProducts.map((p) => [p.id, p]));

  for (const item of input.items) {
    if (!productMap.has(item.productId)) {
      throw new Error(`Produto ID ${item.productId} não encontrado.`);
    }
  }

  let table = null;
  if (input.tableNumber) {
    table = await prisma.diningTable.findUnique({ where: { number: input.tableNumber } });
    if (!table) {
      throw new Error(`Mesa ${input.tableNumber} não encontrada.`);
    }
    if (
      input.channel === "QR_MESA" &&
      (!input.qrToken || table.qrToken !== input.qrToken)
    ) {
      throw new Error("Token QR da mesa inválido.");
    }
  }

  // If table already has an active open order, append items to it instead of duplicating commands
  const existingTableOrder = table
    ? await prisma.order.findFirst({
        where: { tableId: table.id, status: { notIn: ["PAGO", "CANCELADO"] } },
        include: { items: true },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const newOrderItems = input.items.map((line) => {
    const product = productMap.get(line.productId)!;
    const totalPrice = roundMoney(product.price * line.qty);
    const shouldStartDelivered = input.payNow && product.prepStation === "BALCAO";
    return {
      productId: product.id,
      productName: product.name,
      prepStation: product.prepStation,
      qty: line.qty,
      unitPrice: product.price,
      totalPrice,
      itemStatus: shouldStartDelivered ? "ENTREGUE" : "PENDENTE",
      notes: line.notes?.trim() || null,
    };
  });

  // Deduct product stock and ingredient stock from recipes
  const recipeRows = dbProducts.flatMap((p) => p.recipeItems);
  const ingredientDeductions = computeIngredientDeductions(
    input.items.map((i) => ({ productId: i.productId, qty: i.qty })),
    recipeRows,
  );

  for (const line of input.items) {
    const product = productMap.get(line.productId)!;
    if (product.trackStock) {
      await prisma.product.update({
        where: { id: product.id },
        data: { stockQty: Math.max(0, roundMoney(product.stockQty - line.qty)) },
      });
    }
  }

  for (const [ingredientId, usedQty] of ingredientDeductions.entries()) {
    const ing = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
    if (ing) {
      await prisma.ingredient.update({
        where: { id: ingredientId },
        data: { currentQty: Math.max(0, Number((ing.currentQty - usedQty).toFixed(3))) },
      });
    }
  }

  if (existingTableOrder) {
    await prisma.orderItem.createMany({
      data: newOrderItems.map((it) => ({ ...it, orderId: existingTableOrder.id })),
    });

    const allItems = await prisma.orderItem.findMany({ where: { orderId: existingTableOrder.id } });
    const totals = calculateOrderTotals({
      items: allItems.map((i) => ({ qty: i.qty, unitPrice: i.unitPrice })),
      discount: existingTableOrder.discount,
      applyServiceFee: true,
    });
    const nextStatus = deriveOrderStatusFromItems(allItems.map((i) => i.itemStatus as ItemStatus));

    const updated = await prisma.order.update({
      where: { id: existingTableOrder.id },
      data: {
        subtotal: totals.subtotal,
        discount: totals.discount,
        serviceFee: totals.serviceFee,
        total: totals.total,
        status: nextStatus,
        notes: input.notes
          ? [existingTableOrder.notes, input.notes].filter(Boolean).join(" | ")
          : existingTableOrder.notes,
      },
      include: { table: true, items: true },
    });

    if (table && table.status === "LIVRE") {
      await prisma.diningTable.update({ where: { id: table.id }, data: { status: "OCUPADA" } });
    }
    return updated;
  }

  const useServiceFee = input.applyServiceFee ?? (input.channel === "MESA" || input.channel === "QR_MESA");

  let linkedCustomer = input.customerId
    ? await prisma.customerProfile.findUnique({ where: { id: input.customerId } })
    : null;

  let loyaltyDiscount = 0;
  if (linkedCustomer && input.redeemLoyaltyPoints && linkedCustomer.loyaltyPoints >= 10) {
    loyaltyDiscount = 15;
    linkedCustomer = await prisma.customerProfile.update({
      where: { id: linkedCustomer.id },
      data: { loyaltyPoints: linkedCustomer.loyaltyPoints - 10 },
    });
  }

  const totals = calculateOrderTotals({
    items: newOrderItems.map((i) => ({ qty: i.qty, unitPrice: i.unitPrice })),
    discount: (input.discount ?? 0) + loyaltyDiscount,
    applyServiceFee: useServiceFee,
  });

  const code = await generateOrderCode();
  const isPaid = Boolean(input.payNow && input.paymentMethod);

  const created = await prisma.order.create({
    data: {
      code,
      channel: input.channel,
      status: isPaid ? "PAGO" : "ABERTO",
      tableId: table?.id ?? null,
      customerId: linkedCustomer?.id ?? null,
      customerName:
        linkedCustomer?.name ||
        input.customerName?.trim() ||
        (table ? `${table.name}${input.channel === "QR_MESA" ? " (QR)" : ""}` : "Cliente Balcão"),
      customerPhone: linkedCustomer?.phone || input.customerPhone?.trim() || null,
      paymentMethod: isPaid ? input.paymentMethod : null,
      subtotal: totals.subtotal,
      discount: totals.discount,
      serviceFee: totals.serviceFee,
      total: totals.total,
      notes: input.notes?.trim() || null,
      paidAt: isPaid ? new Date() : null,
      items: { create: newOrderItems },
    },
    include: { table: true, items: true },
  });

  if (table) {
    await prisma.diningTable.update({
      where: { id: table.id },
      data: { status: isPaid ? "LIVRE" : "OCUPADA" },
    });
  }

  if (isPaid && input.paymentMethod) {
    await registerCashSale(created.code, created.total, input.paymentMethod);
    if (linkedCustomer) {
      const earned = calculateLoyaltyPointsEarned(created.total);
      await prisma.customerProfile.update({
        where: { id: linkedCustomer.id },
        data: {
          loyaltyPoints: linkedCustomer.loyaltyPoints + earned,
          totalSpent: roundMoney(linkedCustomer.totalSpent + created.total),
          visitsCount: linkedCustomer.visitsCount + 1,
        },
      });
    }
  }

  return created;
}

export async function registerCashSale(
  orderCode: string,
  amount: number,
  paymentMethod: "DINHEIRO" | "PIX" | "CREDITO" | "DEBITO",
) {
  const openSession = await prisma.cashRegisterSession.findFirst({
    where: { status: "ABERTO" },
    orderBy: { openedAt: "desc" },
  });
  if (!openSession) return;

  await prisma.cashMovement.create({
    data: {
      sessionId: openSession.id,
      type: "VENDA",
      paymentMethod,
      amount,
      description: `Recebimento ${orderCode} (${paymentMethod})`,
    },
  });

  if (paymentMethod === "DINHEIRO") {
    await prisma.cashRegisterSession.update({
      where: { id: openSession.id },
      data: { expectedAmount: roundMoney(openSession.expectedAmount + amount) },
    });
  }
}
