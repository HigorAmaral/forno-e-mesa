export type OrderStatus =
  | "ABERTO"
  | "EM_PREPARO"
  | "PRONTO"
  | "ENTREGUE"
  | "PAGO"
  | "CANCELADO";

export type ItemStatus = "PENDENTE" | "PREPARANDO" | "PRONTO" | "ENTREGUE";

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

export interface OrderLineInput {
  qty: number;
  unitPrice: number;
}

export interface OrderTotalsResult {
  subtotal: number;
  discount: number;
  serviceFee: number;
  deliveryFee: number;
  total: number;
}

/**
 * Computes subtotal, clamped discount, optional 10% service fee, optional
 * delivery fee and final total.
 */
export function calculateOrderTotals(params: {
  items: OrderLineInput[];
  discount?: number;
  applyServiceFee?: boolean;
  serviceFeeRate?: number;
  deliveryFee?: number;
}): OrderTotalsResult {
  const subtotal = roundMoney(
    params.items.reduce((acc, item) => acc + Math.max(0, item.qty) * Math.max(0, item.unitPrice), 0),
  );
  const rawDiscount = Math.max(0, params.discount ?? 0);
  const discount = roundMoney(Math.min(rawDiscount, subtotal));
  const netAfterDiscount = roundMoney(subtotal - discount);
  const rate = params.serviceFeeRate ?? 0.1;
  const serviceFee = params.applyServiceFee ? roundMoney(netAfterDiscount * rate) : 0;
  const deliveryFee = roundMoney(Math.max(0, params.deliveryFee ?? 0));
  const total = roundMoney(netAfterDiscount + serviceFee + deliveryFee);

  return { subtotal, discount, serviceFee, deliveryFee, total };
}

/* ───────────────────────────── Delivery ───────────────────────────── */

export type DeliveryStatus =
  | "RECEBIDO"
  | "EM_PREPARO"
  | "PRONTO"
  | "SAIU_ENTREGA"
  | "ENTREGUE"
  | "CANCELADO";

export const DELIVERY_FLOW: DeliveryStatus[] = [
  "RECEBIDO",
  "EM_PREPARO",
  "PRONTO",
  "SAIU_ENTREGA",
  "ENTREGUE",
];

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  RECEBIDO: "Recebido",
  EM_PREPARO: "Em preparo",
  PRONTO: "Pronto p/ envio",
  SAIU_ENTREGA: "Saiu para entrega",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

/** Pickup orders skip the courier step. */
export function getDeliveryFlow(isPickup: boolean): DeliveryStatus[] {
  return isPickup ? DELIVERY_FLOW.filter((s) => s !== "SAIU_ENTREGA") : DELIVERY_FLOW;
}

export function nextDeliveryStatus(
  current: string | null | undefined,
  isPickup = false,
): DeliveryStatus | null {
  const flow = getDeliveryFlow(isPickup);
  const idx = flow.indexOf((current ?? "RECEBIDO") as DeliveryStatus);
  if (idx < 0 || idx >= flow.length - 1) return null;
  return flow[idx + 1];
}

/** Delivery is free above the threshold; otherwise the zone fee applies. */
export function resolveDeliveryFee(params: {
  zoneFee: number;
  subtotal: number;
  freeAbove?: number | null;
}): number {
  if (params.freeAbove && params.freeAbove > 0 && params.subtotal >= params.freeAbove) {
    return 0;
  }
  return roundMoney(Math.max(0, params.zoneFee));
}

/** ETA = longest product preparation + zone travel time (pickup: prep only). */
export function estimateDeliveryMinutes(params: {
  prepMinutes: number[];
  zoneEtaMinutes?: number;
  isPickup?: boolean;
}): number {
  const prep = params.prepMinutes.length ? Math.max(...params.prepMinutes) : 10;
  const travel = params.isPickup ? 0 : Math.max(0, params.zoneEtaMinutes ?? 30);
  return Math.max(10, Math.round(prep + travel));
}

/** Returns the missing amount to reach the zone minimum order (0 when ok). */
export function missingForMinimumOrder(subtotal: number, minOrder: number): number {
  return roundMoney(Math.max(0, minOrder - subtotal));
}

/** Normalizes a Brazilian phone and builds a WhatsApp deep link. */
export function buildWhatsAppLink(phone: string | null | undefined, message: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const full = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
}

export const CHANNEL_LABELS: Record<string, string> = {
  PDV_BALCAO: "Balcão",
  MESA: "Mesa",
  QR_MESA: "QR Mesa",
  ENCOMENDA: "Encomenda",
  DELIVERY: "Delivery",
  RETIRADA: "Retirada",
};

export function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

/** Minutes elapsed since an ISO date (never negative). */
export function minutesSince(iso: string | Date, now: Date = new Date()): number {
  const t = typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();
  return Math.max(0, Math.floor((now.getTime() - t) / 60000));
}

/**
 * Derives aggregate order status from kitchen/station item statuses.
 */
export function deriveOrderStatusFromItems(statuses: ItemStatus[]): OrderStatus {
  if (statuses.length === 0) return "ABERTO";
  if (statuses.every((s) => s === "ENTREGUE")) return "ENTREGUE";
  if (statuses.every((s) => s === "PRONTO" || s === "ENTREGUE")) return "PRONTO";
  if (statuses.some((s) => s === "PREPARANDO" || s === "PRONTO" || s === "ENTREGUE")) {
    return "EM_PREPARO";
  }
  return "ABERTO";
}

/**
 * Computes remaining balance for a confectionery custom order.
 */
export function calculateCakeBalanceDue(totalPrice: number, depositPaid: number): number {
  return roundMoney(Math.max(0, totalPrice - Math.max(0, depositPaid)));
}

/**
 * Splits a bill total evenly across N people, rounding up/fairly to 2 decimals.
 */
export function splitBillAmount(total: number, peopleCount: number): number {
  const safePeople = Math.max(1, Math.floor(peopleCount));
  return roundMoney(Math.max(0, total) / safePeople);
}

/**
 * Calculates cash change due when customer pays in cash.
 */
export function calculateCashChange(total: number, amountReceived: number): number {
  return roundMoney(Math.max(0, amountReceived - Math.max(0, total)));
}

/**
 * Loyalty program: 1 point per R$ 10 spent (floored).
 */
export function calculateLoyaltyPointsEarned(paidTotal: number): number {
  if (paidTotal <= 0) return 0;
  return Math.floor(paidTotal / 10);
}

/**
 * Loyalty tier name based on accumulated points.
 */
export function getLoyaltyTier(points: number): "BRONZE" | "PRATA" | "OURO" {
  if (points >= 40) return "OURO";
  if (points >= 15) return "PRATA";
  return "BRONZE";
}

/**
 * Computes ingredient deductions given ordered items and their recipe items.
 */
export function computeIngredientDeductions(
  orderedItems: Array<{ productId: number | null; qty: number }>,
  recipes: Array<{ productId: number; ingredientId: number; qtyRequired: number }>,
): Map<number, number> {
  const deductions = new Map<number, number>();
  for (const line of orderedItems) {
    if (!line.productId || line.qty <= 0) continue;
    for (const recipe of recipes) {
      if (recipe.productId !== line.productId) continue;
      const prev = deductions.get(recipe.ingredientId) ?? 0;
      deductions.set(recipe.ingredientId, Number((prev + recipe.qtyRequired * line.qty).toFixed(4)));
    }
  }
  return deductions;
}

export function buildTableQrPath(tableNumber: number, qrToken: string): string {
  return `/mesa/${tableNumber}?token=${encodeURIComponent(qrToken)}`;
}

/**
 * Resolves the origin embedded inside a table QR Code.
 * When accessed via localhost/127.0.0.1, prefers the LAN IPv4 so phones on the
 * same Wi-Fi network can scan and open the digital menu directly.
 */
export function resolveQrOrigin(params: {
  requestOrigin: string;
  lanIp?: string | null;
  customBaseUrl?: string | null;
}): string {
  const custom = params.customBaseUrl?.trim().replace(/\/+$/, "");
  if (custom && /^https?:\/\//i.test(custom)) {
    return custom;
  }

  try {
    const parsed = new URL(params.requestOrigin);
    const isLocalhost =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1";
    if (isLocalhost && params.lanIp) {
      const portPart = parsed.port ? `:${parsed.port}` : "";
      return `${parsed.protocol}//${params.lanIp}${portPart}`;
    }
    return parsed.origin;
  } catch {
    return params.requestOrigin;
  }
}

/**
 * Returns estimated payment acquirer fee rate by payment method.
 */
export function calculateCardFeeRate(
  paymentMethod: string | null | undefined,
): number {
  if (paymentMethod === "CREDITO") return 0.032;
  if (paymentMethod === "DEBITO") return 0.016;
  return 0;
}

/**
 * Computes unit ingredient cost (CMV) for a product from its recipe items.
 */
export function calculateProductRecipeCost(
  recipeItems: Array<{ qtyRequired: number; costPerUnit: number }>,
): number {
  const total = recipeItems.reduce(
    (sum, item) =>
      sum + Math.max(0, item.qtyRequired) * Math.max(0, item.costPerUnit),
    0,
  );
  return roundMoney(total);
}

/**
 * Computes gross profit margin percentage given unit price and unit cost.
 */
export function calculateMarginPercentage(price: number, cost: number): number {
  if (price <= 0) return 0;
  return roundMoney(((price - Math.max(0, cost)) / price) * 100);
}

export interface FinancialDreSummary {
  ordersRevenue: number;
  extraRevenuePaid: number;
  cakeDepositsReceived: number;
  grossRevenue: number;
  discountsTotal: number;
  serviceFeesTotal: number;
  cardFeesEstimated: number;
  estimatedCmv: number;
  contributionMargin: number;
  operatingExpensesPaid: number;
  operatingExpensesPending: number;
  receivablesPending: number;
  netProfit: number;
  netMarginPct: number;
}

/**
 * Computes management DRE (P&L) and cashflow outlook for the operation.
 */
export function computeFinancialDre(params: {
  orders: Array<{
    status: string;
    paymentMethod: string | null;
    subtotal: number;
    discount: number;
    serviceFee: number;
    total: number;
    items: Array<{ productId: number | null; qty: number; totalPrice: number }>;
  }>;
  productCostById: Map<number, number>;
  cakeOrders: Array<{
    totalPrice: number;
    depositPaid: number;
    status: string;
  }>;
  entries: Array<{
    type: string;
    amount: number;
    status: string;
  }>;
}): FinancialDreSummary {
  const paidOrders = params.orders.filter((o) => o.status === "PAGO");
  const openOrders = params.orders.filter(
    (o) => !["PAGO", "CANCELADO"].includes(o.status),
  );

  const ordersRevenue = roundMoney(
    paidOrders.reduce((s, o) => s + o.total, 0),
  );
  const discountsTotal = roundMoney(
    paidOrders.reduce((s, o) => s + o.discount, 0),
  );
  const serviceFeesTotal = roundMoney(
    paidOrders.reduce((s, o) => s + o.serviceFee, 0),
  );
  const cardFeesEstimated = roundMoney(
    paidOrders.reduce(
      (s, o) => s + o.total * calculateCardFeeRate(o.paymentMethod),
      0,
    ),
  );

  let estimatedCmv = 0;
  for (const order of paidOrders) {
    for (const item of order.items) {
      const unitCost =
        item.productId !== null
          ? params.productCostById.get(item.productId) ?? 0
          : 0;
      if (unitCost > 0) {
        estimatedCmv += unitCost * item.qty;
      } else {
        estimatedCmv += item.totalPrice * 0.32;
      }
    }
  }
  estimatedCmv = roundMoney(estimatedCmv);

  const cakeDepositsReceived = roundMoney(
    params.cakeOrders.reduce((s, c) => s + Math.max(0, c.depositPaid), 0),
  );
  const cakePendingBalance = roundMoney(
    params.cakeOrders
      .filter((c) => c.status !== "ENTREGUE")
      .reduce(
        (s, c) => s + calculateCakeBalanceDue(c.totalPrice, c.depositPaid),
        0,
      ),
  );

  const extraRevenuePaid = roundMoney(
    params.entries
      .filter((e) => e.type === "RECEITA" && e.status === "PAGO")
      .reduce((s, e) => s + e.amount, 0),
  );
  const extraRevenuePending = roundMoney(
    params.entries
      .filter((e) => e.type === "RECEITA" && e.status !== "PAGO")
      .reduce((s, e) => s + e.amount, 0),
  );

  const operatingExpensesPaid = roundMoney(
    params.entries
      .filter((e) => e.type === "DESPESA" && e.status === "PAGO")
      .reduce((s, e) => s + e.amount, 0),
  );
  const operatingExpensesPending = roundMoney(
    params.entries
      .filter((e) => e.type === "DESPESA" && e.status !== "PAGO")
      .reduce((s, e) => s + e.amount, 0),
  );

  const openOrdersPending = roundMoney(
    openOrders.reduce((s, o) => s + o.total, 0),
  );

  const grossRevenue = roundMoney(
    ordersRevenue + extraRevenuePaid + cakeDepositsReceived,
  );
  const contributionMargin = roundMoney(
    grossRevenue - cardFeesEstimated - estimatedCmv,
  );
  const netProfit = roundMoney(contributionMargin - operatingExpensesPaid);
  const netMarginPct =
    grossRevenue > 0 ? roundMoney((netProfit / grossRevenue) * 100) : 0;
  const receivablesPending = roundMoney(
    extraRevenuePending + cakePendingBalance + openOrdersPending,
  );

  return {
    ordersRevenue,
    extraRevenuePaid,
    cakeDepositsReceived,
    grossRevenue,
    discountsTotal,
    serviceFeesTotal,
    cardFeesEstimated,
    estimatedCmv,
    contributionMargin,
    operatingExpensesPaid,
    operatingExpensesPending,
    receivablesPending,
    netProfit,
    netMarginPct,
  };
}

/** Delivery is free for orders (subtotal after discount) at or above this value. */
export const FREE_DELIVERY_ABOVE = 150;

/** Groups paid orders revenue by hour of day (0-23). */
export function computeSalesByHour(
  orders: Array<{ status: string; total: number; paidAt: string | Date | null; createdAt: string | Date }>,
): number[] {
  const buckets = Array.from({ length: 24 }, () => 0);
  for (const o of orders) {
    if (o.status !== "PAGO") continue;
    const d = new Date(o.paidAt ?? o.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    buckets[d.getHours()] = roundMoney(buckets[d.getHours()] + o.total);
  }
  return buckets;
}
