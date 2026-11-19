"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bike,
  CheckCircle2,
  Clock,
  Coffee,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import {
  calculateOrderTotals,
  estimateDeliveryMinutes,
  formatBRL,
  FREE_DELIVERY_ABOVE,
  missingForMinimumOrder,
  resolveDeliveryFee,
} from "@/lib/domain";
import type { DeliveryZoneDto } from "@/types/erp";

interface StoreProduct {
  id: number;
  name: string;
  description: string;
  price: number;
  unit: string;
  prepTimeMinutes: number;
  isFeatured: boolean;
}

interface StoreCategory {
  id: number;
  name: string;
  sector: string;
  products: StoreProduct[];
}

interface DeliveryStorefrontClientProps {
  categories: StoreCategory[];
  zones: DeliveryZoneDto[];
}

interface CartLine {
  product: StoreProduct;
  qty: number;
  notes: string;
}

export function DeliveryStorefrontClient({
  categories,
  zones,
}: DeliveryStorefrontClientProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"DELIVERY" | "RETIRADA">("DELIVERY");
  const [activeCategory, setActiveCategory] = useState<number | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpenMobile, setCartOpenMobile] = useState(false);

  const [zoneId, setZoneId] = useState<number>(zones[0]?.id ?? 0);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [reference, setReference] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CREDITO" | "DEBITO" | "DINHEIRO">("PIX");
  const [changeFor, setChangeFor] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedZone = useMemo(
    () => zones.find((z) => z.id === zoneId) ?? null,
    [zones, zoneId],
  );

  const visibleCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories
      .filter((c) => activeCategory === "ALL" || c.id === activeCategory)
      .map((c) => ({
        ...c,
        products: c.products.filter(
          (p) =>
            !q ||
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q),
        ),
      }))
      .filter((c) => c.products.length > 0);
  }, [categories, activeCategory, search]);

  const subtotal = useMemo(
    () =>
      cart.reduce((s, l) => s + l.qty * l.product.price, 0),
    [cart],
  );

  const deliveryFee = useMemo(() => {
    if (mode === "RETIRADA" || !selectedZone) return 0;
    return resolveDeliveryFee({
      zoneFee: selectedZone.fee,
      subtotal,
      freeAbove: FREE_DELIVERY_ABOVE,
    });
  }, [mode, selectedZone, subtotal]);

  const totals = useMemo(
    () =>
      calculateOrderTotals({
        items: cart.map((c) => ({ qty: c.qty, unitPrice: c.product.price })),
        deliveryFee,
      }),
    [cart, deliveryFee],
  );

  const minMissing = useMemo(() => {
    if (mode === "RETIRADA" || !selectedZone) return 0;
    return missingForMinimumOrder(totals.subtotal, selectedZone.minOrder);
  }, [mode, selectedZone, totals.subtotal]);

  const freeShippingRemaining = Math.max(0, FREE_DELIVERY_ABOVE - totals.subtotal);
  const freeShippingPct = Math.min(100, Math.round((totals.subtotal / FREE_DELIVERY_ABOVE) * 100));

  const etaMinutes = useMemo(
    () =>
      estimateDeliveryMinutes({
        prepMinutes: cart.map((c) => c.product.prepTimeMinutes),
        zoneEtaMinutes: selectedZone?.etaMinutes,
        isPickup: mode === "RETIRADA",
      }),
    [cart, selectedZone, mode],
  );

  const totalItemsCount = cart.reduce((s, l) => s + l.qty, 0);

  function addProduct(product: StoreProduct) {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        return prev.map((line, i) =>
          i === idx
            ? { ...line, qty: Number((line.qty + (product.unit === "KG" ? 0.5 : 1)).toFixed(3)) }
            : line,
        );
      }
      return [...prev, { product, qty: product.unit === "KG" ? 0.5 : 1, notes: "" }];
    });
  }

  function updateQty(productId: number, nextQty: number) {
    if (nextQty <= 0) {
      setCart((prev) => prev.filter((l) => l.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((l) => (l.product.id === productId ? { ...l, qty: nextQty } : l)),
    );
  }

  function updateNotes(productId: number, itemNotes: string) {
    setCart((prev) =>
      prev.map((l) => (l.product.id === productId ? { ...l, notes: itemNotes } : l)),
    );
  }

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (cart.length === 0 || submitting || minMissing > 0) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: mode,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          paymentMethod,
          notes: notes.trim() || undefined,
          delivery:
            mode === "DELIVERY"
              ? {
                  zoneId: selectedZone?.id,
                  address: address.trim(),
                  neighborhood: selectedZone?.name,
                  reference: reference.trim() || undefined,
                  changeFor:
                    paymentMethod === "DINHEIRO" && Number(changeFor) > 0
                      ? Number(changeFor)
                      : undefined,
                }
              : undefined,
          items: cart.map((l) => ({
            productId: l.product.id,
            qty: l.qty,
            notes: l.notes.trim() || undefined,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Não foi possível enviar o pedido.");
        return;
      }
      if (json.trackingUrl) {
        router.push(json.trackingUrl);
      }
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  const cartPanel = (
    <form onSubmit={handleCheckout} className="space-y-4">
      <div className="flex items-center justify-between border-b border-[#eeeeea] pb-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-[#d95d24]" />
          <h2 className="font-display text-lg font-bold">Seu Pedido</h2>
        </div>
        {cart.length > 0 && (
          <span className="font-mono-num chip bg-amber-100 text-amber-900">
            <Clock className="h-3 w-3" /> ~{etaMinutes} min
          </span>
        )}
      </div>

      {/* Mode Switcher */}
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#eeeeea] p-1">
        <button
          type="button"
          onClick={() => setMode("DELIVERY")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
            mode === "DELIVERY" ? "bg-[#121417] text-white shadow" : "text-[#5a5f67]"
          }`}
        >
          <Bike className="h-4 w-4" /> Delivery
        </button>
        <button
          type="button"
          onClick={() => setMode("RETIRADA")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
            mode === "RETIRADA" ? "bg-[#121417] text-white shadow" : "text-[#5a5f67]"
          }`}
        >
          <Store className="h-4 w-4" /> Retirar no Balcão
        </button>
      </div>

      {/* Free Shipping Bar */}
      {mode === "DELIVERY" && (
        <div className="rounded-xl border border-[#e5e4df] bg-[#f6f6f3] p-2.5 text-[11px]">
          <div className="flex items-center justify-between font-semibold">
            <span className="inline-flex items-center gap-1 text-[#b84917]">
              <Sparkles className="h-3.5 w-3.5 text-[#e09132]" />
              {freeShippingRemaining === 0
                ? "Frete grátis desbloqueado!"
                : `Faltam ${formatBRL(freeShippingRemaining)} para frete grátis`}
            </span>
            <span className="font-mono-num text-[#5a5f67]">{freeShippingPct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e5e4df]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#e09132] to-[#15803d] transition-all"
              style={{ width: `${freeShippingPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Cart Items */}
      {cart.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#e5e4df] bg-[#f6f6f3] p-5 text-center text-xs text-[#5a5f67]">
          Escolha itens do cardápio ao lado para montar seu pedido.
        </p>
      ) : (
        <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
          {cart.map((line) => (
            <div
              key={line.product.id}
              className="rounded-xl border border-[#eeeeea] bg-[#f6f6f3] p-2.5 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-bold">{line.product.name}</p>
                  <p className="font-mono-num text-[11px] text-[#5a5f67]">
                    {formatBRL(line.product.price)}/{line.product.unit}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateQty(line.product.id, 0)}
                  className="text-[#5a5f67] hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      updateQty(
                        line.product.id,
                        Number((line.qty - (line.product.unit === "KG" ? 0.1 : 1)).toFixed(3)),
                      )
                    }
                    className="icon-btn p-1"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="font-mono-num min-w-[2.5rem] text-center font-bold">
                    {line.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateQty(
                        line.product.id,
                        Number((line.qty + (line.product.unit === "KG" ? 0.1 : 1)).toFixed(3)),
                      )
                    }
                    className="icon-btn p-1"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <span className="font-mono-num font-bold text-[#d95d24]">
                  {formatBRL(line.qty * line.product.price)}
                </span>
              </div>
              <input
                type="text"
                value={line.notes}
                onChange={(e) => updateNotes(line.product.id, e.target.value)}
                placeholder="Observação do item..."
                className="input-field mt-1.5 bg-white py-1 text-[11px]"
              />
            </div>
          ))}
        </div>
      )}

      {/* Customer & Address Fields */}
      <div className="space-y-2.5 border-t border-[#eeeeea] pt-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="field-label">
            Seu nome *
            <input
              required
              minLength={2}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ex: Maria Clara"
              className="input-field"
            />
          </label>
          <label className="field-label">
            WhatsApp (com DDD) *
            <input
              required
              minLength={10}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="input-field"
            />
          </label>
        </div>

        {mode === "DELIVERY" && (
          <>
            <label className="field-label">
              Bairro / Região *
              <select
                value={zoneId}
                onChange={(e) => setZoneId(Number(e.target.value))}
                className="input-field"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} — {formatBRL(z.fee)} · ~{z.etaMinutes} min (mín. {formatBRL(z.minOrder)})
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Endereço completo (Rua, nº, apto) *
              <input
                required
                minLength={5}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua das Flores, 120 - Apto 42"
                className="input-field"
              />
            </label>
            <label className="field-label">
              Ponto de referência
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Portão preto, próximo à praça..."
                className="input-field"
              />
            </label>
          </>
        )}

        <div className="space-y-1.5">
          <span className="field-label">Pagamento na entrega / retirada</span>
          <div className="grid grid-cols-4 gap-1.5">
            {(["PIX", "CREDITO", "DEBITO", "DINHEIRO"] as const).map((pm) => (
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
            ))}
          </div>
          {paymentMethod === "DINHEIRO" && (
            <label className="field-label mt-1">
              Troco para quanto? (R$)
              <input
                type="number"
                min="0"
                step="5"
                value={changeFor}
                onChange={(e) => setChangeFor(e.target.value)}
                placeholder="Ex: 100"
                className="input-field"
              />
            </label>
          )}
        </div>

        <label className="field-label">
          Observações gerais
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Campainha, talheres, embalagem..."
            className="input-field"
          />
        </label>
      </div>

      {/* Totals */}
      <div className="space-y-1.5 border-t border-[#eeeeea] pt-3 text-xs">
        <div className="flex justify-between text-[#5a5f67]">
          <span>Subtotal</span>
          <span className="font-mono-num font-semibold">{formatBRL(totals.subtotal)}</span>
        </div>
        {mode === "DELIVERY" && (
          <div className="flex justify-between text-[#5a5f67]">
            <span>Taxa de entrega ({selectedZone?.name ?? "—"})</span>
            <span className="font-mono-num font-semibold">
              {totals.deliveryFee === 0 ? "Grátis" : formatBRL(totals.deliveryFee)}
            </span>
          </div>
        )}
        <div className="flex justify-between border-t border-[#eeeeea] pt-2 text-base font-bold">
          <span>Total</span>
          <span className="font-mono-num text-[#d95d24]">{formatBRL(totals.total)}</span>
        </div>
      </div>

      {minMissing > 0 && cart.length > 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          Pedido mínimo para {selectedZone?.name}: {formatBRL(selectedZone?.minOrder ?? 0)} (faltam{" "}
          {formatBRL(minMissing)}).
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-900">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={cart.length === 0 || minMissing > 0 || submitting}
        className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold disabled:opacity-50"
      >
        <CheckCircle2 className="h-4 w-4" />
        {submitting ? "Enviando pedido..." : `Confirmar Pedido · ${formatBRL(totals.total)}`}
      </button>
    </form>
  );

  return (
    <div className="min-h-screen pb-24 lg:pb-10">
      {/* Top Banner */}
      <header className="cafe-sidebar sticky top-0 z-30 text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#e09132] to-[#d95d24]">
              <Coffee className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold leading-tight sm:text-xl">
                Forno & Mesa · Delivery
              </h1>
              <p className="flex items-center gap-2 text-[11px] text-[#9ca3af]">
                <span className="inline-flex items-center gap-1">
                  <Truck className="h-3 w-3 text-[#e09132]" /> Frete grátis acima de{" "}
                  {formatBRL(FREE_DELIVERY_ABOVE)}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCartOpenMobile(true)}
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold lg:hidden"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="font-mono-num">{totalItemsCount}</span>
            <span>· {formatBRL(totals.total)}</span>
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12">
        {/* Catalog */}
        <div className="space-y-5 lg:col-span-7 xl:col-span-8">
          <div className="card-bistro space-y-3 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#5a5f67]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar pães artesanais, doces, cafés, pratos..."
                className="input-field pl-9"
              />
            </div>

            <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setActiveCategory("ALL")}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  activeCategory === "ALL"
                    ? "bg-[#121417] text-white"
                    : "bg-[#eeeeea] text-[#5a5f67]"
                }`}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                    activeCategory === cat.id
                      ? "bg-[#121417] text-white"
                      : "bg-[#eeeeea] text-[#5a5f67]"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {visibleCategories.map((cat) => (
            <section key={cat.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">{cat.name}</h2>
                <span className="chip bg-[#eeeeea] text-[#5a5f67]">{cat.sector}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {cat.products.map((prod) => {
                  const inCart = cart.find((c) => c.product.id === prod.id);
                  return (
                    <div
                      key={prod.id}
                      className="card-bistro card-bistro-interactive flex flex-col justify-between p-4"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-[#121417]">{prod.name}</h3>
                          {prod.isFeatured && (
                            <span className="chip bg-amber-100 text-amber-900">Destaque</span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-[#5a5f67]">
                          {prod.description}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-[#eeeeea] pt-3">
                        <div>
                          <span className="font-mono-num text-base font-bold text-[#121417]">
                            {formatBRL(prod.price)}
                          </span>
                          <span className="text-[11px] text-[#5a5f67]">/{prod.unit}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => addProduct(prod)}
                          className="btn-primary inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {inCart ? `Adicionar (${inCart.qty})` : "Adicionar"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Desktop Cart */}
        <aside className="hidden lg:col-span-5 lg:block xl:col-span-4">
          <div className="card-bistro sticky top-20 p-5">{cartPanel}</div>
        </aside>
      </div>

      {/* Mobile Floating Checkout Bar */}
      {cart.length > 0 && !cartOpenMobile && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e5e4df] bg-white/95 p-3 backdrop-blur-md lg:hidden">
          <button
            type="button"
            onClick={() => setCartOpenMobile(true)}
            className="btn-primary flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-bold"
          >
            <span className="inline-flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Ver sacola ({totalItemsCount})
            </span>
            <span className="font-mono-num">{formatBRL(totals.total)}</span>
          </button>
        </div>
      )}

      {/* Mobile Drawer */}
      {cartOpenMobile && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-xs lg:hidden">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl">
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setCartOpenMobile(false)}
                className="icon-btn"
                aria-label="Fechar sacola"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {cartPanel}
          </div>
        </div>
      )}
    </div>
  );
}
