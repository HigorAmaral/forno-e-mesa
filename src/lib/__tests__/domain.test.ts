import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTableQrPath,
  calculateCakeBalanceDue,
  calculateCardFeeRate,
  calculateCashChange,
  calculateLoyaltyPointsEarned,
  calculateMarginPercentage,
  calculateOrderTotals,
  calculateProductRecipeCost,
  computeFinancialDre,
  computeIngredientDeductions,
  deriveOrderStatusFromItems,
  getLoyaltyTier,
  resolveQrOrigin,
  splitBillAmount,
} from "../domain.ts";
import {
  buildOperatorToken,
  extractHostname,
  isErpAllowedContext,
} from "../access-policy.ts";

test("calculateOrderTotals aplica desconto limitado e taxa de servico de 10%", () => {
  const res = calculateOrderTotals({
    items: [
      { qty: 2, unitPrice: 45 },
      { qty: 1, unitPrice: 30 },
    ],
    discount: 20,
    applyServiceFee: true,
  });

  assert.equal(res.subtotal, 120);
  assert.equal(res.discount, 20);
  assert.equal(res.serviceFee, 10);
  assert.equal(res.total, 110);
});

test("calculateOrderTotals impede desconto maior que o subtotal", () => {
  const res = calculateOrderTotals({
    items: [{ qty: 1, unitPrice: 25 }],
    discount: 999,
    applyServiceFee: true,
  });

  assert.equal(res.subtotal, 25);
  assert.equal(res.discount, 25);
  assert.equal(res.serviceFee, 0);
  assert.equal(res.total, 0);
});

test("deriveOrderStatusFromItems reflete andamento real do KDS", () => {
  assert.equal(deriveOrderStatusFromItems(["PENDENTE", "PENDENTE"]), "ABERTO");
  assert.equal(deriveOrderStatusFromItems(["PENDENTE", "PREPARANDO"]), "EM_PREPARO");
  assert.equal(deriveOrderStatusFromItems(["PRONTO", "PRONTO"]), "PRONTO");
  assert.equal(deriveOrderStatusFromItems(["PRONTO", "ENTREGUE"]), "PRONTO");
  assert.equal(deriveOrderStatusFromItems(["ENTREGUE", "ENTREGUE"]), "ENTREGUE");
});

test("computeIngredientDeductions soma insumos das receitas por quantidade vendida", () => {
  const map = computeIngredientDeductions(
    [
      { productId: 1, qty: 3 },
      { productId: 2, qty: 2 },
    ],
    [
      { productId: 1, ingredientId: 10, qtyRequired: 0.25 },
      { productId: 2, ingredientId: 10, qtyRequired: 0.1 },
      { productId: 2, ingredientId: 11, qtyRequired: 0.5 },
    ],
  );

  assert.equal(map.get(10), 0.95);
  assert.equal(map.get(11), 1);
});

test("calculateCakeBalanceDue e buildTableQrPath geram valores corretos", () => {
  assert.equal(calculateCakeBalanceDue(320, 120), 200);
  assert.equal(calculateCakeBalanceDue(180, 200), 0);
  assert.equal(buildTableQrPath(7, "mesa-07-abc"), "/mesa/7?token=mesa-07-abc");
});

test("resolveQrOrigin usa IP da rede LAN quando acessado via localhost", () => {
  assert.equal(
    resolveQrOrigin({
      requestOrigin: "http://localhost:3001",
      lanIp: "192.168.1.11",
    }),
    "http://192.168.1.11:3001",
  );
  assert.equal(
    resolveQrOrigin({
      requestOrigin: "http://localhost:3001",
      lanIp: "192.168.1.11",
      customBaseUrl: "https://fornoemesa.vercel.app/",
    }),
    "https://fornoemesa.vercel.app",
  );
});

test("splitBillAmount e calculateCashChange calculam divisao e troco corretamente", () => {
  assert.equal(splitBillAmount(150, 3), 50);
  assert.equal(splitBillAmount(100, 3), 33.33);
  assert.equal(calculateCashChange(73.5, 100), 26.5);
  assert.equal(calculateCashChange(80, 50), 0);
});

test("calculateLoyaltyPointsEarned e getLoyaltyTier calculam fidelidade corretamente", () => {
  assert.equal(calculateLoyaltyPointsEarned(89.9), 8);
  assert.equal(calculateLoyaltyPointsEarned(120), 12);
  assert.equal(getLoyaltyTier(5), "BRONZE");
  assert.equal(getLoyaltyTier(20), "PRATA");
  assert.equal(getLoyaltyTier(45), "OURO");
});

test("calculateCardFeeRate, CMV e computeFinancialDre calculam DRE e margens", () => {
  assert.equal(calculateCardFeeRate("CREDITO"), 0.032);
  assert.equal(calculateCardFeeRate("DEBITO"), 0.016);
  assert.equal(calculateCardFeeRate("PIX"), 0);

  const unitCost = calculateProductRecipeCost([
    { qtyRequired: 0.2, costPerUnit: 30 },
    { qtyRequired: 0.05, costPerUnit: 80 },
  ]);
  assert.equal(unitCost, 10);
  assert.equal(calculateMarginPercentage(40, unitCost), 75);

  const dre = computeFinancialDre({
    orders: [
      {
        status: "PAGO",
        paymentMethod: "CREDITO",
        subtotal: 100,
        discount: 0,
        serviceFee: 0,
        total: 100,
        items: [{ productId: 1, qty: 2, totalPrice: 100 }],
      },
      {
        status: "ABERTO",
        paymentMethod: null,
        subtotal: 50,
        discount: 0,
        serviceFee: 5,
        total: 55,
        items: [{ productId: 1, qty: 1, totalPrice: 50 }],
      },
    ],
    productCostById: new Map([[1, 10]]),
    cakeOrders: [{ totalPrice: 300, depositPaid: 100, status: "CONFIRMADA" }],
    entries: [
      { type: "DESPESA", amount: 40, status: "PAGO" },
      { type: "DESPESA", amount: 80, status: "PENDENTE" },
      { type: "RECEITA", amount: 50, status: "PAGO" },
      { type: "RECEITA", amount: 120, status: "PENDENTE" },
    ],
  });

  assert.equal(dre.grossRevenue, 250);
  assert.equal(dre.cardFeesEstimated, 3.2);
  assert.equal(dre.estimatedCmv, 20);
  assert.equal(dre.operatingExpensesPaid, 40);
  assert.equal(dre.operatingExpensesPending, 80);
  assert.equal(dre.receivablesPending, 375);
  assert.equal(dre.netProfit, 186.8);
});

test("isErpAllowedContext bloqueia celular/LAN sem PIN e libera desktop local ou com token valido", () => {
  const validToken = buildOperatorToken("2026");

  assert.equal(extractHostname("192.168.1.11:3001"), "192.168.1.11");
  assert.equal(extractHostname("[::1]:3001"), "::1");

  // Desktop local no caixa entra direto
  assert.equal(
    isErpAllowedContext({
      host: "localhost:3001",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      cookieToken: null,
      expectedToken: validToken,
    }),
    true,
  );

  // Celular na rede local (ou mesmo simulado em localhost) e bloqueado
  assert.equal(
    isErpAllowedContext({
      host: "192.168.1.11:3001",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      cookieToken: null,
      expectedToken: validToken,
    }),
    false,
  );
  assert.equal(
    isErpAllowedContext({
      host: "localhost:3001",
      userAgent: "Mozilla/5.0 (Linux; Android 14; Mobile)",
      cookieToken: null,
      expectedToken: validToken,
    }),
    false,
  );

  // Equipe autenticada via PIN consegue acessar
  assert.equal(
    isErpAllowedContext({
      host: "192.168.1.11:3001",
      userAgent: "Mozilla/5.0 (Linux; Android 14; Mobile)",
      cookieToken: validToken,
      expectedToken: validToken,
    }),
    true,
  );
});

import {
  buildWhatsAppLink,
  computeSalesByHour,
  estimateDeliveryMinutes,
  getDeliveryFlow,
  missingForMinimumOrder,
  nextDeliveryStatus,
  resolveDeliveryFee,
} from "../domain.ts";

test("calculateOrderTotals inclui taxa de entrega sem taxa de servico", () => {
  const res = calculateOrderTotals({
    items: [{ qty: 2, unitPrice: 25 }],
    deliveryFee: 8,
  });
  assert.equal(res.subtotal, 50);
  assert.equal(res.deliveryFee, 8);
  assert.equal(res.serviceFee, 0);
  assert.equal(res.total, 58);
});

test("resolveDeliveryFee aplica frete gratis acima do limite", () => {
  assert.equal(resolveDeliveryFee({ zoneFee: 7, subtotal: 100, freeAbove: 150 }), 7);
  assert.equal(resolveDeliveryFee({ zoneFee: 7, subtotal: 150, freeAbove: 150 }), 0);
});

test("nextDeliveryStatus e getDeliveryFlow pulam SAIU_ENTREGA na retirada", () => {
  assert.deepEqual(getDeliveryFlow(true), ["RECEBIDO", "EM_PREPARO", "PRONTO", "ENTREGUE"]);
  assert.equal(nextDeliveryStatus("PRONTO", false), "SAIU_ENTREGA");
  assert.equal(nextDeliveryStatus("PRONTO", true), "ENTREGUE");
  assert.equal(nextDeliveryStatus("ENTREGUE", false), null);
});

test("estimateDeliveryMinutes e missingForMinimumOrder", () => {
  assert.equal(estimateDeliveryMinutes({ prepMinutes: [5, 18], zoneEtaMinutes: 25, isPickup: false }), 43);
  assert.equal(estimateDeliveryMinutes({ prepMinutes: [5, 18], zoneEtaMinutes: 25, isPickup: true }), 18);
  assert.equal(missingForMinimumOrder(20, 35), 15);
  assert.equal(missingForMinimumOrder(40, 35), 0);
});

test("buildWhatsAppLink normaliza telefone brasileiro", () => {
  const url = buildWhatsAppLink("(11) 98765-4321", "Olá!");
  assert.ok(url?.startsWith("https://wa.me/5511987654321?text="));
  assert.equal(buildWhatsAppLink("123", "Oi"), null);
});

test("computeSalesByHour agrupa faturamento pago por hora", () => {
  const buckets = computeSalesByHour([
    { status: "PAGO", total: 50, paidAt: "2026-11-19T10:15:00", createdAt: "2026-11-19T10:00:00" },
    { status: "PAGO", total: 30, paidAt: "2026-11-19T10:45:00", createdAt: "2026-11-19T10:30:00" },
    { status: "ABERTO", total: 99, paidAt: null, createdAt: "2026-11-19T10:30:00" },
  ]);
  assert.equal(buckets[10], 80);
  assert.equal(buckets[11], 0);
});
