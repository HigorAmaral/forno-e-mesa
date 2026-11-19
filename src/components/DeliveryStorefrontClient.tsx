"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bike,
  CakeSlice,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coffee,
  Croissant,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Star,
  Store,
  Trash2,
  UtensilsCrossed,
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

function SectorThumb({ sector }: { sector: string }) {
  const s = sector.toUpperCase();
  if (s.includes("PADARIA") || s.includes("PAO")) {
    return (
      <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700">
        <Croissant className="h-7 w-7 text-[#ea1d2c]" />
        <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
          Padaria
        </span>
      </div>
    );
  }
  if (s.includes("CONFEITARIA") || s.includes("BOLO") || s.includes("DOCE")) {
    return (
      <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700">
        <CakeSlice className="h-7 w-7 text-[#ea1d2c]" />
        <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
          Doces
        </span>
      </div>
    );
  }
  if (s.includes("CAFE") || s.includes("BEBIDA")) {
    return (
      <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700">
        <Coffee className="h-7 w-7 text-[#ea1d2c]" />
        <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
          Cafeteria
        </span>
      </div>
    );
  }
  return (
    <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700">
      <UtensilsCrossed className="h-7 w-7 text-[#ea1d2c]" />
      <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
        Bistrô
      </span>
    </div>
  );
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

  const [bagOpen, setBagOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{
    product: StoreProduct;
    sector: string;
  } | null>(null);
  const [modalQty, setModalQty] = useState(1);
  const [modalNotes, setModalNotes] = useState("");

  const [zoneId, setZoneId] = useState<number>(zones[0]?.id ?? 0);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [reference, setReference] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "PIX" | "CREDITO" | "DEBITO" | "DINHEIRO"
  >("PIX");
  const [changeFor, setChangeFor] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedZone = useMemo(
    () => zones.find((z) => z.id === zoneId) ?? null,
    [zones, zoneId],
  );

  const featuredProducts = useMemo(() => {
    const list: Array<{ product: StoreProduct; sector: string }> = [];
    for (const cat of categories) {
      for (const prod of cat.products) {
        if (prod.isFeatured) {
          list.push({ product: prod, sector: cat.sector });
        }
      }
    }
    return list;
  }, [categories]);

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
    () => cart.reduce((s, l) => s + l.qty * l.product.price, 0),
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
  const freeShippingPct = Math.min(
    100,
    Math.round((totals.subtotal / FREE_DELIVERY_ABOVE) * 100),
  );

  const etaMinutes = useMemo(
    () =>
      estimateDeliveryMinutes({
        prepMinutes: cart.map((c) => c.product.prepTimeMinutes),
        zoneEtaMinutes: selectedZone?.etaMinutes,
        isPickup: mode === "RETIRADA",
      }),
    [cart, selectedZone, mode],
  );

  const totalItemsCount = cart.reduce(
    (s, l) => s + (l.product.unit === "KG" ? 1 : l.qty),
    0,
  );

  function openProductModal(product: StoreProduct, sector: string) {
    setSelectedProduct({ product, sector });
    setModalQty(product.unit === "KG" ? 0.5 : 1);
    setModalNotes("");
  }

  function addProductDirect(product: StoreProduct, qtyToAdd?: number, itemNotes = "") {
    const step = qtyToAdd ?? (product.unit === "KG" ? 0.5 : 1);
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        return prev.map((line, i) =>
          i === idx
            ? {
                ...line,
                qty: Number((line.qty + step).toFixed(3)),
                notes: itemNotes.trim() ? itemNotes.trim() : line.notes,
              }
            : line,
        );
      }
      return [...prev, { product, qty: step, notes: itemNotes.trim() }];
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

  return (
    <div className="min-h-screen bg-[#f7f7f7] text-zinc-900 pb-24 lg:pb-12">
      {/* iFood-Style Top Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {/* Brand & Location Pill */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ea1d2c] text-white">
              <Coffee className="h-5 w-5" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold leading-tight text-zinc-900">
                Forno & Mesa
              </p>
              <p className="text-[11px] text-zinc-500">Padaria & Bistrô</p>
            </div>

            <button
              type="button"
              onClick={() => setLocationModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-left text-xs transition hover:border-zinc-300 hover:bg-zinc-100"
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#ea1d2c]" />
              <span className="max-w-[160px] truncate font-semibold text-zinc-800 sm:max-w-[220px]">
                {mode === "RETIRADA"
                  ? "Retirar no balcão"
                  : selectedZone
                    ? `Entregar em: ${selectedZone.name}`
                    : "Escolher bairro"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
            </button>
          </div>

          {/* Search Input */}
          <div className="order-3 w-full sm:order-2 sm:max-w-sm sm:flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Busque por item no cardápio..."
                className="w-full rounded-lg border border-zinc-200 bg-zinc-100 py-2 pr-3 pl-9 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-zinc-400 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Sacola Button */}
          <button
            type="button"
            onClick={() => setBagOpen(true)}
            className="order-2 inline-flex items-center gap-2 rounded-lg bg-[#ea1d2c] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#c81623] sm:order-3"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Sacola</span>
            <span className="font-mono-num rounded bg-white/20 px-1.5 py-0.5 text-[11px]">
              {totalItemsCount}
            </span>
            <span className="font-mono-num">{formatBRL(totals.total)}</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-5 sm:px-6">
        {/* Store Info Banner */}
        <section className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-[#ea1d2c] text-white sm:h-20 sm:w-20">
                <Coffee className="h-8 w-8 sm:h-10 sm:w-10" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
                    Forno & Mesa — Padaria & Bistrô
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    Aberto agora
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
                  Pães de fermentação natural, doces artesanais, cafés especiais e pratos do bistrô.
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-600">
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                    <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    4.9
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-zinc-400" />
                    {mode === "RETIRADA"
                      ? "~15-20 min (Retirada)"
                      : `${selectedZone?.etaMinutes ?? 35} min`}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Bike className="h-3.5 w-3.5 text-zinc-400" />
                    {mode === "RETIRADA"
                      ? "Retirada grátis"
                      : deliveryFee === 0
                        ? "Entrega grátis"
                        : `Entrega ${formatBRL(deliveryFee)}`}
                  </span>
                  {mode === "DELIVERY" && selectedZone && (
                    <span className="text-zinc-500">
                      Pedido mínimo {formatBRL(selectedZone.minOrder)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-1">
                <button
                  type="button"
                  onClick={() => setMode("DELIVERY")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    mode === "DELIVERY"
                      ? "bg-white text-zinc-900 shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  <Bike className="h-3.5 w-3.5 text-[#ea1d2c]" /> Entrega
                </button>
                <button
                  type="button"
                  onClick={() => setMode("RETIRADA")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    mode === "RETIRADA"
                      ? "bg-white text-zinc-900 shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  <Store className="h-3.5 w-3.5 text-[#ea1d2c]" /> Retirada
                </button>
              </div>
              <p className="text-[11px] font-medium text-emerald-700">
                Frete grátis acima de {formatBRL(FREE_DELIVERY_ABOVE)}
              </p>
            </div>
          </div>
        </section>

        {/* Destaques Section (when not filtering) */}
        {activeCategory === "ALL" && !search.trim() && featuredProducts.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900">Destaques</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {featuredProducts.slice(0, 4).map(({ product, sector }) => {
                const inCart = cart.find((c) => c.product.id === product.id);
                return (
                  <div
                    key={product.id}
                    onClick={() => openProductModal(product, sector)}
                    className="group flex cursor-pointer flex-col justify-between rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="inline-block rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#ea1d2c]">
                          Mais pedido
                        </span>
                        <h3 className="mt-1.5 line-clamp-1 text-sm font-bold text-zinc-900">
                          {product.name}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                          {product.description}
                        </p>
                      </div>
                      <SectorThumb sector={sector} />
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2.5">
                      <span className="font-mono-num text-sm font-bold text-zinc-900">
                        {formatBRL(product.price)}
                        <span className="text-[11px] font-normal text-zinc-500">
                          /{product.unit}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          addProductDirect(product);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-bold text-[#ea1d2c] transition hover:border-[#ea1d2c] hover:bg-red-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {inCart ? inCart.qty : "Adicionar"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Sticky Category Tabs */}
        <div className="sticky top-[65px] z-20 -mx-4 border-b border-zinc-200 bg-[#f7f7f7]/95 px-4 backdrop-blur-xs sm:-mx-6 sm:px-6">
          <div className="no-scrollbar flex gap-2 overflow-x-auto py-2.5">
            <button
              type="button"
              onClick={() => setActiveCategory("ALL")}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                activeCategory === "ALL"
                  ? "bg-[#ea1d2c] text-white"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  activeCategory === cat.id
                    ? "bg-[#ea1d2c] text-white"
                    : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Category Product Lists (iFood 2-column horizontal cards) */}
        <div className="space-y-8">
          {visibleCategories.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
              Nenhum item encontrado para &ldquo;{search}&rdquo;.
            </div>
          ) : (
            visibleCategories.map((cat) => (
              <section key={cat.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-zinc-900">{cat.name}</h2>
                  <span className="text-xs font-medium text-zinc-500">
                    {cat.products.length}{" "}
                    {cat.products.length === 1 ? "item" : "itens"}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {cat.products.map((prod) => {
                    const inCart = cart.find((c) => c.product.id === prod.id);
                    return (
                      <div
                        key={prod.id}
                        onClick={() => openProductModal(prod, cat.sector)}
                        className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm"
                      >
                        <div className="flex min-w-0 flex-1 flex-col justify-between">
                          <div>
                            <h3 className="text-sm font-bold text-zinc-900">
                              {prod.name}
                            </h3>
                            <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                              {prod.description}
                            </p>
                          </div>
                          <div className="mt-3 flex items-center gap-3">
                            <span className="font-mono-num text-sm font-bold text-zinc-900">
                              {formatBRL(prod.price)}
                              <span className="text-[11px] font-normal text-zinc-500">
                                /{prod.unit}
                              </span>
                            </span>
                            <span className="text-[11px] text-zinc-400">
                              ~{prod.prepTimeMinutes} min
                            </span>
                          </div>
                        </div>

                        <div className="relative shrink-0">
                          <SectorThumb sector={cat.sector} />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              addProductDirect(prod);
                            }}
                            aria-label={`Adicionar ${prod.name}`}
                            className={`absolute -right-1.5 -bottom-1.5 flex h-7 items-center justify-center rounded-full border border-zinc-200 bg-white px-2 text-xs font-bold shadow-xs transition hover:border-[#ea1d2c] ${
                              inCart ? "bg-[#ea1d2c] text-white border-[#ea1d2c]" : "text-[#ea1d2c]"
                            }`}
                          >
                            {inCart ? (
                              <span className="font-mono-num">{inCart.qty}</span>
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </main>

      {/* Mobile Floating Sacola Bar */}
      {cart.length > 0 && !bagOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white p-3 shadow-lg lg:hidden">
          <button
            type="button"
            onClick={() => setBagOpen(true)}
            className="flex w-full items-center justify-between rounded-lg bg-[#ea1d2c] px-4 py-3 text-sm font-bold text-white"
          >
            <span className="inline-flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Ver sacola ({totalItemsCount})
            </span>
            <span className="font-mono-num">{formatBRL(totals.total)}</span>
          </button>
        </div>
      )}

      {/* Location / Neighborhood Modal */}
      {locationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <h3 className="text-base font-bold text-zinc-900">
                Como você quer receber?
              </h3>
              <button
                type="button"
                onClick={() => setLocationModalOpen(false)}
                className="icon-btn"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-zinc-100 p-1">
                <button
                  type="button"
                  onClick={() => setMode("DELIVERY")}
                  className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold transition ${
                    mode === "DELIVERY"
                      ? "bg-white text-zinc-900 shadow-xs"
                      : "text-zinc-600"
                  }`}
                >
                  <Bike className="h-4 w-4 text-[#ea1d2c]" /> Delivery
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("RETIRADA");
                    setLocationModalOpen(false);
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold transition ${
                    mode === "RETIRADA"
                      ? "bg-white text-zinc-900 shadow-xs"
                      : "text-zinc-600"
                  }`}
                >
                  <Store className="h-4 w-4 text-[#ea1d2c]" /> Retirar no Balcão
                </button>
              </div>

              {mode === "DELIVERY" && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-zinc-600">
                    Selecione seu bairro:
                  </p>
                  <div className="max-h-60 space-y-1.5 overflow-y-auto">
                    {zones.map((z) => (
                      <button
                        key={z.id}
                        type="button"
                        onClick={() => {
                          setZoneId(z.id);
                          setLocationModalOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-xs transition ${
                          zoneId === z.id
                            ? "border-[#ea1d2c] bg-red-50/60"
                            : "border-zinc-200 hover:bg-zinc-50"
                        }`}
                      >
                        <div>
                          <p className="font-bold text-zinc-900">{z.name}</p>
                          <p className="text-[11px] text-zinc-500">
                            ~{z.etaMinutes} min · Mín. {formatBRL(z.minOrder)}
                          </p>
                        </div>
                        <span className="font-mono-num font-bold text-zinc-800">
                          {formatBRL(z.fee)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Item Detail Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-4">
              <div className="flex items-start gap-3">
                <SectorThumb sector={selectedProduct.sector} />
                <div>
                  <h3 className="text-base font-bold text-zinc-900">
                    {selectedProduct.product.name}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    {selectedProduct.product.description}
                  </p>
                  <p className="font-mono-num mt-2 text-sm font-bold text-zinc-900">
                    {formatBRL(selectedProduct.product.price)}
                    <span className="text-xs font-normal text-zinc-500">
                      /{selectedProduct.product.unit}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="icon-btn"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="field-label">
                Alguma observação?
                <textarea
                  rows={2}
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="Ex: bem passado, sem açúcar, cortar em fatias..."
                  className="input-field resize-none"
                />
              </label>

              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2 py-1">
                  <button
                    type="button"
                    onClick={() => {
                      const step = selectedProduct.product.unit === "KG" ? 0.1 : 1;
                      setModalQty((q) => Math.max(step, Number((q - step).toFixed(3))));
                    }}
                    className="p-1 text-zinc-600 hover:text-[#ea1d2c]"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="font-mono-num min-w-[2.5rem] text-center text-sm font-bold">
                    {modalQty}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const step = selectedProduct.product.unit === "KG" ? 0.1 : 1;
                      setModalQty((q) => Number((q + step).toFixed(3)));
                    }}
                    className="p-1 text-[#ea1d2c]"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    addProductDirect(selectedProduct.product, modalQty, modalNotes);
                    setSelectedProduct(null);
                  }}
                  className="flex flex-1 items-center justify-between rounded-lg bg-[#ea1d2c] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#c81623]"
                >
                  <span>Adicionar</span>
                  <span className="font-mono-num">
                    {formatBRL(modalQty * selectedProduct.product.price)}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slide-Over "Sua Sacola" Checkout Drawer */}
      {bagOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50"
          onClick={() => setBagOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-[#ea1d2c]" />
                <h2 className="text-base font-bold text-zinc-900">Sua sacola</h2>
                {cart.length > 0 && (
                  <span className="font-mono-num rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                    ~{etaMinutes} min
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setBagOpen(false)}
                className="icon-btn"
                aria-label="Fechar sacola"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <form
              onSubmit={handleCheckout}
              className="flex flex-1 flex-col justify-between overflow-y-auto"
            >
              <div className="space-y-4 p-5">
                {/* Mode Switcher */}
                <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-zinc-100 p-1">
                  <button
                    type="button"
                    onClick={() => setMode("DELIVERY")}
                    className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold transition ${
                      mode === "DELIVERY"
                        ? "bg-white text-zinc-900 shadow-xs"
                        : "text-zinc-600"
                    }`}
                  >
                    <Bike className="h-4 w-4 text-[#ea1d2c]" /> Entrega
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("RETIRADA")}
                    className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold transition ${
                      mode === "RETIRADA"
                        ? "bg-white text-zinc-900 shadow-xs"
                        : "text-zinc-600"
                    }`}
                  >
                    <Store className="h-4 w-4 text-[#ea1d2c]" /> Retirada
                  </button>
                </div>

                {/* Free Shipping Bar */}
                {mode === "DELIVERY" && (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-[11px]">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-zinc-700">
                        {freeShippingRemaining === 0
                          ? "Frete grátis desbloqueado!"
                          : `Faltam ${formatBRL(freeShippingRemaining)} para frete grátis`}
                      </span>
                      <span className="font-mono-num text-zinc-500">
                        {freeShippingPct}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-200">
                      <div
                        className="h-full rounded-full bg-[#16a34a] transition-all"
                        style={{ width: `${freeShippingPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Cart Items */}
                {cart.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
                    <ShoppingBag className="mx-auto h-8 w-8 text-zinc-400" />
                    <p className="mt-2 text-xs font-semibold text-zinc-700">
                      Sua sacola está vazia
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Adicione itens do cardápio para fazer seu pedido.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {cart.map((line) => (
                      <div
                        key={line.product.id}
                        className="rounded-lg border border-zinc-200 bg-white p-3 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-bold text-zinc-900">
                              {line.product.name}
                            </p>
                            <p className="font-mono-num text-[11px] text-zinc-500">
                              {formatBRL(line.product.price)}/{line.product.unit}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateQty(line.product.id, 0)}
                            className="text-zinc-400 hover:text-[#ea1d2c]"
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
                            <span className="font-mono-num min-w-[2.2rem] text-center font-bold">
                              {line.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateQty(
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
                          <span className="font-mono-num font-bold text-zinc-900">
                            {formatBRL(line.qty * line.product.price)}
                          </span>
                        </div>

                        <input
                          type="text"
                          value={line.notes}
                          onChange={(e) =>
                            updateNotes(line.product.id, e.target.value)
                          }
                          placeholder="Observação do item..."
                          className="input-field mt-2 py-1 text-[11px]"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Customer & Address Fields */}
                {cart.length > 0 && (
                  <div className="space-y-3 border-t border-zinc-200 pt-4">
                    <div className="grid gap-2.5 sm:grid-cols-2">
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
                        WhatsApp (DDD) *
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
                                {z.name} — {formatBRL(z.fee)} · ~{z.etaMinutes} min (mín.{" "}
                                {formatBRL(z.minOrder)})
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
                        {(["PIX", "CREDITO", "DEBITO", "DINHEIRO"] as const).map(
                          (pm) => (
                            <button
                              key={pm}
                              type="button"
                              onClick={() => setPaymentMethod(pm)}
                              className={`rounded-lg py-1.5 text-[11px] font-bold transition ${
                                paymentMethod === pm
                                  ? "bg-zinc-900 text-white"
                                  : "border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                              }`}
                            >
                              {pm}
                            </button>
                          ),
                        )}
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
                )}
              </div>

              {/* Drawer Footer */}
              {cart.length > 0 && (
                <div className="space-y-3 border-t border-zinc-200 bg-zinc-50 p-5">
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-zinc-600">
                      <span>Subtotal</span>
                      <span className="font-mono-num font-semibold">
                        {formatBRL(totals.subtotal)}
                      </span>
                    </div>
                    {mode === "DELIVERY" && (
                      <div className="flex justify-between text-zinc-600">
                        <span>Taxa de entrega ({selectedZone?.name ?? "—"})</span>
                        <span className="font-mono-num font-semibold">
                          {totals.deliveryFee === 0
                            ? "Grátis"
                            : formatBRL(totals.deliveryFee)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-zinc-200 pt-2 text-sm font-bold text-zinc-900">
                      <span>Total</span>
                      <span className="font-mono-num text-[#ea1d2c]">
                        {formatBRL(totals.total)}
                      </span>
                    </div>
                  </div>

                  {minMissing > 0 && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                      Pedido mínimo para {selectedZone?.name}:{" "}
                      {formatBRL(selectedZone?.minOrder ?? 0)} (faltam{" "}
                      {formatBRL(minMissing)}).
                    </p>
                  )}

                  {error && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-900">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={cart.length === 0 || minMissing > 0 || submitting}
                    className="btn-primary flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {submitting
                      ? "Enviando pedido..."
                      : `Fazer pedido · ${formatBRL(totals.total)}`}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
