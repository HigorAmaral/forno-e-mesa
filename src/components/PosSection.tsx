"use client";

import { useMemo, useState } from "react";
import {
  Bike,
  Award,
  Banknote,
  CheckCircle2,
  Minus,
  Plus,
  Receipt,
  Scale,
  Search,
  Send,
  ShoppingCart,
  Sparkles,
  Store,
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
} from "@/lib/domain";
import type {
  CustomerProfileDto,
  DeliveryZoneDto,
  OrderDto,
  ProductDto,
  TableWithOrdersDto,
} from "@/types/erp";

interface PosSectionProps {
  products: ProductDto[];
  tables: TableWithOrdersDto[];
  customers: CustomerProfileDto[];
  deliveryZones: DeliveryZoneDto[];
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
  const [orderNotes, setOrderNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "PIX" | "CREDITO" | "DEBITO" | "DINHEIRO"
  >("PIX");
  const [cashReceived, setCashReceived] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const preTotals = useMemo(
    () =>
      calculateOrderTotals({
        items: cart.map((c) => ({ qty: c.qty, unitPrice: c.product.price })),
        discount: (Number(discount) || 0) + (effectiveRedeem ? 15 : 0),
      }),
    [cart, discount, effectiveRedeem],
  );

  const deliveryFee = useMemo(() => {
    if (!isDelivery || !selectedZone || cart.length === 0) return 0;
    return resolveDeliveryFee({
      zoneFee: selectedZone.fee,
      subtotal: Math.max(0, preTotals.subtotal - preTotals.discount),
      freeAbove: FREE_DELIVERY_ABOVE,
    });
  }, [isDelivery, selectedZone, cart.length, preTotals.subtotal, preTotals.discount]);

  const totals = useMemo(
    () =>
      calculateOrderTotals({
        items: cart.map((c) => ({ qty: c.qty, unitPrice: c.product.price })),
        discount: (Number(discount) || 0) + (effectiveRedeem ? 15 : 0),
        applyServiceFee: effectiveTableNumber !== null,
        deliveryFee,
      }),
    [cart, discount, effectiveRedeem, effectiveTableNumber, deliveryFee],
  );

  const minMissing = useMemo(() => {
    if (!isDelivery || !selectedZone || cart.length === 0) return 0;
    return missingForMinimumOrder(totals.subtotal, selectedZone.minOrder);
  }, [isDelivery, selectedZone, cart.length, totals.subtotal]);

  const cashChange = useMemo(() => {
    const rec = Number(cashReceived) || 0;
    return calculateCashChange(totals.total, rec);
  }, [totals.total, cashReceived]);

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

  async function handleSubmit(payNow: boolean) {
    if (cart.length === 0 || submitting || minMissing > 0) return;
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
          applyServiceFee: isTable,
          notes: orderNotes.trim() || undefined,
          payNow: !isTable && payNow,
          paymentMethod: !isTable && (payNow || isDeliveryChannel) ? paymentMethod : undefined,
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
      onClearPreselectedTable();
      onClearPreselectedCustomer();
      onClearPreselectedMode?.();
      await onOrderCreated(json.order, payNow || isDeliveryChannel);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-fade-in grid gap-5 lg:grid-cols-12">
      {/* Left Catalog */}
      <div className="min-w-0 space-y-4 lg:col-span-7 xl:col-span-8">
        <div className="card-bistro flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#5a5f67]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pão, bolo, prato, bebida ou código..."
              className="w-full rounded-xl border border-[#e5e4df] bg-[#f6f6f3] py-2 pr-3 pl-9 text-sm outline-none focus:border-[#d95d24]"
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
                    ? "bg-[#121417] text-white"
                    : "bg-[#eeeeea] text-[#5a5f67] hover:text-[#121417]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#e5e4df] bg-gradient-to-r from-[#fff8ee] to-[#f7ede0] px-4 py-2.5 text-xs">
          <span className="inline-flex items-center gap-1.5 font-bold text-[#b84917]">
            <Sparkles className="h-3.5 w-3.5 text-[#d95d24]" />
            Combos Rápidos (desc. R$ 5):
          </span>
          <button
            type="button"
            onClick={() => applyCombo("CAFE_MANHA")}
            className="rounded-lg border border-[#e09132]/40 bg-white px-2.5 py-1 font-semibold text-[#121417] transition hover:border-[#d95d24] hover:bg-[#d95d24] hover:text-white"
          >
            + Café da Manhã (Croissant + Cappuccino)
          </button>
          <button
            type="button"
            onClick={() => applyCombo("BISTRO")}
            className="rounded-lg border border-[#e09132]/40 bg-white px-2.5 py-1 font-semibold text-[#121417] transition hover:border-[#d95d24] hover:bg-[#d95d24] hover:text-white"
          >
            + Almoço Bistrô (Risoto + Suco)
          </button>
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
                  <span className="rounded-md bg-[#eeeeea] px-2 py-0.5 text-[10px] font-bold text-[#5a5f67]">
                    {product.category.sector} · {product.prepStation}
                  </span>
                  {product.unit === "KG" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                      <Scale className="h-3 w-3" /> Balança KG
                    </span>
                  )}
                </div>
                <h3 className="mt-2.5 font-semibold text-[#121417] group-hover:text-[#d95d24]">
                  {product.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-[#5a5f67]">
                  {product.description}
                </p>
              </div>

              <div className="mt-3 flex items-end justify-between border-t border-[#eeeeea] pt-2.5">
                <span className="font-mono-num text-base font-bold text-[#121417]">
                  {formatBRL(product.price)}
                  <span className="text-[11px] font-normal text-[#5a5f67]">
                    /{product.unit}
                  </span>
                </span>
                <span
                  className={`text-[11px] font-semibold ${
                    product.stockQty <= product.minStockQty
                      ? "text-amber-700"
                      : "text-[#5a5f67]"
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
      <div className="lg:col-span-5 xl:col-span-4">
        <div className="card-bistro sticky top-4 p-5">
          <div className="mb-4 flex items-center justify-between border-b border-[#eeeeea] pb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-[#d95d24]" />
              <h2 className="font-display text-lg font-bold text-[#121417]">
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
          <div className="mb-3 grid grid-cols-4 gap-1 rounded-xl bg-[#eeeeea] p-1">
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
                    active ? "bg-[#121417] text-white shadow" : "text-[#5a5f67] hover:text-[#121417]"
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
                <label className="mb-1 block text-[11px] font-semibold uppercase text-[#5a5f67]">
                  Mesa
                </label>
                <select
                  value={effectiveTableNumber ?? ""}
                  onChange={(e) => {
                    onClearPreselectedTable();
                    setTargetTableNumber(
                      e.target.value ? Number(e.target.value) : "",
                    );
                  }}
                  className="w-full rounded-xl border border-[#e5e4df] bg-[#f6f6f3] px-3 py-2 text-xs font-medium outline-none focus:border-[#d95d24]"
                >
                  <option value="">Selecione a mesa...</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.number}>
                      {t.name} ({t.status})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className={effectiveMode === "MESA" ? "" : isDeliveryChannel ? "" : "sm:col-span-2"}>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-[#5a5f67]">
                {isDeliveryChannel ? "Nome do Cliente *" : "Cliente / Identificação"}
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={selectedCustomer ? selectedCustomer.name : "Ex: João / Balcão"}
                className="w-full rounded-xl border border-[#e5e4df] bg-[#f6f6f3] px-3 py-2 text-xs outline-none focus:border-[#d95d24]"
              />
            </div>
            {isDeliveryChannel && (
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-[#5a5f67]">
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder={selectedCustomer?.phone ?? "(11) 99999-9999"}
                  className="w-full rounded-xl border border-[#e5e4df] bg-[#f6f6f3] px-3 py-2 text-xs outline-none focus:border-[#d95d24]"
                />
              </div>
            )}
          </div>

          {isDelivery && (
            <div className="mb-3 space-y-2 rounded-xl border border-orange-200 bg-orange-50/50 p-3 text-xs">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-[#5a5f67]">
                  Bairro / Região de Entrega
                </label>
                <select
                  value={selectedZone?.id ?? ""}
                  onChange={(e) => setDeliveryZoneId(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#e5e4df] bg-white px-2.5 py-1.5 text-xs font-medium"
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
                className="w-full rounded-lg border border-[#e5e4df] bg-white px-2.5 py-1.5 text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={deliveryReference}
                  onChange={(e) => setDeliveryReference(e.target.value)}
                  placeholder="Ponto de referência"
                  className="w-full rounded-lg border border-[#e5e4df] bg-white px-2.5 py-1.5 text-xs"
                />
                {paymentMethod === "DINHEIRO" && (
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={changeFor}
                    onChange={(e) => setChangeFor(e.target.value)}
                    placeholder="Troco p/ (R$)"
                    className="w-full rounded-lg border border-[#e5e4df] bg-white px-2.5 py-1.5 text-xs"
                  />
                )}
              </div>
            </div>
          )}

          <div className="mb-4 rounded-xl border border-[#e5e4df] bg-[#f6f6f3] p-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-1 text-[11px] font-bold text-[#5a5f67]">
                <Award className="h-3.5 w-3.5 text-[#d95d24]" /> Clube Fidelidade
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
              className="mt-1.5 w-full rounded-lg border border-[#e5e4df] bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#d95d24]"
            >
              <option value="">Sem vínculo de fidelidade</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.loyaltyPoints} pts)
                </option>
              ))}
            </select>
            {canRedeemLoyalty && (
              <label className="mt-2 flex cursor-pointer items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-semibold text-emerald-900">
                <span>Resgatar 10 pts (-R$ 15,00)</span>
                <input
                  type="checkbox"
                  checked={effectiveRedeem}
                  onChange={(e) => setRedeemLoyaltyPoints(e.target.checked)}
                  className="accent-[#15803d]"
                />
              </label>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#e5e4df] bg-[#f6f6f3] p-6 text-center text-xs text-[#5a5f67]">
              Clique nos produtos ao lado para adicionar ao carrinho ou lançar na
              comanda da mesa.
            </div>
          ) : (
            <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
              {cart.map((line) => (
                <div
                  key={line.product.id}
                  className="rounded-xl border border-[#eeeeea] bg-[#f6f6f3] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-[#121417]">
                        {line.product.name}
                      </p>
                      <p className="font-mono-num text-[11px] text-[#5a5f67]">
                        {formatBRL(line.product.price)} / {line.product.unit}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setItemQty(line.product.id, 0)}
                      className="text-[#5a5f67] hover:text-red-700"
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
                              ? "bg-[#d95d24] text-white"
                              : "border border-[#e5e4df] bg-white text-[#5a5f67]"
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
                        className="rounded-lg border border-[#e5e4df] bg-white p-1 hover:bg-[#eeeeea]"
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
                        className="font-mono-num w-16 rounded-lg border border-[#e5e4df] bg-white px-2 py-1 text-center text-xs font-bold"
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
                        className="rounded-lg border border-[#e5e4df] bg-white p-1 hover:bg-[#eeeeea]"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="font-mono-num text-xs font-bold text-[#121417]">
                      {formatBRL(line.qty * line.product.price)}
                    </span>
                  </div>

                  <input
                    type="text"
                    value={line.notes}
                    onChange={(e) => setItemNotes(line.product.id, e.target.value)}
                    placeholder="Obs (ex: fatiado, sem açúcar)..."
                    className="mt-2 w-full rounded-lg border border-[#e5e4df] bg-white px-2.5 py-1 text-[11px] outline-none focus:border-[#d95d24]"
                  />
                </div>
              ))}
            </div>
          )}

          {cart.length > 0 && (
            <input
              type="text"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="Observação geral do pedido (embalagem, entrega)..."
              className="mt-3 w-full rounded-xl border border-[#e5e4df] bg-[#f6f6f3] px-3 py-2 text-xs outline-none focus:border-[#d95d24]"
            />
          )}

          <div className="mt-4 space-y-2 border-t border-[#eeeeea] pt-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#5a5f67]">Subtotal</span>
              <span className="font-mono-num font-semibold">
                {formatBRL(totals.subtotal)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#5a5f67]">Desconto (R$)</span>
              <input
                type="number"
                min="0"
                step="1"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="font-mono-num w-24 rounded-lg border border-[#e5e4df] bg-[#f6f6f3] px-2 py-1 text-right text-xs font-semibold"
              />
            </div>
            {effectiveRedeem && (
              <div className="flex items-center justify-between text-emerald-700 font-semibold">
                <span>Desconto Fidelidade (10 pts)</span>
                <span className="font-mono-num">- R$ 15,00</span>
              </div>
            )}
            {totals.serviceFee > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[#5a5f67]">Taxa de Serviço (10%)</span>
                <span className="font-mono-num font-semibold">
                  {formatBRL(totals.serviceFee)}
                </span>
              </div>
            )}
            {isDelivery && (
              <div className="flex items-center justify-between">
                <span className="text-[#5a5f67]">
                  Taxa de Entrega ({selectedZone?.name ?? "—"})
                </span>
                <span className="font-mono-num font-semibold text-[#15803d]">
                  {totals.deliveryFee === 0 ? "Grátis" : formatBRL(totals.deliveryFee)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-[#eeeeea] pt-2 text-base font-bold text-[#121417]">
              <span>Total</span>
              <span className="font-mono-num text-[#d95d24]">
                {formatBRL(totals.total)}
              </span>
            </div>
            {minMissing > 0 && (
              <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900">
                Mínimo para {selectedZone?.name}: {formatBRL(selectedZone?.minOrder ?? 0)} (faltam {formatBRL(minMissing)}).
              </p>
            )}
          </div>

          {effectiveMode !== "MESA" && (
            <div className="mt-3 space-y-2.5">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase text-[#5a5f67]">
                  {isDeliveryChannel ? "Pagamento na Entrega / Retirada" : "Forma de Pagamento (Balcão)"}
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["PIX", "CREDITO", "DEBITO", "DINHEIRO"] as const).map(
                    (pm) => (
                      <button
                        key={pm}
                        type="button"
                        onClick={() => setPaymentMethod(pm)}
                        className={`rounded-xl py-1.5 text-[11px] font-bold transition ${
                          paymentMethod === pm
                            ? "bg-[#121417] text-white"
                            : "border border-[#e5e4df] bg-[#f6f6f3] text-[#5a5f67]"
                        }`}
                      >
                        {pm}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {!isDeliveryChannel && paymentMethod === "DINHEIRO" && totals.total > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-900">
                      <Banknote className="h-3.5 w-3.5" /> Recebido (R$)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder={totals.total.toFixed(2)}
                      className="font-mono-num w-24 rounded-lg border border-emerald-300 bg-white px-2 py-1 text-right text-xs font-bold"
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between font-bold text-emerald-900">
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
                Lançar na{" "}
                {tables.find((t) => t.number === effectiveTableNumber)?.name} &
                KDS
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
                  {isDelivery ? "Registrar Delivery & Enviar p/ KDS" : "Registrar Retirada & KDS"}
                </button>
                <button
                  type="button"
                  disabled={cart.length === 0 || submitting || minMissing > 0}
                  onClick={() => handleSubmit(true)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#e5e4df] bg-[#f6f6f3] px-4 py-2.5 text-xs font-semibold text-[#121417] hover:bg-[#eeeeea] disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
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
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#e5e4df] bg-[#f6f6f3] px-4 py-2.5 text-xs font-semibold text-[#121417] hover:bg-[#eeeeea] disabled:opacity-50"
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
  );
}
