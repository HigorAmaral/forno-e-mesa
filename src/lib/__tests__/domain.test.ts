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
  resolveCouponBenefit,
  resolveQrOrigin,
  splitBillAmount,
} from "../domain.ts";
import {
  buildSignedOperatorToken,
  buildOperatorToken,
  extractHostname,
  isErpAllowedContext,
  parseSignedOperatorToken,
} from "../access-policy.ts";
import {
  checkRateLimit,
  hashSecret,
  signSessionPayload,
  verifySecret,
  verifySessionPayload,
} from "../auth-crypto.ts";
import { canAccessTab, defaultTabForRole, hasAnyRole, isValidStaffRole } from "../rbac.ts";
import { resolveRoutePolicy, sanitizeNextPath } from "../route-auth.ts";
import {
  getKdsUrgencyLevel,
  resolveDynamicCouponBenefit,
  validateSplitPayments,
} from "../domain.ts";

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

test("isErpAllowedContext bloqueia acesso sem cookie valido (inclusive localhost) e libera com token valido", () => {
  const validToken = buildOperatorToken("2026");

  assert.equal(extractHostname("192.168.1.11:3001"), "192.168.1.11");
  assert.equal(extractHostname("[::1]:3001"), "::1");

  // Desktop local sem cookie fica bloqueado (fail-closed)
  assert.equal(
    isErpAllowedContext({
      host: "localhost:3001",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      cookieToken: null,
      expectedToken: validToken,
    }),
    false,
  );

  // Celular na rede local (ou localhost) sem cookie e bloqueado
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

  // Equipe autenticada via cookie consegue acessar
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

test("resolveCouponBenefit valida cupons FORNO10, BEMVINDO e FRETEZERO", () => {
  const c10 = resolveCouponBenefit({ code: "forno10", subtotal: 100 });
  assert.equal(c10.valid, true);
  assert.equal(c10.discount, 10);
  assert.equal(c10.freeDelivery, false);

  const bemInvalid = resolveCouponBenefit({ code: "BEMVINDO", subtotal: 35 });
  assert.equal(bemInvalid.valid, false);

  const bemValid = resolveCouponBenefit({ code: "BEMVINDO", subtotal: 50 });
  assert.equal(bemValid.valid, true);
  assert.equal(bemValid.discount, 10);

  const frete = resolveCouponBenefit({ code: "FRETEZERO", subtotal: 25 });
  assert.equal(frete.valid, true);
  assert.equal(frete.freeDelivery, true);
});

test("hashSecret e verifySecret protegem senhas/PINs com salt aleatorio", () => {
  const hash1 = hashSecret("forno2026");
  const hash2 = hashSecret("forno2026");
  assert.notEqual(hash1, hash2);
  assert.equal(verifySecret("forno2026", hash1), true);
  assert.equal(verifySecret("errada", hash1), false);
  assert.equal(verifySecret("forno2026", "formato-invalido"), false);
  assert.equal(verifySecret("", hash1), false);
});

test("signSessionPayload e verifySessionPayload validam assinatura e expiracao", () => {
  const token = signSessionPayload({
    userId: 1,
    role: "ADMIN",
    exp: Date.now() + 60_000,
  });
  const decoded = verifySessionPayload<{ userId: number; role: string; exp: number }>(token);
  assert.equal(decoded?.userId, 1);
  assert.equal(decoded?.role, "ADMIN");

  const tampered = `${token.slice(0, -2)}xx`;
  assert.equal(verifySessionPayload(tampered), null);

  const expired = signSessionPayload({
    userId: 1,
    exp: Date.now() - 1000,
  });
  assert.equal(verifySessionPayload(expired), null);
});

test("checkRateLimit bloqueia apos exceder o limite na janela", () => {
  const key = `test-rl-${Date.now()}`;
  assert.equal(checkRateLimit(key, 2, 60_000).allowed, true);
  assert.equal(checkRateLimit(key, 2, 60_000).allowed, true);
  const blocked = checkRateLimit(key, 2, 60_000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSec > 0);
});

test("buildSignedOperatorToken, parseSignedOperatorToken e lockedCookie funcionam no controle de acesso", () => {
  const token = buildSignedOperatorToken({
    userId: 2,
    name: "Carla Caixa",
    email: "caixa@fornoemesa.com",
    role: "CAIXA",
  });
  const parsed = parseSignedOperatorToken(token);
  assert.equal(parsed?.name, "Carla Caixa");
  assert.equal(parsed?.role, "CAIXA");

  // Desktop localhost com lockedCookie="1" fica bloqueado ate novo login
  assert.equal(
    isErpAllowedContext({
      host: "localhost:3001",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      cookieToken: null,
      lockedCookie: "1",
    }),
    false,
  );

  // Token assinado valido libera mesmo em celular/LAN
  assert.equal(
    isErpAllowedContext({
      host: "192.168.1.25:3001",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      cookieToken: token,
      lockedCookie: "1",
    }),
    true,
  );
});

test("RBAC canAccessTab, hasAnyRole e defaultTabForRole aplicam permissoes por perfil", () => {
  assert.equal(canAccessTab("ADMIN", "finance"), true);
  assert.equal(canAccessTab("ADMIN", "settings"), true);
  assert.equal(canAccessTab("CAIXA", "pdv"), true);
  assert.equal(canAccessTab("CAIXA", "finance"), false);
  assert.equal(canAccessTab("CAIXA", "settings"), false);
  assert.equal(canAccessTab("COZINHA", "kds"), true);
  assert.equal(canAccessTab("COZINHA", "bakery"), true);
  assert.equal(canAccessTab("COZINHA", "pdv"), false);
  assert.equal(defaultTabForRole("COZINHA"), "kds");
  assert.equal(defaultTabForRole("GARCOM"), "tables");
  assert.equal(hasAnyRole("GERENTE", ["ADMIN", "GERENTE"]), true);
  assert.equal(hasAnyRole("CAIXA", ["ADMIN", "GERENTE"]), false);
});

test("resolveDynamicCouponBenefit suporta PERCENT com teto, FIXED com minimo, FREE_DELIVERY e inativo", () => {
  const pct = resolveDynamicCouponBenefit(
    { code: "CAFE20", label: "20% até R$25", type: "PERCENT", value: 20, maxDiscount: 25, minOrder: 0, isActive: true },
    200,
  );
  assert.equal(pct.valid, true);
  assert.equal(pct.discount, 25);

  const fixedFail = resolveDynamicCouponBenefit(
    { code: "VIP15", label: "R$15 acima de 80", type: "FIXED", value: 15, minOrder: 80, isActive: true },
    60,
  );
  assert.equal(fixedFail.valid, false);

  const fixedOk = resolveDynamicCouponBenefit(
    { code: "VIP15", label: "R$15 acima de 80", type: "FIXED", value: 15, minOrder: 80, isActive: true },
    100,
  );
  assert.equal(fixedOk.valid, true);
  assert.equal(fixedOk.discount, 15);

  const free = resolveDynamicCouponBenefit(
    { code: "FRETE0", label: "Frete grátis", type: "FREE_DELIVERY", value: 0, minOrder: 0, isActive: true },
    30,
  );
  assert.equal(free.valid, true);
  assert.equal(free.freeDelivery, true);

  const inactive = resolveDynamicCouponBenefit(
    { code: "OLD", label: "Expirado", type: "FIXED", value: 10, minOrder: 0, isActive: false },
    100,
  );
  assert.equal(inactive.valid, false);
});

test("validateSplitPayments valida soma exata e rejeita divergencias ou valores invalidos", () => {
  const ok = validateSplitPayments(100, [
    { method: "PIX", amount: 40 },
    { method: "CREDITO", amount: 60 },
  ]);
  assert.equal(ok.valid, true);
  assert.equal(ok.remaining, 0);

  const missing = validateSplitPayments(100, [
    { method: "PIX", amount: 40 },
    { method: "CREDITO", amount: 50 },
  ]);
  assert.equal(missing.valid, false);
  assert.equal(missing.remaining, 10);

  const zero = validateSplitPayments(100, [{ method: "PIX", amount: 0 }]);
  assert.equal(zero.valid, false);
});

test("getKdsUrgencyLevel classifica SLA normal, warning e urgent", () => {
  const now = new Date("2026-11-24T12:00:00Z");
  assert.equal(getKdsUrgencyLevel(new Date("2026-11-24T11:55:00Z"), now), "normal");
  assert.equal(getKdsUrgencyLevel(new Date("2026-11-24T11:50:00Z"), now), "warning");
  assert.equal(getKdsUrgencyLevel(new Date("2026-11-24T11:42:00Z"), now), "urgent");
});

test("computeFinancialDre aceita taxas de cartao personalizadas", () => {
  const dre = computeFinancialDre({
    orders: [
      {
        status: "PAGO",
        paymentMethod: "CREDITO",
        subtotal: 100,
        discount: 0,
        serviceFee: 0,
        total: 100,
        items: [{ productId: 1, qty: 1, totalPrice: 100 }],
      },
      {
        status: "PAGO",
        paymentMethod: "DEBITO",
        subtotal: 100,
        discount: 0,
        serviceFee: 0,
        total: 100,
        items: [{ productId: 1, qty: 1, totalPrice: 100 }],
      },
    ],
    productCostById: new Map([[1, 20]]),
    cakeOrders: [],
    entries: [],
    creditCardFeeRate: 0.04,
    debitCardFeeRate: 0.02,
  });

  assert.equal(dre.cardFeesEstimated, 6);
  assert.equal(dre.estimatedCmv, 40);
  assert.equal(dre.netProfit, 154);
});

test("RBAC fail-closed nega acesso sem role valido", () => {
  assert.equal(canAccessTab(null, "overview"), false);
  assert.equal(canAccessTab(undefined, "finance"), false);
  assert.equal(canAccessTab("DESCONHECIDO", "pdv"), false);
  assert.equal(hasAnyRole(null, ["ADMIN"]), false);
  assert.equal(isValidStaffRole("ADMIN"), true);
  assert.equal(isValidStaffRole("VISITANTE"), false);
});

test("resolveRoutePolicy protege rotas internas e APIs com RBAC e fail-closed", () => {
  // Rotas publicas e portais de entrada
  assert.deepEqual(resolveRoutePolicy("/", "GET"), { access: "public" });
  assert.deepEqual(resolveRoutePolicy("/login", "GET"), { access: "public" });
  assert.deepEqual(resolveRoutePolicy("/delivery", "GET"), { access: "public" });
  assert.deepEqual(resolveRoutePolicy("/conta", "GET"), { access: "public" });
  assert.deepEqual(resolveRoutePolicy("/mesa/4", "GET"), { access: "public" });
  assert.deepEqual(resolveRoutePolicy("/delivery/acompanhar/PED-0001", "GET"), { access: "public" });
  assert.deepEqual(resolveRoutePolicy("/api/delivery/zones", "GET"), { access: "public" });
  assert.deepEqual(resolveRoutePolicy("/api/settings", "GET"), { access: "public" });
  assert.deepEqual(resolveRoutePolicy("/api/orders", "POST"), { access: "public" });
  assert.deepEqual(resolveRoutePolicy("/api/tables/4", "PATCH"), { access: "public" });

  // Paginas internas protegidas
  assert.deepEqual(resolveRoutePolicy("/erp", "GET"), { access: "operator", isApi: false });
  assert.deepEqual(resolveRoutePolicy("/admin/relatorios", "GET"), { access: "operator", isApi: false });
  assert.deepEqual(resolveRoutePolicy("/painel", "GET"), { access: "operator", isApi: false });

  // APIs protegidas por RBAC
  const financePolicy = resolveRoutePolicy("/api/finance", "GET");
  assert.equal(financePolicy.access, "operator");
  if (financePolicy.access === "operator") {
    assert.deepEqual(financePolicy.allowedRoles, ["ADMIN", "GERENTE"]);
    assert.equal(financePolicy.isApi, true);
  }

  const cashPolicy = resolveRoutePolicy("/api/cash", "POST");
  assert.equal(cashPolicy.access, "operator");
  if (cashPolicy.access === "operator") {
    assert.deepEqual(cashPolicy.allowedRoles, ["ADMIN", "GERENTE", "CAIXA"]);
  }

  const batchPolicy = resolveRoutePolicy("/api/batches", "POST");
  assert.equal(batchPolicy.access, "operator");
  if (batchPolicy.access === "operator") {
    assert.deepEqual(batchPolicy.allowedRoles, ["ADMIN", "GERENTE", "COZINHA"]);
  }

  const qrPolicy = resolveRoutePolicy("/api/tables/4/qr", "GET");
  assert.equal(qrPolicy.access, "operator");
  if (qrPolicy.access === "operator") {
    assert.deepEqual(qrPolicy.allowedRoles, ["ADMIN", "GERENTE", "CAIXA", "GARCOM"]);
  }

  const staffPolicy = resolveRoutePolicy("/api/staff", "GET");
  assert.equal(staffPolicy.access, "operator");
  if (staffPolicy.access === "operator") {
    assert.deepEqual(staffPolicy.allowedRoles, ["ADMIN", "GERENTE"]);
  }

  const workspacePolicy = resolveRoutePolicy("/api/workspace", "GET");
  assert.equal(workspacePolicy.access, "operator");

  // Qualquer outra rota de API desconhecia cai no fallback fail-closed
  assert.deepEqual(resolveRoutePolicy("/api/desconhecida", "GET"), {
    access: "operator",
    isApi: true,
  });
});

test("sanitizeNextPath bloqueia open redirects", () => {
  assert.equal(sanitizeNextPath("//evil.com"), "/");
  assert.equal(sanitizeNextPath("https://evil.com"), "/");
  assert.equal(sanitizeNextPath("/login"), "/");
  assert.equal(sanitizeNextPath("/login?next=/"), "/");
  assert.equal(sanitizeNextPath("/delivery"), "/delivery");
  assert.equal(sanitizeNextPath("/erp?tab=kds"), "/erp?tab=kds");
});

