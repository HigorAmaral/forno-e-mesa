"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bike,
  CakeSlice,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coffee,
  Croissant,
  ExternalLink,
  Heart,
  History,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Star,
  Store,
  Tag,
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
  PROMO_COUPONS,
  resolveCouponBenefit,
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

interface RecentOrderEntry {
  code: string;
  trackingUrl: string;
  total: number;
  createdAt: string;
}

const FAVS_STORAGE_KEY = "forno_mesa_favs";
const RECENT_ORDERS_KEY = "forno_mesa_recent_orders";

function SectorThumb({ sector }: { sector: string }) {
  const s = sector.toUpperCase();
  if (s.includes("PADARIA") || s.includes("PAO")) {
    return (
      <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-xl border border-[#E6CCB2] bg-[#FAF3E8] text-[#3E2723]">
        <Croissant className="h-7 w-7 text-[#C07F5A]" />
        <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#8C5A3C]">
          Padaria
        </span>
      </div>
    );
  }
  if (s.includes("CONFEITARIA") || s.includes("BOLO") || s.includes("DOCE")) {
    return (
      <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-xl border border-[#E6CCB2] bg-[#FAF3E8] text-[#3E2723]">
        <CakeSlice className="h-7 w-7 text-[#C07F5A]" />
        <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#8C5A3C]">
          Doces
        </span>
      </div>
    );
  }
  if (s.includes("CAFE") || s.includes("BEBIDA")) {
    return (
      <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-xl border border-[#E6CCB2] bg-[#FAF3E8] text-[#3E2723]">
        <Coffee className="h-7 w-7 text-[#C07F5A]" />
        <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#8C5A3C]">
          Cafeteria
        </span>
      </div>
    );
  }
  return (
    <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-xl border border-[#E6CCB2] bg-[#FAF3E8] text-[#3E2723]">
      <UtensilsCrossed className="h-7 w-7 text-[#C07F5A]" />
      <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#8C5A3C]">
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
  const [activeCategory, setActiveCategory] = useState<number | "ALL" | "FAVS">("ALL");
  const [sortBy, setSortBy] = useState<"DEFAULT" | "PRICE_ASC" | "FASTEST">("DEFAULT");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrderEntry[]>([]);

  const [bagOpen, setBagOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{
    product: StoreProduct;
    sector: string;
  } | null>(null);
  const [modalQty, setModalQty] = useState(1);
  const [modalNotes, setModalNotes] = useState("");

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);

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

  useEffect(() => {
    try {
      const savedFavs = localStorage.getItem(FAVS_STORAGE_KEY);
      if (savedFavs) setFavorites(JSON.parse(savedFavs) as number[]);
      const savedOrders = localStorage.getItem(RECENT_ORDERS_KEY);
      if (savedOrders) setRecentOrders(JSON.parse(savedOrders) as RecentOrderEntry[]);
    } catch {
      // Ignore localStorage unavailability
    }
  }, []);

  function toggleFavorite(productId: number) {
    setFavorites((prev) => {
      const next = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      try {
        localStorage.setItem(FAVS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }

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
      .filter((c) => activeCategory === "ALL" || activeCategory === "FAVS" || c.id === activeCategory)
      .map((c) => {
        const filtered = c.products.filter((p) => {
          const matchesFav = activeCategory !== "FAVS" || favorites.includes(p.id);
          const matchesQuery =
            !q ||
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q);
          return matchesFav && matchesQuery;
        });
        const sorted = [...filtered].sort((a, b) => {
          if (sortBy === "PRICE_ASC") return a.price - b.price;
          if (sortBy === "FASTEST") return a.prepTimeMinutes - b.prepTimeMinutes;
          return 0;
        });
        return { ...c, products: sorted };
      })
      .filter((c) => c.products.length > 0);
  }, [categories, activeCategory, search, favorites, sortBy]);

  const subtotal = useMemo(
    () => cart.reduce((s, l) => s + l.qty * l.product.price, 0),
    [cart],
  );

  const couponBenefit = useMemo(
    () => resolveCouponBenefit({ code: appliedCoupon, subtotal }),
    [appliedCoupon, subtotal],
  );

  const discountAmount = couponBenefit.valid ? couponBenefit.discount : 0;

  const deliveryFee = useMemo(() => {
    if (mode === "RETIRADA" || !selectedZone) return 0;
    if (couponBenefit.valid && couponBenefit.freeDelivery) return 0;
    return resolveDeliveryFee({
      zoneFee: selectedZone.fee,
      subtotal: Math.max(0, subtotal - discountAmount),
      freeAbove: FREE_DELIVERY_ABOVE,
    });
  }, [mode, selectedZone, subtotal, discountAmount, couponBenefit]);

  const totals = useMemo(
    () =>
      calculateOrderTotals({
        items: cart.map((c) => ({ qty: c.qty, unitPrice: c.product.price })),
        discount: discountAmount,
        deliveryFee,
      }),
    [cart, discountAmount, deliveryFee],
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

  function handleApplyCoupon(codeToApply?: string) {
    const code = (codeToApply ?? couponInput).trim().toUpperCase();
    if (!code) {
      setAppliedCoupon("");
      setCouponError(null);
      return;
    }
    const check = resolveCouponBenefit({ code, subtotal });
    if (!check.valid) {
      setCouponError(check.error ?? "Cupom inválido.");
      return;
    }
    setCouponError(null);
    setAppliedCoupon(check.code);
    setCouponInput(check.code);
  }

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
          couponCode: couponBenefit.valid ? couponBenefit.code : undefined,
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
        try {
          const entry: RecentOrderEntry = {
            code: json.order?.code ?? "PEDIDO",
            trackingUrl: json.trackingUrl,
            total: json.order?.total ?? totals.total,
            createdAt: new Date().toISOString(),
          };
          const next = [entry, ...recentOrders].slice(0, 6);
          localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage error
        }
        router.push(json.trackingUrl);
      }
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF3E8] text-[#3E2723]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-[#E6CCB2] bg-[#FFFDF9]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {/* Brand & Location Pill */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C07F5A] text-white">
              <Coffee className="h-5 w-5" />
            </div>
            <div className="hidden sm:block">
              <p className="font-display text-base font-bold leading-tight text-[#3E2723]">
                Forno & Mesa
              </p>
              <p className="text-[11px] text-[#8C5A3C]">Padaria & Bistrô</p>
            </div>

            <button
              type="button"
              onClick={() => setLocationModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[#E6CCB2] bg-[#FAF3E8] px-3 py-1.5 text-left text-xs transition hover:border-[#C07F5A]"
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#C07F5A]" />
              <span className="max-w-[150px] truncate font-semibold text-[#3E2723] sm:max-w-[210px]">
                {mode === "RETIRADA"
                  ? "Retirar no balcão"
                  : selectedZone
                    ? `Entregar em: ${selectedZone.name}`
                    : "Escolher bairro"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-[#8C5A3C]" />
            </button>
          </div>

          {/* Search Input */}
          <div className="order-3 w-full sm:order-2 sm:max-w-sm sm:flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#8C5A3C]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Busque pães, bolos, cafés..."
                className="w-full rounded-lg border border-[#E6CCB2] bg-[#FAF3E8] py-2 pr-3 pl-9 text-sm text-[#3E2723] placeholder:text-[#8C5A3C]/70 focus:border-[#C07F5A] focus:bg-[#FFFDF9] focus:outline-none"
              />
            </div>
          </div>

          {/* Right Actions: Meus Pedidos + Sacola */}
          <div className="order-2 flex items-center gap-2 sm:order-3">
            {recentOrders.length > 0 && (
              <button
                type="button"
                onClick={() => setHistoryModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6CCB2] bg-[#FAF3E8] px-3 py-2 text-xs font-semibold text-[#3E2723] transition hover:bg-[#E6CCB2]/50"
              >
                <History className="h-3.5 w-3.5 text-[#8C5A3C]" />
                <span className="hidden md:inline">Meus pedidos</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setBagOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#C07F5A] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#A66844]"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Sacola</span>
              <span className="font-mono-num rounded bg-[#3E2723]/20 px-1.5 py-0.5 text-[11px]">
                {totalItemsCount}
              </span>
              <span className="font-mono-num">{formatBRL(totals.total)}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-5 sm:px-6">
        {/* Store Info Banner */}
        <section className="rounded-xl border border-[#E6CCB2] bg-[#FFFDF9] p-4 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#3E2723] text-[#FAF3E8] sm:h-20 sm:w-20">
                <Coffee className="h-8 w-8 sm:h-10 sm:w-10 text-[#E6CCB2]" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-xl font-bold tracking-tight text-[#3E2723] sm:text-2xl">
                    Forno & Mesa — Padaria & Bistrô
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    Aberto agora
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#8C5A3C] sm:text-sm">
                  Pães de fermentação natural, doces artesanais, cafés especiais e pratos do bistrô.
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#8C5A3C]">
                  <span className="inline-flex items-center gap-1 font-semibold text-[#C07F5A]">
                    <Star className="h-3.5 w-3.5 fill-[#C07F5A] text-[#C07F5A]" />
                    4.9
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-[#8C5A3C]" />
                    {mode === "RETIRADA"
                      ? "~15-20 min (Retirada)"
                      : `${selectedZone?.etaMinutes ?? 35} min`}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Bike className="h-3.5 w-3.5 text-[#8C5A3C]" />
                    {mode === "RETIRADA"
                      ? "Retirada grátis"
                      : deliveryFee === 0
                        ? "Entrega grátis"
                        : `Entrega ${formatBRL(deliveryFee)}`}
                  </span>
                  {mode === "DELIVERY" && selectedZone && (
                    <span>
                      Pedido mínimo {formatBRL(selectedZone.minOrder)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <div className="inline-flex rounded-lg border border-[#E6CCB2] bg-[#FAF3E8] p-1">
                <button
                  type="button"
                  onClick={() => setMode("DELIVERY")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    mode === "DELIVERY"
                      ? "bg-[#3E2723] text-[#FAF3E8]"
                      : "text-[#8C5A3C] hover:text-[#3E2723]"
                  }`}
                >
                  <Bike className="h-3.5 w-3.5" /> Entrega
                </button>
                <button
                  type="button"
                  onClick={() => setMode("RETIRADA")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    mode === "RETIRADA"
                      ? "bg-[#3E2723] text-[#FAF3E8]"
                      : "text-[#8C5A3C] hover:text-[#3E2723]"
                  }`}
                >
                  <Store className="h-3.5 w-3.5" /> Retirada
                </button>
              </div>
              <p className="text-[11px] font-semibold text-[#8C5A3C]">
                Cupons ativos: <span className="text-[#C07F5A]">FORNO10</span> ·{" "}
                <span className="text-[#C07F5A]">FRETEZERO</span>
              </p>
            </div>
          </div>
        </section>

        {/* Destaques Section */}
        {activeCategory === "ALL" && !search.trim() && featuredProducts.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[#3E2723]">Destaques da Casa</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {featuredProducts.slice(0, 4).map(({ product, sector }) => {
                const inCart = cart.find((c) => c.product.id === product.id);
                const isFav = favorites.includes(product.id);
                return (
                  <div
                    key={product.id}
                    onClick={() => openProductModal(product, sector)}
                    className="group flex cursor-pointer flex-col justify-between rounded-xl border border-[#E6CCB2] bg-[#FFFDF9] p-4 transition hover:border-[#C07F5A] hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block rounded bg-[#E6CCB2]/60 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#8C5A3C]">
                            Mais pedido
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(product.id);
                            }}
                            aria-label="Favoritar"
                            className="text-[#8C5A3C] hover:text-[#C07F5A]"
                          >
                            <Heart
                              className={`h-3.5 w-3.5 ${isFav ? "fill-[#C07F5A] text-[#C07F5A]" : ""}`}
                            />
                          </button>
                        </div>
                        <h3 className="mt-1.5 line-clamp-1 text-sm font-bold text-[#3E2723]">
                          {product.name}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs text-[#8C5A3C]">
                          {product.description}
                        </p>
                      </div>
                      <SectorThumb sector={sector} />
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-[#E6CCB2]/60 pt-2.5">
                      <span className="font-mono-num text-sm font-bold text-[#3E2723]">
                        {formatBRL(product.price)}
                        <span className="text-[11px] font-normal text-[#8C5A3C]">
                          /{product.unit}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          addProductDirect(product);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#C07F5A] bg-[#FAF3E8] px-2.5 py-1 text-xs font-bold text-[#C07F5A] transition hover:bg-[#C07F5A] hover:text-white"
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

        {/* Sticky Category Tabs + Sort */}
        <div className="sticky top-[65px] z-20 -mx-4 border-b border-[#E6CCB2] bg-[#FAF3E8]/95 px-4 backdrop-blur-xs sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveCategory("ALL")}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  activeCategory === "ALL"
                    ? "bg-[#C07F5A] text-white"
                    : "border border-[#E6CCB2] bg-[#FFFDF9] text-[#8C5A3C] hover:bg-[#E6CCB2]/40"
                }`}
              >
                Todos
              </button>
              {favorites.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveCategory("FAVS")}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                    activeCategory === "FAVS"
                      ? "bg-[#C07F5A] text-white"
                      : "border border-[#E6CCB2] bg-[#FFFDF9] text-[#8C5A3C] hover:bg-[#E6CCB2]/40"
                  }`}
                >
                  <Heart className="h-3 w-3" /> Favoritos ({favorites.length})
                </button>
              )}
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                    activeCategory === cat.id
                      ? "bg-[#C07F5A] text-white"
                      : "border border-[#E6CCB2] bg-[#FFFDF9] text-[#8C5A3C] hover:bg-[#E6CCB2]/40"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "DEFAULT" | "PRICE_ASC" | "FASTEST")}
              aria-label="Ordenar cardápio"
              className="rounded-lg border border-[#E6CCB2] bg-[#FFFDF9] px-2.5 py-1.5 text-xs font-semibold text-[#3E2723]"
            >
              <option value="DEFAULT">Ordenar: Padrão</option>
              <option value="PRICE_ASC">Menor preço</option>
              <option value="FASTEST">Mais rápido</option>
            </select>
          </div>
        </div>

        {/* Category Product Lists */}
        <div className="space-y-8">
          {visibleCategories.length === 0 ? (
            <div className="rounded-xl border border-[#E6CCB2] bg-[#FFFDF9] p-10 text-center text-sm text-[#8C5A3C]">
              {activeCategory === "FAVS"
                ? "Você ainda não favoritou nenhum item."
                : `Nenhum item encontrado para "${search}".`}
            </div>
          ) : (
            visibleCategories.map((cat) => (
              <section key={cat.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold text-[#3E2723]">{cat.name}</h2>
                  <span className="text-xs font-medium text-[#8C5A3C]">
                    {cat.products.length}{" "}
                    {cat.products.length === 1 ? "item" : "itens"}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {cat.products.map((prod) => {
                    const inCart = cart.find((c) => c.product.id === prod.id);
                    const isFav = favorites.includes(prod.id);
                    return (
                      <div
                        key={prod.id}
                        onClick={() => openProductModal(prod, cat.sector)}
                        className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[#E6CCB2] bg-[#FFFDF9] p-4 transition hover:border-[#C07F5A] hover:shadow-sm"
                      >
                        <div className="flex min-w-0 flex-1 flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-[#3E2723]">
                                {prod.name}
                              </h3>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(prod.id);
                                }}
                                aria-label="Favoritar"
                                className="text-[#8C5A3C] hover:text-[#C07F5A]"
                              >
                                <Heart
                                  className={`h-3.5 w-3.5 ${isFav ? "fill-[#C07F5A] text-[#C07F5A]" : ""}`}
                                />
                              </button>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-[#8C5A3C]">
                              {prod.description}
                            </p>
                          </div>
                          <div className="mt-3 flex items-center gap-3">
                            <span className="font-mono-num text-sm font-bold text-[#3E2723]">
                              {formatBRL(prod.price)}
                              <span className="text-[11px] font-normal text-[#8C5A3C]">
                                /{prod.unit}
                              </span>
                            </span>
                            <span className="text-[11px] text-[#8C5A3C]">
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
                            className={`absolute -right-1.5 -bottom-1.5 flex h-7 items-center justify-center rounded-full border px-2 text-xs font-bold shadow-xs transition ${
                              inCart
                                ? "border-[#C07F5A] bg-[#C07F5A] text-white"
                                : "border-[#E6CCB2] bg-[#FFFDF9] text-[#C07F5A] hover:border-[#C07F5A]"
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

      {/* Café Espresso Footer */}
      <footer className="mt-12 border-t border-[#543832] bg-[#3E2723] text-[#FAF3E8] pb-20 lg:pb-8">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6">
          <div>
            <p className="font-display text-base font-bold text-[#FAF3E8]">
              Forno & Mesa — Padaria & Bistrô
            </p>
            <p className="mt-1 text-xs text-[#E6CCB2]">
              Fermentação natural, confeitaria artesanal e bistrô diário.
            </p>
          </div>
          <div className="text-xs text-[#E6CCB2]">
            <p className="font-semibold text-[#FAF3E8]">Horário de Atendimento</p>
            <p className="mt-1">Seg a Sáb: 07h00 às 22h00</p>
            <p>Domingos e Feriados: 08h00 às 20h00</p>
          </div>
          <div className="text-xs text-[#E6CCB2]">
            <p className="font-semibold text-[#FAF3E8]">Cupons & Pagamento</p>
            <p className="mt-1">PIX, Cartão de Crédito/Débito e Dinheiro na entrega.</p>
            <p className="mt-1">Frete grátis acima de {formatBRL(FREE_DELIVERY_ABOVE)}.</p>
          </div>
        </div>
      </footer>

      {/* Mobile Floating Sacola Bar */}
      {cart.length > 0 && !bagOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E6CCB2] bg-[#FFFDF9] p-3 shadow-lg lg:hidden">
          <button
            type="button"
            onClick={() => setBagOpen(true)}
            className="flex w-full items-center justify-between rounded-lg bg-[#C07F5A] px-4 py-3 text-sm font-bold text-white"
          >
            <span className="inline-flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Ver sacola ({totalItemsCount})
            </span>
            <span className="font-mono-num">{formatBRL(totals.total)}</span>
          </button>
        </div>
      )}

      {/* Recent Orders Modal */}
      {historyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#3E2723]/55 p-4"
          onClick={() => setHistoryModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#E6CCB2] bg-[#FFFDF9] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E6CCB2] pb-3">
              <h3 className="font-display text-base font-bold text-[#3E2723]">
                Meus Pedidos Recentes
              </h3>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="icon-btn"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {recentOrders.map((ord) => (
                <a
                  key={ord.code}
                  href={ord.trackingUrl}
                  className="flex items-center justify-between rounded-xl border border-[#E6CCB2] bg-[#FAF3E8] px-3.5 py-2.5 text-xs transition hover:border-[#C07F5A]"
                >
                  <div>
                    <p className="font-mono-num font-bold text-[#3E2723]">{ord.code}</p>
                    <p className="text-[11px] text-[#8C5A3C]">
                      {new Date(ord.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-num font-bold text-[#C07F5A]">
                      {formatBRL(ord.total)}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-[#8C5A3C]" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Location / Neighborhood Modal */}
      {locationModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#3E2723]/55 p-4"
          onClick={() => setLocationModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#E6CCB2] bg-[#FFFDF9] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E6CCB2] pb-3">
              <h3 className="font-display text-base font-bold text-[#3E2723]">
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
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#FAF3E8] p-1 border border-[#E6CCB2]">
                <button
                  type="button"
                  onClick={() => setMode("DELIVERY")}
                  className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold transition ${
                    mode === "DELIVERY"
                      ? "bg-[#3E2723] text-[#FAF3E8]"
                      : "text-[#8C5A3C]"
                  }`}
                >
                  <Bike className="h-4 w-4" /> Delivery
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("RETIRADA");
                    setLocationModalOpen(false);
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold transition ${
                    mode === "RETIRADA"
                      ? "bg-[#3E2723] text-[#FAF3E8]"
                      : "text-[#8C5A3C]"
                  }`}
                >
                  <Store className="h-4 w-4" /> Retirar no Balcão
                </button>
              </div>

              {mode === "DELIVERY" && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#8C5A3C]">
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
                            ? "border-[#C07F5A] bg-[#E6CCB2]/40"
                            : "border-[#E6CCB2] bg-[#FAF3E8] hover:bg-[#E6CCB2]/30"
                        }`}
                      >
                        <div>
                          <p className="font-bold text-[#3E2723]">{z.name}</p>
                          <p className="text-[11px] text-[#8C5A3C]">
                            ~{z.etaMinutes} min · Mín. {formatBRL(z.minOrder)}
                          </p>
                        </div>
                        <span className="font-mono-num font-bold text-[#3E2723]">
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#3E2723]/55 sm:items-center sm:p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl border border-[#E6CCB2] bg-[#FFFDF9] p-5 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#E6CCB2] pb-4">
              <div className="flex items-start gap-3">
                <SectorThumb sector={selectedProduct.sector} />
                <div>
                  <h3 className="font-display text-base font-bold text-[#3E2723]">
                    {selectedProduct.product.name}
                  </h3>
                  <p className="mt-1 text-xs text-[#8C5A3C]">
                    {selectedProduct.product.description}
                  </p>
                  <p className="font-mono-num mt-2 text-sm font-bold text-[#3E2723]">
                    {formatBRL(selectedProduct.product.price)}
                    <span className="text-xs font-normal text-[#8C5A3C]">
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
                <div className="flex items-center gap-2 rounded-lg border border-[#E6CCB2] bg-[#FAF3E8] px-2 py-1">
                  <button
                    type="button"
                    onClick={() => {
                      const step = selectedProduct.product.unit === "KG" ? 0.1 : 1;
                      setModalQty((q) => Math.max(step, Number((q - step).toFixed(3))));
                    }}
                    className="p-1 text-[#8C5A3C] hover:text-[#3E2723]"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="font-mono-num min-w-[2.5rem] text-center text-sm font-bold text-[#3E2723]">
                    {modalQty}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const step = selectedProduct.product.unit === "KG" ? 0.1 : 1;
                      setModalQty((q) => Number((q + step).toFixed(3)));
                    }}
                    className="p-1 text-[#C07F5A]"
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
                  className="flex flex-1 items-center justify-between rounded-lg bg-[#C07F5A] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#A66844]"
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
          className="fixed inset-0 z-50 flex justify-end bg-[#3E2723]/55"
          onClick={() => setBagOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-md flex-col border-l border-[#E6CCB2] bg-[#FFFDF9] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-[#E6CCB2] px-5 py-4">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-[#C07F5A]" />
                <h2 className="font-display text-base font-bold text-[#3E2723]">Sua sacola</h2>
                {cart.length > 0 && (
                  <span className="font-mono-num rounded-full bg-[#E6CCB2]/60 px-2 py-0.5 text-[11px] font-semibold text-[#3E2723]">
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
                <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-[#E6CCB2] bg-[#FAF3E8] p-1">
                  <button
                    type="button"
                    onClick={() => setMode("DELIVERY")}
                    className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold transition ${
                      mode === "DELIVERY"
                        ? "bg-[#3E2723] text-[#FAF3E8]"
                        : "text-[#8C5A3C]"
                    }`}
                  >
                    <Bike className="h-4 w-4" /> Entrega
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("RETIRADA")}
                    className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold transition ${
                      mode === "RETIRADA"
                        ? "bg-[#3E2723] text-[#FAF3E8]"
                        : "text-[#8C5A3C]"
                    }`}
                  >
                    <Store className="h-4 w-4" /> Retirada
                  </button>
                </div>

                {/* Free Shipping Bar */}
                {mode === "DELIVERY" && (
                  <div className="rounded-lg border border-[#E6CCB2] bg-[#FAF3E8] p-3 text-[11px]">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-[#3E2723]">
                        {freeShippingRemaining === 0
                          ? "Frete grátis desbloqueado!"
                          : `Faltam ${formatBRL(freeShippingRemaining)} para frete grátis`}
                      </span>
                      <span className="font-mono-num text-[#8C5A3C]">
                        {freeShippingPct}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#E6CCB2]">
                      <div
                        className="h-full rounded-full bg-[#C07F5A] transition-all"
                        style={{ width: `${freeShippingPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Cart Items */}
                {cart.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#C07F5A]/50 bg-[#FAF3E8] p-8 text-center">
                    <ShoppingBag className="mx-auto h-8 w-8 text-[#8C5A3C]" />
                    <p className="mt-2 text-xs font-semibold text-[#3E2723]">
                      Sua sacola está vazia
                    </p>
                    <p className="mt-1 text-[11px] text-[#8C5A3C]">
                      Adicione itens do cardápio para fazer seu pedido.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {cart.map((line) => (
                      <div
                        key={line.product.id}
                        className="rounded-lg border border-[#E6CCB2] bg-[#FAF3E8] p-3 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-bold text-[#3E2723]">
                              {line.product.name}
                            </p>
                            <p className="font-mono-num text-[11px] text-[#8C5A3C]">
                              {formatBRL(line.product.price)}/{line.product.unit}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateQty(line.product.id, 0)}
                            className="text-[#8C5A3C] hover:text-red-700"
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
                            <span className="font-mono-num min-w-[2.2rem] text-center font-bold text-[#3E2723]">
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
                          <span className="font-mono-num font-bold text-[#C07F5A]">
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

                {/* Promo Coupon */}
                {cart.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-[#E6CCB2] bg-[#FAF3E8] p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-[#8C5A3C]">
                      <Tag className="h-3.5 w-3.5 text-[#C07F5A]" />
                      Cupom de desconto
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        placeholder="Ex: FORNO10"
                        className="input-field uppercase"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyCoupon()}
                        className="shrink-0 rounded-lg bg-[#3E2723] px-3 py-1.5 text-xs font-bold text-[#FAF3E8] hover:bg-[#543832]"
                      >
                        Aplicar
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {PROMO_COUPONS.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => handleApplyCoupon(c.code)}
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition ${
                            appliedCoupon === c.code
                              ? "border-[#C07F5A] bg-[#C07F5A] text-white"
                              : "border-[#E6CCB2] bg-[#FFFDF9] text-[#8C5A3C] hover:border-[#C07F5A]"
                          }`}
                        >
                          {c.code} · {c.label}
                        </button>
                      ))}
                    </div>
                    {couponError && (
                      <p className="text-[11px] font-semibold text-red-700">{couponError}</p>
                    )}
                    {couponBenefit.valid && (
                      <p className="text-[11px] font-semibold text-emerald-800">
                        Cupom {couponBenefit.code} aplicado: {couponBenefit.label}
                      </p>
                    )}
                  </div>
                )}

                {/* Customer & Address Fields */}
                {cart.length > 0 && (
                  <div className="space-y-3 border-t border-[#E6CCB2] pt-4">
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
                                  ? "bg-[#3E2723] text-[#FAF3E8]"
                                  : "border border-[#E6CCB2] bg-[#FAF3E8] text-[#8C5A3C] hover:bg-[#E6CCB2]/50"
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
                <div className="space-y-3 border-t border-[#E6CCB2] bg-[#FAF3E8] p-5">
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-[#8C5A3C]">
                      <span>Subtotal</span>
                      <span className="font-mono-num font-semibold">
                        {formatBRL(totals.subtotal)}
                      </span>
                    </div>
                    {totals.discount > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Desconto ({couponBenefit.code})</span>
                        <span className="font-mono-num font-semibold">
                          -{formatBRL(totals.discount)}
                        </span>
                      </div>
                    )}
                    {mode === "DELIVERY" && (
                      <div className="flex justify-between text-[#8C5A3C]">
                        <span>Taxa de entrega ({selectedZone?.name ?? "—"})</span>
                        <span className="font-mono-num font-semibold">
                          {totals.deliveryFee === 0
                            ? "Grátis"
                            : formatBRL(totals.deliveryFee)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-[#E6CCB2] pt-2 text-sm font-bold text-[#3E2723]">
                      <span>Total</span>
                      <span className="font-mono-num text-[#C07F5A]">
                        {formatBRL(totals.total)}
                      </span>
                    </div>
                  </div>

                  {minMissing > 0 && (
                    <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
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
