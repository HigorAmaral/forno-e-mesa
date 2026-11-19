import crypto from "node:crypto";
import { prisma } from "./prisma";
import { ensureSeeded } from "./seed";
import type { CreateOrderInput } from "./schemas";
import {
  calculateLoyaltyPointsEarned,
  calculateOrderTotals,
  computeIngredientDeductions,
  deriveOrderStatusFromItems,
  estimateDeliveryMinutes,
  FREE_DELIVERY_ABOVE,
  missingForMinimumOrder,
  nextDeliveryStatus,
  resolveCouponBenefit,
  resolveDeliveryFee,
  roundMoney,
  type DeliveryStatus,
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
  const deliveryZones = await prisma.deliveryZone.findMany({
    orderBy: [{ isActive: "desc" }, { fee: "asc" }],
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
  const deliveryOrders = orders.filter((o) => o.channel === "DELIVERY" || o.channel === "RETIRADA");
  const activeDeliveries = deliveryOrders.filter(
    (o) => o.deliveryStatus && !["ENTREGUE", "CANCELADO"].includes(o.deliveryStatus),
  ).length;
  const deliveryRevenue = roundMoney(
    deliveryOrders.filter((o) => o.status === "PAGO").reduce((s, o) => s + o.total, 0),
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
    deliveryZones,
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
      activeDeliveries,
      deliveryRevenue,
    },
  };
}

function generateTrackingToken(): string {
  return crypto.randomBytes(9).toString("base64url");
}

export async function createOrAppendOrder(input: CreateOrderInput, opts: { isPublic?: boolean } = {}) {
  await ensureSeeded();

  const isDeliveryChannel = input.channel === "DELIVERY" || input.channel === "RETIRADA";
  const isPickup = input.channel === "RETIRADA";

  // Public (customer-facing) orders can never set prices, discounts or payments.
  if (opts.isPublic) {
    input = {
      ...input,
      discount: 0,
      redeemLoyaltyPoints: false,
      customerId: undefined,
      payNow: false,
      applyServiceFee: false,
    };
  }

  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const dbProducts = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { recipeItems: true },
  });
  const productMap = new Map(dbProducts.map((p) => [p.id, p]));

  for (const item of input.items) {
    const p = productMap.get(item.productId);
    if (!p) {
      throw new Error(`Produto ID ${item.productId} não encontrado.`);
    }
    if (!p.isAvailable) {
      throw new Error(`${p.name} está indisponível no momento.`);
    }
  }

  let table = null;
  if (input.tableNumber && !isDeliveryChannel) {
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

  // Delivery validation (zone, address, minimum order)
  let deliveryZone: Awaited<ReturnType<typeof prisma.deliveryZone.findUnique>> = null;
  if (isDeliveryChannel) {
    if (!input.customerName?.trim() && !input.customerId) {
      throw new Error("Informe o nome do cliente para o pedido.");
    }
    if (opts.isPublic && (input.customerPhone ?? "").replace(/\D/g, "").length < 10) {
      throw new Error("Informe um telefone/WhatsApp válido com DDD.");
    }
    if (!isPickup) {
      if (!input.delivery?.zoneId) throw new Error("Selecione o bairro / região de entrega.");
      if (!input.delivery.address?.trim() || input.delivery.address.trim().length < 5) {
        throw new Error("Informe o endereço completo de entrega.");
      }
      deliveryZone = await prisma.deliveryZone.findUnique({ where: { id: input.delivery.zoneId } });
      if (!deliveryZone || !deliveryZone.isActive) {
        throw new Error("Região de entrega indisponível no momento.");
      }
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
    const shouldStartDelivered =
      input.payNow && !isDeliveryChannel && product.prepStation === "BALCAO";
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

  if (deliveryZone) {
    const itemsSubtotal = roundMoney(newOrderItems.reduce((s, i) => s + i.totalPrice, 0));
    const missing = missingForMinimumOrder(itemsSubtotal, deliveryZone.minOrder);
    if (missing > 0) {
      throw new Error(
        `Pedido mínimo para ${deliveryZone.name} é R$ ${deliveryZone.minOrder.toFixed(2)} (faltam R$ ${missing.toFixed(2)}).`,
      );
    }
  }

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

  const useServiceFee =
    !isDeliveryChannel &&
    (input.applyServiceFee ?? (input.channel === "MESA" || input.channel === "QR_MESA"));

  let linkedCustomer = input.customerId
    ? await prisma.customerProfile.findUnique({ where: { id: input.customerId } })
    : null;

  // Delivery customers are automatically linked to their loyalty profile by phone.
  if (!linkedCustomer && isDeliveryChannel && input.customerPhone?.trim()) {
    linkedCustomer = await prisma.customerProfile.findUnique({
      where: { phone: input.customerPhone.trim() },
    });
  }

  let loyaltyDiscount = 0;
  if (linkedCustomer && input.redeemLoyaltyPoints && linkedCustomer.loyaltyPoints >= 10) {
    loyaltyDiscount = 15;
    linkedCustomer = await prisma.customerProfile.update({
      where: { id: linkedCustomer.id },
      data: { loyaltyPoints: linkedCustomer.loyaltyPoints - 10 },
    });
  }

  const rawSubtotal = roundMoney(
    newOrderItems.reduce((s, i) => s + i.qty * i.unitPrice, 0),
  );
  const couponBenefit = resolveCouponBenefit({
    code: input.couponCode,
    subtotal: rawSubtotal,
  });
  const totalDiscount = (input.discount ?? 0) + loyaltyDiscount + (couponBenefit.valid ? couponBenefit.discount : 0);

  const preTotals = calculateOrderTotals({
    items: newOrderItems.map((i) => ({ qty: i.qty, unitPrice: i.unitPrice })),
    discount: totalDiscount,
  });
  const deliveryFee = deliveryZone
    ? couponBenefit.valid && couponBenefit.freeDelivery
      ? 0
      : resolveDeliveryFee({
          zoneFee: deliveryZone.fee,
          subtotal: roundMoney(preTotals.subtotal - preTotals.discount),
          freeAbove: FREE_DELIVERY_ABOVE,
        })
    : 0;

  const totals = calculateOrderTotals({
    items: newOrderItems.map((i) => ({ qty: i.qty, unitPrice: i.unitPrice })),
    discount: totalDiscount,
    applyServiceFee: useServiceFee,
    deliveryFee,
  });

  const code = await generateOrderCode();
  const isPaid = Boolean(input.payNow && input.paymentMethod);

  const deliveryData = isDeliveryChannel
    ? {
        deliveryFee: totals.deliveryFee,
        deliveryStatus: "RECEBIDO",
        deliveryZoneId: deliveryZone?.id ?? null,
        deliveryAddress: isPickup ? null : input.delivery?.address?.trim() || null,
        deliveryNeighborhood: isPickup
          ? null
          : input.delivery?.neighborhood?.trim() || deliveryZone?.name || null,
        deliveryReference: input.delivery?.reference?.trim() || null,
        changeFor:
          input.paymentMethod === "DINHEIRO" && input.delivery?.changeFor
            ? input.delivery.changeFor
            : null,
        estimatedMinutes: estimateDeliveryMinutes({
          prepMinutes: dbProducts.map((p) => p.prepTimeMinutes),
          zoneEtaMinutes: deliveryZone?.etaMinutes,
          isPickup,
        }),
        trackingToken: generateTrackingToken(),
      }
    : {};

  const created = await prisma.order.create({
    data: {
      code,
      channel: input.channel,
      status: isPaid ? "PAGO" : "ABERTO",
      tableId: table?.id ?? null,
      customerId: linkedCustomer?.id ?? null,
      customerName:
        input.customerName?.trim() ||
        linkedCustomer?.name ||
        (table ? `${table.name}${input.channel === "QR_MESA" ? " (QR)" : ""}` : "Cliente Balcão"),
      customerPhone: input.customerPhone?.trim() || linkedCustomer?.phone || null,
      // For delivery the chosen method is kept as "pay on delivery" intent even when unpaid.
      paymentMethod: isPaid || isDeliveryChannel ? (input.paymentMethod ?? null) : null,
      subtotal: totals.subtotal,
      discount: totals.discount,
      serviceFee: totals.serviceFee,
      total: totals.total,
      notes: input.notes?.trim() || null,
      paidAt: isPaid ? new Date() : null,
      items: { create: newOrderItems },
      ...deliveryData,
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

/**
 * Moves a delivery/pickup order through its lifecycle, keeping kitchen items
 * and the aggregate order status consistent.
 */
export async function updateDeliveryOrder(
  orderId: number,
  input: { deliveryStatus?: DeliveryStatus; courierName?: string; advance?: boolean },
) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw new Error("Pedido não encontrado.");
  if (order.channel !== "DELIVERY" && order.channel !== "RETIRADA") {
    throw new Error("Este pedido não é de delivery/retirada.");
  }
  const isPickup = order.channel === "RETIRADA";
  const current = (order.deliveryStatus ?? "RECEBIDO") as DeliveryStatus;
  if (current === "ENTREGUE" || current === "CANCELADO") {
    throw new Error("Pedido já finalizado.");
  }

  const target: DeliveryStatus | null = input.advance
    ? nextDeliveryStatus(current, isPickup)
    : (input.deliveryStatus ?? null);

  const courierName = input.courierName?.trim() || order.courierName || null;

  if (!target) {
    if (input.courierName !== undefined) {
      return prisma.order.update({
        where: { id: orderId },
        data: { courierName },
        include: { table: true, items: true },
      });
    }
    throw new Error("Nenhuma etapa seguinte disponível.");
  }

  if (target === "SAIU_ENTREGA" && !courierName) {
    throw new Error("Informe o entregador antes de despachar o pedido.");
  }

  const data: Record<string, unknown> = { deliveryStatus: target, courierName };

  if (target === "SAIU_ENTREGA") data.dispatchedAt = new Date();

  if (target === "PRONTO" || target === "SAIU_ENTREGA") {
    await prisma.orderItem.updateMany({
      where: { orderId, itemStatus: { in: ["PENDENTE", "PREPARANDO"] } },
      data: { itemStatus: "PRONTO" },
    });
  } else if (target === "EM_PREPARO") {
    await prisma.orderItem.updateMany({
      where: { orderId, itemStatus: "PENDENTE" },
      data: { itemStatus: "PREPARANDO" },
    });
  } else if (target === "ENTREGUE") {
    data.deliveredAt = new Date();
    await prisma.orderItem.updateMany({ where: { orderId }, data: { itemStatus: "ENTREGUE" } });
  }

  if (order.status !== "PAGO") {
    if (target === "CANCELADO") {
      data.status = "CANCELADO";
    } else {
      const items = await prisma.orderItem.findMany({ where: { orderId } });
      data.status = deriveOrderStatusFromItems(items.map((i) => i.itemStatus as ItemStatus));
    }
  }

  return prisma.order.update({
    where: { id: orderId },
    data,
    include: { table: true, items: true },
  });
}

/**
 * Keeps the delivery board in sync when the kitchen (KDS) advances items.
 * Never moves backwards and never touches dispatched/finished orders.
 */
export async function syncDeliveryFromKitchen(orderId: number) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || !order.deliveryStatus) return;
  if (!["RECEBIDO", "EM_PREPARO"].includes(order.deliveryStatus)) return;
  const kitchen = deriveOrderStatusFromItems(order.items.map((i) => i.itemStatus as ItemStatus));
  let next: DeliveryStatus | null = null;
  if (kitchen === "PRONTO" || kitchen === "ENTREGUE") next = "PRONTO";
  else if (kitchen === "EM_PREPARO" && order.deliveryStatus === "RECEBIDO") next = "EM_PREPARO";
  if (next && next !== order.deliveryStatus) {
    await prisma.order.update({ where: { id: orderId }, data: { deliveryStatus: next } });
  }
}
