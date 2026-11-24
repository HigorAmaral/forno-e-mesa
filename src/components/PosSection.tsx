"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  Banknote,
  Bike,
  CheckCircle2,
  Minus,
  Plus,
  Receipt,
  Scale,
  Search,
  Send,
  ShoppingCart,
  Sparkles,
  Split,
  Store,
  Tag,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import {
  calculateCashChange,
  calculateOrderTotals,
  formatBRL,
  FREE_DELIVERY_ABOVE,
  getLoyaltyTier,
  missingForMinimumOrder,
  resolveDeliveryFee,
  roundMoney,
  validateSplitPayments,
} from "@/lib/domain";
import type {
  CustomerProfileDto,
  DeliveryZoneDto,
  OrderDto,
  ProductDto,
  SplitPaymentPart,
  StoreSettingsDto,
  TableWithOrdersDto,
} from "@/types/erp";
import { ProductPhoto } from "./ProductPhoto";

interface PosSectionProps {
  products: ProductDto[];
  tables: TableWithOrdersDto[];
  customers: CustomerProfileDto[];
  deliveryZones: DeliveryZoneDto[];
  storeSettings?: StoreSettingsDto;
  preselectedTableNumber: number | null;
  preselectedCustomerId: number | null;
  preselectedMode?: "BALCAO" | "MESA" | "DELIVERY" | "RETIRADA" | null;
  onClearPreselectedTable: () => void;
  onClearPreselectedCustomer: () => void;
  onClearPreselectedMode?: () => void;
  onOrderCreated: (order: OrderDto, openReceipt?: boolean) => Promise<void>;
  onError: (message: string) => void;
}

interface CartItem {
  product: ProductDto;
  qty: number;
  notes: string;
}

const SECTORS = [
  { id: "ALL", label: "Todos" },
  { id: "PADARIA", label: "Padaria" },
  { id: "CONFEITARIA", label: "Confeitaria" },
  { id: "RESTAURANTE", label: "Restaurante" },
  { id: "BEBIDAS", label: "Bebidas" },
];

export function PosSection({
  products,
  tables,
  customers,
  deliveryZones,
  storeSettings,
  preselectedTableNumber,
  preselectedCustomerId,
  preselectedMode,
  onClearPreselectedTable,
  onClearPreselectedCustomer,
  onClearPreselectedMode,
  onOrderCreated,
  onError,
}: PosSectionProps) {
  const activeZones = useMemo(
    () => deliveryZones.filter((z) => z.isActive),
    [deliveryZones],
  );
  const [mobileView, setMobileView] = useState<"catalog" | "cart">("catalog");
  const [sector, setSector] = useState("ALL");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderMode, setOrderMode] = useState<"BALCAO" | "MESA" | "DELIVERY" | "RETIRADA">(
    preselectedTableNumber !== null
      ? "MESA"
      : preselectedMode ?? "BALCAO",
  );
  const [targetTableNumber, setTargetTableNumber] = useState<number | "">(
    preselectedTableNumber ?? "",
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "">(
    preselectedCustomerId ?? "",
  );
  const [redeemLoyaltyPoints, setRedeemLoyaltyPoints] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryZoneId, setDeliveryZoneId] = useState<number>(activeZones[0]?.id ?? 0);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryReference, setDeliveryReference] = useState("");
  const [changeFor, setChangeFor] = useState("");
  const [discount, setDiscount] = useState("0");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount: number;
    freeDelivery: boolean;
    label: string;
  } | null>(null);
  const [orderNotes, setOrderNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "PIX" | "CREDITO" | "DEBITO" | "DINHEIRO" | "MISTO"
  >("PIX");
  const [splitParts, setSplitParts] = useState<SplitPaymentPart[]>([
    { method: "PIX", amount: 0 },
    { method: "CREDITO", amount: 0 },
  ]);
  const [cashReceived, setCashReceived] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  const effectiveMode =
    preselectedTableNumber !== null
      ? "MESA"
      : preselectedMode ?? orderMode;

  const effectiveTableNumber =
    effectiveMode === "MESA"
      ? preselectedTableNumber ?? (targetTableNumber === "" ? null : targetTableNumber)
      : null;

  const isDelivery = effectiveMode === "DELIVERY";
  const isPickup = effectiveMode === "RETIRADA";
  const isDeliveryChannel = isDelivery || isPickup;

  const selectedZone = useMemo(
    () => activeZones.find((z) => z.id === deliveryZoneId) ?? activeZones[0] ?? null,
    [activeZones, deliveryZoneId],
  );

  const effectiveCustomerId =
    preselectedCustomerId ??
    (selectedCustomerId === "" ? null : selectedCustomerId);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === effectiveCustomerId) ?? null,
    [customers, effectiveCustomerId],
  );

  const canRedeemLoyalty = Boolean(
    selectedCustomer && selectedCustomer.loyaltyPoints >= 10 && cart.length > 0,
  );
  const effectiveRedeem = canRedeemLoyalty && redeemLoyaltyPoints;

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (!p.isAvailable) return false;
      if (sector !== "ALL" && p.category.sector !== sector) return false;
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.sku.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [products, sector, search]);

  const serviceFeeRate = (storeSettings?.defaultServiceFeePct ?? 10) / 100;
  const freeDeliveryThreshold =
    storeSettings?.freeDeliveryAbove ?? FREE_DELIVERY_ABOVE;

  const couponDiscount = appliedCoupon?.discount ?? 0;

  const preTotals = useMemo(
    () =>
      calculateOrderTotals({
        items: cart.map((c) => ({ qty: c.qty, unitPrice: c.product.price })),
        discount:
          (Number(discount) || 0) + (effectiveRedeem ? 15 : 0) + couponDiscount,
      }),
    [cart, discount, effectiveRedeem, couponDiscount],
  );

  const deliveryFee = useMemo(() => {
    if (!isDelivery || !selectedZone || cart.length === 0) return 0;
    if (appliedCoupon?.freeDelivery) return 0;
    return resolveDeliveryFee({
      zoneFee: selectedZone.fee,
      subtotal: Math.max(0, preTotals.subtotal - preTotals.discount),
      freeAbove: freeDeliveryThreshold,
    });
  }, [
    isDelivery,
    selectedZone,
    cart.length,
    appliedCoupon,
    preTotals.subtotal,
    preTotals.discount,
    freeDeliveryThreshold,
  ]);

  const totals = useMemo(
    () =>
      calculateOrderTotals({
        items: cart.map((c) => ({ qty: c.qty, unitPrice: c.product.price })),
        discount:
          (Number(discount) || 0) + (effectiveRedeem ? 15 : 0) + couponDiscount,
        applyServiceFee: effectiveTableNumber !== null,
        serviceFeeRate,
        deliveryFee,
      }),
    [
      cart,
      discount,
      effectiveRedeem,
      couponDiscount,
      effectiveTableNumber,
      serviceFeeRate,
      deliveryFee,
    ],
  );

  const minMissing = useMemo(() => {
    if (!isDelivery || !selectedZone || cart.length === 0) return 0;
    return missingForMinimumOrder(totals.subtotal, selectedZone.minOrder);
  }, [isDelivery, selectedZone, cart.length, totals.subtotal]);

  const cashChange = useMemo(() => {
    const rec = Number(cashReceived) || 0;
    return calculateCashChange(totals.total, rec);
  }, [totals.total, cashReceived]);

  const splitValidation = useMemo(
    () => validateSplitPayments(totals.total, splitParts),
    [totals.total, splitParts],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "F2" && cart.length > 0 && !submitting) {
        e.preventDefault();
        void handleSubmit(effectiveMode === "MESA" ? false : true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.length, submitting, effectiveMode, totals.total, paymentMethod]);

  function addProduct(product: ProductDto, qtyStep = 1) {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        return prev.map((line, i) =>
          i === idx
            ? { ...line, qty: Number((line.qty + qtyStep).toFixed(3)) }
            : line,
        );
      }
      const initialQty = product.unit === "KG" ? 0.5 : qtyStep;
      return [...prev, { product, qty: initialQty, notes: "" }];
    });
  }

  function setItemQty(productId: number, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, qty } : i)),
    );
  }

  function setItemNotes(productId: number, notes: string) {
    setCart((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, notes } : i)),
    );
  }

  function applyCombo(comboType: "CAFE_MANHA" | "BISTRO") {
    const findMatch = (keywords: string[]) =>
      products.find(
        (p) =>
          p.isAvailable &&
          keywords.some((k) => p.name.toLowerCase().includes(k)),
      );

    const targets =
      comboType === "CAFE_MANHA"
        ? [findMatch(["croissant"]), findMatch(["cappuccino", "café"])]
        : [findMatch(["risoto", "lasanha"]), findMatch(["suco"])];

    const valid = targets.filter((p): p is ProductDto => Boolean(p));
    if (valid.length === 0) {
      onError("Produtos do combo não encontrados no catálogo.");
      return;
    }
    valid.forEach((prod) => addProduct(prod, 1));
    setDiscount((prev) => String((Number(prev) || 0) + 5));
  }

  async function validateCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setAppliedCoupon(null);
      return;
    }
    const res = await fetch(
      `/api/coupons?code=${encodeURIComponent(code)}&subtotal=${totals.subtotal}`,
      { cache: "no-store" },
    );
    const json = await res.json();
    if (!res.ok || !json.valid) {
      setAppliedCoupon(null);
      onError(json.error ?? "Cupom inválido.");
      return;
    }
    setAppliedCoupon({
      code: json.code,
      discount: json.discount ?? 0,
      freeDelivery: Boolean(json.freeDelivery),
      label: json.label ?? json.code,
    });
  }

  async function handleSubmit(payNow: boolean) {
    if (cart.length === 0 || submitting || minMissing > 0) return;
    if (payNow && paymentMethod === "MISTO" && !splitValidation.valid) {
      onError(splitValidation.error ?? "Verifique os valores do pagamento misto.");
      return;
    }

    setSubmitting(true);
    try {
      const isTable = effectiveTableNumber !== null;
      const channel = isTable
        ? "MESA"
        : isDelivery
          ? "DELIVERY"
          : isPickup
            ? "RETIRADA"
            : "PDV_BALCAO";

      const useSplit = !isTable && payNow && paymentMethod === "MISTO";

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          tableNumber: isTable ? effectiveTableNumber : undefined,
          customerId: effectiveCustomerId ?? undefined,
          customerName:
            customerName.trim() || selectedCustomer?.name || undefined,
          customerPhone:
            customerPhone.trim() || selectedCustomer?.phone || undefined,
          redeemLoyaltyPoints: effectiveRedeem,
          discount: Number(discount) || 0,
          couponCode: appliedCoupon?.code ?? undefined,
          applyServiceFee: isTable,
          notes: orderNotes.trim() || undefined,
          payNow: !isTable && payNow,
          paymentMethod:
            !isTable && (payNow || isDeliveryChannel) ? paymentMethod : undefined,
          splitPayments: useSplit ? splitParts : undefined,
          delivery: isDelivery
            ? {
                zoneId: selectedZone?.id,
                address: deliveryAddress.trim(),
                neighborhood: selectedZone?.name,
                reference: deliveryReference.trim() || undefined,
                changeFor:
                  paymentMethod === "DINHEIRO" && Number(changeFor) > 0
                    ? Number(changeFor)
                    : undefined,
              }
            : undefined,
          items: cart.map((line) => ({
            productId: line.product.id,
            qty: line.qty,
            notes: line.notes.trim() || undefined,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onError(json.error ?? "Erro ao registrar pedido.");
        return;
      }
      setCart([]);
      setDiscount("0");
      setCouponInput("");
      setAppliedCoupon(null);
      setCustomerName("");
      setCustomerPhone("");
      setDeliveryAddress("");
      setDeliveryReference("");
      setChangeFor("");
      setOrderNotes("");
      setCashReceived("");
      setTargetTableNumber("");
      setSelectedCustomerId("");
      setRedeemLoyaltyPoints(false);
      setMobileView("catalog");
      onClearPreselectedTable();
      onClearPreselectedCustomer();
      onClearPreselectedMode?.();
      await onOrderCreated(json.order, payNow || isDeliveryChannel);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-4">
      {/* Mobile/Tablet View Switcher */}
      <div className="flex items-center justify-between gap-2 xl:hidden">
        <div className="segmented w-full">
          <button
            type="button"
            className="flex-1"
            data-active={mobileView === "catalog"}
            onClick={() => setMobileView("catalog")}
          >
            Catálogo ({filteredProducts.length})
          </button>
          <button
            type="button"
            className="flex-1"
            data-active={mobileView === "cart"}
            onClick={() => setMobileView("cart")}
          >
            Comanda ({cart.length}) · {formatBRL(totals.total)}
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        {/* Left Catalog */}
        <div
          className={`min-w-0 space-y-4 xl:col-span-8 ${
            mobileView === "cart" ? "hidden xl:block" : ""
          }`}
        >
          <div className="card-bistro flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar pão, bolo, prato, bebida ou código (atalho /)..."
                className="input-field py-2 pr-3 pl-9 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SECTORS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSector(s.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    sector === s.id
                      ? "bg-[var(--accent-primary)] text-white shadow-xs"
                      : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card-bistro flex flex-wrap items-center gap-2 bg-[var(--bg-elevated)] px-4 py-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 font-bold text-[var(--accent-primary)]">
              <Sparkles className="h-3.5 w-3.5" />
              Combos Rápidos (desc. R$ 5):
            </span>
            <button
              type="button"
              onClick={() => applyCombo("CAFE_MANHA")}
              className="rounded-lg border border-[var(--border-warm)] bg-[var(--bg-surface)] px-2.5 py-1 font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white"
            >
              + Café da Manhã (Croissant + Cappuccino)
            </button>
            <button
              type="button"
              onClick={() => applyCombo("BISTRO")}
              className="rounded-lg border border-[var(--border-warm)] bg-[var(--bg-surface)] px-2.5 py-1 font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white"
            >
              + Almoço Bistrô (Risoto + Suco)
            </button>
            <span className="ml-auto hidden text-[11px] text-[var(--text-secondary)] sm:inline">
              Atalho <kbd className="rounded border border-[var(--border-warm)] px-1">F2</kbd> finaliza venda
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addProduct(product)}
                className="card-bistro card-bistro-interactive group flex flex-col justify-between p-4 text-left"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-md bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
                      {product.category.sector} · {product.prepStation}
                    </span>
                    {product.unit === "KG" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                        <Scale className="h-3 w-3" /> Balança KG
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5 flex items-start gap-2.5">
                    {product.imageUrl && (
                      <ProductPhoto
                        imageUrl={product.imageUrl}
                        name={product.name}
                        sector={product.category.sector}
                        size="sm"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]">
                        {product.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
                        {product.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-end justify-between border-t border-[var(--border-warm)] pt-2.5">
                  <span className="font-mono-num text-base font-bold text-[var(--text-primary)]">
                    {formatBRL(product.price)}
                    <span className="text-[11px] font-normal text-[var(--text-secondary)]">
                      /{product.unit}
                    </span>
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${
                      product.stockQty <= product.minStockQty
                        ? "text-amber-600"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    Estq: {product.stockQty}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Cart / Checkout */}
        <div
          className={`xl:col-span-4 ${
            mobileView === "catalog" ? "hidden xl:block" : ""
          }`}
        >
          <div className="card-bistro p-5 xl:sticky xl:top-20">
            <div className="mb-4 flex items-center justify-between border-b border-[var(--border-warm)] pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-[var(--accent-primary)]" />
                <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                  Caixa / Comanda
                </h2>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs font-semibold text-red-700 hover:underline"
                >
                  Limpar ({cart.length})
                </button>
              )}
            </div>

            {/* Channel Mode Switcher */}
            <div className="mb-3 grid grid-cols-4 gap-1 rounded-xl bg-[var(--bg-subtle)] p-1">
              {(
                [
                  { id: "BALCAO", label: "Balcão", icon: ShoppingCart },
                  { id: "MESA", label: "Mesa", icon: UtensilsCrossed },
                  { id: "DELIVERY", label: "Delivery", icon: Bike },
                  { id: "RETIRADA", label: "Retirada", icon: Store },
                ] as const
              ).map((m) => {
                const Icon = m.icon;
                const active = effectiveMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onClearPreselectedTable();
                      onClearPreselectedMode?.();
                      setOrderMode(m.id);
                      if (m.id !== "MESA") setTargetTableNumber("");
                    }}
                    className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[10px] font-bold transition ${
                      active
                        ? "bg-[var(--accent-primary)] text-white shadow-xs"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {m.label}
                  </button>
                );
              })}
            </div>

            <div className="mb-3 grid gap-2.5 sm:grid-cols-2">
              {effectiveMode === "MESA" && (
                <div>
                  <label className="field-label mb-1">
                    Mesa
                    <select
                      value={effectiveTableNumber ?? ""}
                      onChange={(e) => {
                        onClearPreselectedTable();
                        setTargetTableNumber(
                          e.target.value ? Number(e.target.value) : "",
                        );
                      }}
                      className="input-field py-2 text-xs font-medium"
                    >
                      <option value="">Selecione a mesa...</option>
                      {tables.map((t) => (
                        <option key={t.id} value={t.number}>
                          {t.name} ({t.status})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              <div
                className={
                  effectiveMode === "MESA" ? "" : isDeliveryChannel ? "" : "sm:col-span-2"
                }
              >
                <label className="field-label mb-1">
                  {isDeliveryChannel ? "Nome do Cliente *" : "Cliente / Identificação"}
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={selectedCustomer ? selectedCustomer.name : "Ex: João / Balcão"}
                    className="input-field py-2 text-xs"
                  />
                </label>
              </div>
              {isDeliveryChannel && (
                <div>
                  <label className="field-label mb-1">
                    Telefone / WhatsApp
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder={selectedCustomer?.phone ?? "(11) 99999-9999"}
                      className="input-field py-2 text-xs"
                    />
                  </label>
                </div>
              )}
            </div>

            {isDelivery && (
              <div className="mb-3 space-y-2 rounded-xl border border-orange-500/35 bg-orange-500/10 p-3 text-xs text-[var(--text-primary)]">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-[var(--text-secondary)]">
                    Bairro / Região de Entrega
                  </label>
                  <select
                    value={selectedZone?.id ?? ""}
                    onChange={(e) => setDeliveryZoneId(Number(e.target.value))}
                    className="input-field py-1.5 text-xs font-medium"
                  >
                    {activeZones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} · {formatBRL(z.fee)} (~{z.etaMinutes} min · mín {formatBRL(z.minOrder)})
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Rua, número e complemento *"
                  className="input-field py-1.5 text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={deliveryReference}
                    onChange={(e) => setDeliveryReference(e.target.value)}
                    placeholder="Ponto de referência"
                    className="input-field py-1.5 text-xs"
                  />
                  {paymentMethod === "DINHEIRO" && (
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={changeFor}
                      onChange={(e) => setChangeFor(e.target.value)}
                      placeholder="Troco p/ (R$)"
                      className="input-field py-1.5 text-xs"
                    />
                  )}
                </div>
              </div>
            )}

            <div className="mb-4 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <label className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--text-secondary)]">
                  <Award className="h-3.5 w-3.5 text-[var(--accent-primary)]" /> Clube Fidelidade
                </label>
                {selectedCustomer && (
                  <span className="font-mono-num rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                    {selectedCustomer.loyaltyPoints} pts ·{" "}
                    {getLoyaltyTier(selectedCustomer.loyaltyPoints)}
                  </span>
                )}
              </div>
              <select
                value={effectiveCustomerId ?? ""}
                onChange={(e) => {
                  onClearPreselectedCustomer();
                  setSelectedCustomerId(
                    e.target.value ? Number(e.target.value) : "",
                  );
                  setRedeemLoyaltyPoints(false);
                }}
                className="input-field mt-1.5 py-1.5 text-xs"
              >
                <option value="">Sem vínculo de fidelidade</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.loyaltyPoints} pts)
                  </option>
                ))}
              </select>
              {canRedeemLoyalty && (
                <label className="mt-2 flex cursor-pointer items-center justify-between rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1.5 font-semibold text-emerald-900 dark:text-emerald-200">
                  <span>Resgatar 10 pts (-R$ 15,00)</span>
                  <input
                    type="checkbox"
                    checked={effectiveRedeem}
                    onChange={(e) => setRedeemLoyaltyPoints(e.target.checked)}
                    className="accent-emerald-600"
                  />
                </label>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border-warm)] bg-[var(--bg-canvas)] p-6 text-center text-xs text-[var(--text-secondary)]">
                Clique nos produtos ao lado para adicionar ao carrinho ou lançar na
                comanda da mesa.
              </div>
            ) : (
              <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
                {cart.map((line) => (
                  <div
                    key={line.product.id}
                    className="rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">
                          {line.product.name}
                        </p>
                        <p className="font-mono-num text-[11px] text-[var(--text-secondary)]">
                          {formatBRL(line.product.price)} / {line.product.unit}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setItemQty(line.product.id, 0)}
                        className="text-[var(--text-secondary)] hover:text-red-700"
                        aria-label="Remover item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {line.product.unit === "KG" && (
                      <div className="mt-2 flex gap-1.5">
                        {[0.2, 0.5, 1].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setItemQty(line.product.id, preset)}
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              line.qty === preset
                                ? "bg-[var(--accent-primary)] text-white"
                                : "border border-[var(--border-warm)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                            }`}
                          >
                            {preset === 1 ? "1kg" : `${preset * 1000}g`}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setItemQty(
                              line.product.id,
                              Number(
                                (
                                  line.qty -
                                  (line.product.unit === "KG" ? 0.1 : 1)
                                ).toFixed(3),
                              ),
                            )
                          }
                          className="icon-btn p-1"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          type="number"
                          step={line.product.unit === "KG" ? "0.05" : "1"}
                          min="0.05"
                          value={line.qty}
                          onChange={(e) =>
                            setItemQty(
                              line.product.id,
                              Math.max(0.05, Number(e.target.value) || 0),
                            )
                          }
                          className="input-field font-mono-num w-16 px-2 py-1 text-center text-xs font-bold"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setItemQty(
                              line.product.id,
                              Number(
                                (
                                  line.qty +
                                  (line.product.unit === "KG" ? 0.1 : 1)
                                ).toFixed(3),
                              ),
                            )
                          }
                          className="icon-btn p-1"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="font-mono-num text-xs font-bold text-[var(--text-primary)]">
                        {formatBRL(line.qty * line.product.price)}
                      </span>
                    </div>

                    <input
                      type="text"
                      value={line.notes}
                      onChange={(e) => setItemNotes(line.product.id, e.target.value)}
                      placeholder="Obs (ex: fatiado, sem açúcar)..."
                      className="input-field mt-2 px-2.5 py-1 text-[11px]"
                    />
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Observação geral do pedido..."
                  className="input-field py-2 text-xs"
                />
                {effectiveMode !== "MESA" && (
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <Tag className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        placeholder="Cupom (ex: FORNO10)"
                        className="input-field font-mono-num py-1.5 pl-8 text-xs uppercase"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={validateCoupon}
                      className="rounded-lg border border-[var(--border-warm)] bg-[var(--bg-canvas)] px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
                    >
                      Aplicar
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 space-y-2 border-t border-[var(--border-warm)] pt-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Subtotal</span>
                <span className="font-mono-num font-semibold">
                  {formatBRL(totals.subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--text-secondary)]">Desconto (R$)</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="input-field font-mono-num w-24 px-2 py-1 text-right text-xs font-semibold"
                />
              </div>
              {appliedCoupon && (
                <div className="flex items-center justify-between font-semibold text-emerald-600">
                  <span>Cupom {appliedCoupon.code}</span>
                  <span className="font-mono-num">
                    {appliedCoupon.freeDelivery
                      ? "Frete Grátis"
                      : `- ${formatBRL(appliedCoupon.discount)}`}
                  </span>
                </div>
              )}
              {effectiveRedeem && (
                <div className="flex items-center justify-between font-semibold text-emerald-600">
                  <span>Desconto Fidelidade (10 pts)</span>
                  <span className="font-mono-num">- R$ 15,00</span>
                </div>
              )}
              {totals.serviceFee > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">
                    Taxa de Serviço ({storeSettings?.defaultServiceFeePct ?? 10}%)
                  </span>
                  <span className="font-mono-num font-semibold">
                    {formatBRL(totals.serviceFee)}
                  </span>
                </div>
              )}
              {isDelivery && (
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">
                    Taxa de Entrega ({selectedZone?.name ?? "—"})
                  </span>
                  <span className="font-mono-num font-semibold text-emerald-600">
                    {totals.deliveryFee === 0 ? "Grátis" : formatBRL(totals.deliveryFee)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-[var(--border-warm)] pt-2 text-base font-bold text-[var(--text-primary)]">
                <span>Total</span>
                <span className="font-mono-num text-[var(--accent-primary)]">
                  {formatBRL(totals.total)}
                </span>
              </div>
              {minMissing > 0 && (
                <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900">
                  Mínimo para {selectedZone?.name}: {formatBRL(selectedZone?.minOrder ?? 0)} (faltam{" "}
                  {formatBRL(minMissing)}).
                </p>
              )}
            </div>

            {effectiveMode !== "MESA" && (
              <div className="mt-3 space-y-2.5">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase text-[var(--text-secondary)]">
                    {isDeliveryChannel
                      ? "Pagamento na Entrega / Retirada"
                      : "Forma de Pagamento (Balcão)"}
                  </label>
                  <div className="grid grid-cols-5 gap-1">
                    {(["PIX", "CREDITO", "DEBITO", "DINHEIRO", "MISTO"] as const).map(
                      (pm) => {
                        if (isDeliveryChannel && pm === "MISTO") return null;
                        return (
                          <button
                            key={pm}
                            type="button"
                            onClick={() => {
                              setPaymentMethod(pm);
                              if (pm === "MISTO" && totals.total > 0) {
                                const half = roundMoney(totals.total / 2);
                                setSplitParts([
                                  { method: "PIX", amount: half },
                                  {
                                    method: "CREDITO",
                                    amount: roundMoney(totals.total - half),
                                  },
                                ]);
                              }
                            }}
                            className={`rounded-xl py-1.5 text-[10px] font-bold transition ${
                              paymentMethod === pm
                                ? "bg-[var(--accent-primary)] text-white"
                                : "border border-[var(--border-warm)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]"
                            }`}
                          >
                            {pm}
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>

                {!isDeliveryChannel && paymentMethod === "MISTO" && (
                  <div className="space-y-2 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-2.5 text-xs">
                    <div className="flex items-center justify-between font-bold">
                      <span className="inline-flex items-center gap-1">
                        <Split className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                        Pagamento Dividido
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSplitParts((prev) => [
                            ...prev,
                            { method: "DINHEIRO", amount: Math.max(0, splitValidation.remaining) },
                          ])
                        }
                        className="text-[11px] text-[var(--accent-primary)] hover:underline"
                      >
                        + Parcela
                      </button>
                    </div>
                    {splitParts.map((part, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <select
                          value={part.method}
                          onChange={(e) =>
                            setSplitParts((prev) =>
                              prev.map((p, i) =>
                                i === idx
                                  ? {
                                      ...p,
                                      method: e.target.value as SplitPaymentPart["method"],
                                    }
                                  : p,
                              ),
                            )
                          }
                          className="input-field py-1 text-[11px]"
                        >
                          <option value="PIX">PIX</option>
                          <option value="CREDITO">Crédito</option>
                          <option value="DEBITO">Débito</option>
                          <option value="DINHEIRO">Dinheiro</option>
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={part.amount}
                          onChange={(e) =>
                            setSplitParts((prev) =>
                              prev.map((p, i) =>
                                i === idx ? { ...p, amount: Number(e.target.value) || 0 } : p,
                              ),
                            )
                          }
                          className="input-field font-mono-num w-24 py-1 text-right text-[11px]"
                        />
                        {splitParts.length > 2 && (
                          <button
                            type="button"
                            onClick={() =>
                              setSplitParts((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="icon-btn p-1 text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    <p
                      className={`text-[11px] font-semibold ${
                        splitValidation.valid ? "text-emerald-600" : "text-amber-600"
                      }`}
                    >
                      {splitValidation.valid
                        ? "Valores fecham com o total!"
                        : splitValidation.error}
                    </p>
                  </div>
                )}

                {!isDeliveryChannel && paymentMethod === "DINHEIRO" && totals.total > 0 && (
                  <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-2.5 text-xs text-emerald-950 dark:text-emerald-100">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <Banknote className="h-3.5 w-3.5" /> Recebido (R$)
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        placeholder={totals.total.toFixed(2)}
                        className="input-field font-mono-num w-24 py-1 text-right text-xs font-bold"
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between font-bold">
                      <span>Troco</span>
                      <span className="font-mono-num">{formatBRL(cashChange)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2">
              {effectiveMode === "MESA" ? (
                <button
                  type="button"
                  disabled={cart.length === 0 || submitting || effectiveTableNumber === null}
                  onClick={() => handleSubmit(false)}
                  className="btn-primary flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  <Receipt className="h-4 w-4" />
                  Lançar na {tables.find((t) => t.number === effectiveTableNumber)?.name} & KDS
                </button>
              ) : isDeliveryChannel ? (
                <>
                  <button
                    type="button"
                    disabled={cart.length === 0 || submitting || minMissing > 0}
                    onClick={() => handleSubmit(false)}
                    className="btn-primary flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
                  >
                    <Bike className="h-4 w-4" />
                    {isDelivery
                      ? "Registrar Delivery & Enviar p/ KDS"
                      : "Registrar Retirada & KDS"}
                  </button>
                  <button
                    type="button"
                    disabled={cart.length === 0 || submitting || minMissing > 0}
                    onClick={() => handleSubmit(true)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)] disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Já Pago (PIX/Cartão antecipado)
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={cart.length === 0 || submitting}
                    onClick={() => handleSubmit(true)}
                    className="btn-primary flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Finalizar Venda & Emitir Cupom
                  </button>
                  <button
                    type="button"
                    disabled={cart.length === 0 || submitting}
                    onClick={() => handleSubmit(false)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)] disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Enviar apenas para KDS (Pagar depois)
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
