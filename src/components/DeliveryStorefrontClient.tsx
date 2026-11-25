"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  Bike,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coffee,
  ExternalLink,
  Heart,
  History,
  Home,
  Lock,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Tag,
  Trash2,
  User,
  X,
} from "lucide-react";
import { CafeFloatingToast, CoffeeSteamEmblem } from "./CafeAtmosphere";
import { ProductPhoto } from "./ProductPhoto";
import { ThemeToggleButton } from "./ThemeToggleButton";
import {
  calculateOrderTotals,
  estimateDeliveryMinutes,
  formatBRL,
  FREE_DELIVERY_ABOVE,
  missingForMinimumOrder,
  resolveCouponBenefit,
  resolveDeliveryFee,
  resolveDynamicCouponBenefit,
} from "@/lib/domain";
import type {
  DeliveryZoneDto,
  PromoCouponDto,
  StoreSettingsDto,
} from "@/types/erp";

interface StoreProduct {
  id: number;
  name: string;
  description: string;
  imageUrl?: string | null;
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

interface LoggedCustomerSummary {
  id: number;
  name: string;
  phone: string;
  loyaltyPoints: number;
  defaultAddress: string | null;
  defaultNeighborhood: string | null;
  defaultReference: string | null;
}

interface DeliveryStorefrontClientProps {
  categories: StoreCategory[];
  zones: DeliveryZoneDto[];
  storeSettings?: StoreSettingsDto | null;
  coupons?: PromoCouponDto[];
  averageRating?: number;
  reviewsCount?: number;
  loggedCustomer?: LoggedCustomerSummary | null;
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

export function DeliveryStorefrontClient({
  categories: initialCategories,
  zones: initialZones,
  storeSettings: initialStoreSettings,
  coupons: initialCoupons = [],
  averageRating: initialAverageRating = 4.9,
  reviewsCount: initialReviewsCount = 0,
  loggedCustomer = null,
}: DeliveryStorefrontClientProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<StoreCategory[]>(initialCategories);
  const [zones, setZones] = useState<DeliveryZoneDto[]>(initialZones);
  const [storeSettings, setStoreSettings] = useState<StoreSettingsDto | null | undefined>(
    initialStoreSettings,
  );
  const [coupons, setCoupons] = useState<PromoCouponDto[]>(initialCoupons);
  const [averageRating, setAverageRating] = useState<number>(initialAverageRating);
  const [reviewsCount, setReviewsCount] = useState<number>(initialReviewsCount);

  const isDeliveryOpen = storeSettings?.isDeliveryOpen ?? true;
  const freeAboveThreshold = storeSettings?.freeDeliveryAbove ?? FREE_DELIVERY_ABOVE;

  const initialZone = useMemo(() => {
    if (loggedCustomer?.defaultNeighborhood) {
      const match = zones.find(
        (z) =>
          z.name.toLowerCase() ===
          loggedCustomer.defaultNeighborhood!.toLowerCase(),
      );
      if (match) return match.id;
    }
    return zones[0]?.id ?? 0;
  }, [zones, loggedCustomer]);

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

  const [zoneId, setZoneId] = useState<number>(initialZone);
  const [customerName, setCustomerName] = useState(loggedCustomer?.name ?? "");
  const [customerPhone, setCustomerPhone] = useState(loggedCustomer?.phone ?? "");
  const [address, setAddress] = useState(loggedCustomer?.defaultAddress ?? "");
  const [reference, setReference] = useState(loggedCustomer?.defaultReference ?? "");
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [scheduleChoice, setScheduleChoice] = useState<"NOW" | "SCHEDULED">("NOW");
  const [scheduledTime, setScheduledTime] = useState("18:30");
  const [paymentMethod, setPaymentMethod] = useState<
    "PIX" | "CREDITO" | "DEBITO" | "DINHEIRO"
  >("PIX");
  const [changeFor, setChangeFor] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bagPopKey, setBagPopKey] = useState(0);
  const [poppingFavId, setPoppingFavId] = useState<number | null>(null);
  const [quickToast, setQuickToast] = useState<string | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const favTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showQuickToast(msg: string) {
    setQuickToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setQuickToast(null), 2400);
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (favTimerRef.current) clearTimeout(favTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      try {
        const savedFavs = localStorage.getItem(FAVS_STORAGE_KEY);
        if (savedFavs) setFavorites(JSON.parse(savedFavs) as number[]);
        const savedOrders = localStorage.getItem(RECENT_ORDERS_KEY);
        if (savedOrders) setRecentOrders(JSON.parse(savedOrders) as RecentOrderEntry[]);
      } catch {
        // Ignore
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = setInterval(async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/menu", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (cancelled) return;
        if (Array.isArray(json.categories)) setCategories(json.categories);
        if (Array.isArray(json.zones)) setZones(json.zones);
        if (Array.isArray(json.coupons)) setCoupons(json.coupons);
        if (json.storeSettings) {
          setStoreSettings((prev) =>
            prev
              ? { ...prev, ...json.storeSettings }
              : (json.storeSettings as StoreSettingsDto),
          );
        }
        if (typeof json.averageRating === "number") setAverageRating(json.averageRating);
        if (typeof json.reviewsCount === "number") setReviewsCount(json.reviewsCount);
      } catch {
        // Silent 5s polling failure
      }
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setBagOpen(false);
        setLocationModalOpen(false);
        setHistoryModalOpen(false);
        setSelectedProduct(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleFavorite(productId: number) {
    const willFav = !favorites.includes(productId);
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
    setPoppingFavId(productId);
    if (favTimerRef.current) clearTimeout(favTimerRef.current);
    favTimerRef.current = setTimeout(() => setPoppingFavId(null), 400);
    showQuickToast(willFav ? "Salvo nos seus favoritos" : "Removido dos favoritos");
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
      .filter(
        (c) =>
          activeCategory === "ALL" ||
          activeCategory === "FAVS" ||
          c.id === activeCategory,
      )
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

  const couponBenefit = useMemo(() => {
    if (!appliedCoupon) {
      return resolveCouponBenefit({ code: "", subtotal });
    }
    const dbMatch = coupons.find(
      (c) => c.code.toUpperCase() === appliedCoupon.toUpperCase(),
    );
    if (dbMatch) {
      return resolveDynamicCouponBenefit(dbMatch, subtotal);
    }
    return resolveCouponBenefit({ code: appliedCoupon, subtotal });
  }, [appliedCoupon, coupons, subtotal]);

  const canRedeemLoyalty = Boolean(
    loggedCustomer && loggedCustomer.loyaltyPoints >= 10 && cart.length > 0,
  );
  const loyaltyDiscount = canRedeemLoyalty && redeemPoints ? 15 : 0;
  const discountAmount =
    (couponBenefit.valid ? couponBenefit.discount : 0) + loyaltyDiscount;

  const deliveryFee = useMemo(() => {
    if (mode === "RETIRADA" || !selectedZone) return 0;
    if (couponBenefit.valid && couponBenefit.freeDelivery) return 0;
    return resolveDeliveryFee({
      zoneFee: selectedZone.fee,
      subtotal: Math.max(0, subtotal - discountAmount),
      freeAbove: freeAboveThreshold,
    });
  }, [
    mode,
    selectedZone,
    subtotal,
    discountAmount,
    couponBenefit,
    freeAboveThreshold,
  ]);

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

  const freeShippingRemaining = Math.max(0, freeAboveThreshold - totals.subtotal);
  const freeShippingPct =
    freeAboveThreshold > 0
      ? Math.min(100, Math.round((totals.subtotal / freeAboveThreshold) * 100))
      : 100;

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
    const dbMatch = coupons.find((c) => c.code.toUpperCase() === code);
    const check = dbMatch
      ? resolveDynamicCouponBenefit(dbMatch, subtotal)
      : resolveCouponBenefit({ code, subtotal });
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
    setBagPopKey((k) => k + 1);
    showQuickToast(`${product.name} adicionado à sacola`);
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
    if (!isDeliveryOpen || cart.length === 0 || submitting || minMissing > 0) return;
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
          redeemLoyaltyPoints: canRedeemLoyalty && redeemPoints,
          couponCode: couponBenefit.valid ? couponBenefit.code : undefined,
          scheduledFor: scheduleChoice === "SCHEDULED" ? scheduledTime : undefined,
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
          // Ignore
        }
        router.push(json.trackingUrl);
      }
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  const displayedCoupons =
    coupons.length > 0
      ? coupons.map((c) => ({ code: c.code, label: c.label }))
      : [
          { code: "FORNO10", label: "10% OFF" },
          { code: "FRETEZERO", label: "Frete Grátis" },
        ];

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Top Header */}
      <header className="cafe-topbar sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2.5 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              title="Voltar ao início"
              className="group flex items-center gap-2.5 rounded-xl pr-1 transition hover:opacity-90"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-white shadow-xs transition-transform group-hover:scale-105">
                <Coffee className="h-5 w-5" />
              </div>
              <div className="hidden sm:block">
                <p className="font-display text-base font-bold leading-tight text-[var(--text-primary)]">
                  {storeSettings?.storeName ?? "Forno & Mesa"}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Padaria &amp; Bistrô
                </p>
              </div>
            </Link>

            <Link
              href="/"
              className="btn-secondary hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold md:inline-flex"
              title="Portal Inicial"
            >
              <Home className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              Início
            </Link>

            <button
              type="button"
              onClick={() => setLocationModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border-warm)] bg-[var(--bg-canvas)] px-3 py-1.5 text-left text-xs transition hover:border-[var(--accent-primary)]"
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" />
              <span className="max-w-[130px] truncate font-semibold text-[var(--text-primary)] sm:max-w-[200px]">
                {mode === "RETIRADA"
                  ? "Retirar no balcão"
                  : selectedZone
                    ? `Entregar: ${selectedZone.name}`
                    : "Escolher bairro"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
            </button>
          </div>

          <div className="order-3 w-full sm:order-2 sm:max-w-xs sm:flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Busque pães, bolos, cafés..."
                className="input-field py-2 pr-3 pl-9 text-sm"
              />
            </div>
          </div>

          <div className="order-2 flex items-center gap-1.5 sm:order-3">
            <ThemeToggleButton variant="surface" />

            <Link
              href="/conta"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-warm)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
            >
              <User className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              <span className="hidden md:inline">
                {loggedCustomer
                  ? `${loggedCustomer.name.split(" ")[0]} (${loggedCustomer.loyaltyPoints} pts)`
                  : "Minha Conta"}
              </span>
            </Link>

            {recentOrders.length > 0 && (
              <button
                type="button"
                onClick={() => setHistoryModalOpen(true)}
                className="icon-btn px-2.5 py-2 text-xs font-semibold"
                aria-label="Meus pedidos recentes"
              >
                <History className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              key={bagPopKey}
              type="button"
              onClick={() => setBagOpen(true)}
              className={`btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
                bagPopKey > 0 ? "animate-cart-pop" : ""
              }`}
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="font-mono-num rounded bg-black/20 px-1.5 py-0.5 text-[11px]">
                {totalItemsCount}
              </span>
              <span className="font-mono-num">{formatBRL(totals.total)}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-5 sm:px-6">
        {!isDeliveryOpen && (
          <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-xs font-semibold text-amber-900 dark:text-amber-200">
            Pedidos online estão temporariamente pausados pela loja no momento. Você ainda pode consultar o cardápio e sua conta fidelidade.
          </div>
        )}

        {/* Store Info Banner */}
        <section className="cafe-hero-surface animate-cafe-rise rounded-2xl p-5 text-[#F5F3EF] sm:p-7">
          <div className="relative z-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              <div className="pt-1">
                <CoffeeSteamEmblem size="lg" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#FDE6D8]">
                    <Sparkles className="h-3 w-3 text-[#E8643C]" />
                    Fornada artesanal do dia
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      isDeliveryOpen
                        ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30"
                        : "bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/30"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isDeliveryOpen
                          ? "animate-pulse bg-emerald-400"
                          : "bg-amber-400"
                      }`}
                    />
                    {isDeliveryOpen ? "Aberto agora" : "Pausado"}
                  </span>
                </div>
                <h1 className="font-display mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
                  {storeSettings?.storeName ?? "Forno & Mesa"} — Padaria &amp; Bistrô
                </h1>
                <p className="mt-1 text-xs text-stone-300 sm:text-sm">
                  {storeSettings?.slogan ??
                    "Pães de fermentação natural, doces artesanais, cafés especiais e pratos do bistrô."}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-300">
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-300">
                    <Star className="h-3.5 w-3.5 fill-amber-300" />
                    {averageRating.toFixed(1)}
                    {reviewsCount > 0 ? ` (${reviewsCount})` : ""}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-[#E8643C]" />
                    {mode === "RETIRADA"
                      ? "~15-20 min (Retirada)"
                      : `${selectedZone?.etaMinutes ?? 35} min`}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Bike className="h-3.5 w-3.5 text-[#E8643C]" />
                    {mode === "RETIRADA"
                      ? "Retirada grátis"
                      : deliveryFee === 0
                        ? "Entrega grátis"
                        : `Entrega ${formatBRL(deliveryFee)}`}
                  </span>
                  {mode === "DELIVERY" && selectedZone && (
                    <span>Pedido mínimo {formatBRL(selectedZone.minOrder)}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <div className="segmented border border-white/15 bg-black/30">
                <button
                  type="button"
                  data-active={mode === "DELIVERY"}
                  onClick={() => setMode("DELIVERY")}
                  className={mode === "DELIVERY" ? "" : "!text-stone-300 hover:!text-white"}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Bike className="h-3.5 w-3.5" /> Entrega
                  </span>
                </button>
                <button
                  type="button"
                  data-active={mode === "RETIRADA"}
                  onClick={() => setMode("RETIRADA")}
                  className={mode === "RETIRADA" ? "" : "!text-stone-300 hover:!text-white"}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Store className="h-3.5 w-3.5" /> Retirada
                  </span>
                </button>
              </div>
              <p className="text-[11px] font-semibold text-stone-300">
                Cupons:{" "}
                {displayedCoupons.slice(0, 3).map((c, idx) => (
                  <span key={c.code} className="text-amber-300">
                    {idx > 0 ? " · " : ""}
                    {c.code}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </section>

        {/* Destaques Section */}
        {activeCategory === "ALL" && !search.trim() && featuredProducts.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold">Destaques da Casa</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {featuredProducts.slice(0, 4).map(({ product, sector }, idx) => {
                const inCart = cart.find((c) => c.product.id === product.id);
                const isFav = favorites.includes(product.id);
                return (
                  <div
                    key={product.id}
                    onClick={() => openProductModal(product, sector)}
                    style={{ "--stagger": idx } as CSSProperties}
                    className="card-bistro cafe-card-hover cafe-stagger group flex cursor-pointer flex-col justify-between p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--text-secondary)]">
                            Mais pedido
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(product.id);
                            }}
                            aria-label="Favoritar"
                            className={`text-[var(--text-secondary)] transition hover:text-[var(--accent-primary)] ${
                              poppingFavId === product.id ? "animate-heart-pop" : ""
                            }`}
                          >
                            <Heart
                              className={`h-3.5 w-3.5 transition-transform ${
                                isFav
                                  ? "fill-[var(--accent-primary)] text-[var(--accent-primary)]"
                                  : "group-hover:scale-110"
                              }`}
                            />
                          </button>
                        </div>
                        <h3 className="mt-1.5 line-clamp-1 text-sm font-bold">
                          {product.name}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
                          {product.description}
                        </p>
                      </div>
                      <div className="transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-2">
                        <ProductPhoto
                          imageUrl={product.imageUrl}
                          name={product.name}
                          sector={sector}
                          size="md"
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-[var(--border-warm)] pt-2.5">
                      <span className="font-mono-num text-sm font-bold">
                        {formatBRL(product.price)}
                        <span className="text-[11px] font-normal text-[var(--text-secondary)]">
                          /{product.unit}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          addProductDirect(product);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--accent-primary)] bg-[var(--bg-canvas)] px-2.5 py-1 text-xs font-bold text-[var(--accent-primary)] transition duration-200 hover:scale-105 hover:bg-[var(--accent-primary)] hover:text-white active:scale-95"
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

        {/* Sticky Category Tabs + Sort (fixed mobile offset) */}
        <div className="sticky top-[106px] z-20 -mx-4 border-b border-[var(--border-warm)] bg-[var(--bg-canvas)]/95 px-4 backdrop-blur-xs sm:top-[65px] sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveCategory("ALL")}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  activeCategory === "ALL"
                    ? "bg-[var(--accent-primary)] text-white"
                    : "border border-[var(--border-warm)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
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
                      ? "bg-[var(--accent-primary)] text-white"
                      : "border border-[var(--border-warm)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
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
                      ? "bg-[var(--accent-primary)] text-white"
                      : "border border-[var(--border-warm)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "DEFAULT" | "PRICE_ASC" | "FASTEST")
              }
              aria-label="Ordenar cardápio"
              className="input-field w-auto px-2.5 py-1.5 text-xs font-semibold"
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
            <div className="card-bistro p-10 text-center text-sm text-[var(--text-secondary)]">
              {activeCategory === "FAVS"
                ? "Você ainda não favoritou nenhum item."
                : `Nenhum item encontrado para "${search}".`}
            </div>
          ) : (
            visibleCategories.map((cat) => (
              <section key={cat.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold">{cat.name}</h2>
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    {cat.products.length}{" "}
                    {cat.products.length === 1 ? "item" : "itens"}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {cat.products.map((prod, idx) => {
                    const inCart = cart.find((c) => c.product.id === prod.id);
                    const isFav = favorites.includes(prod.id);
                    return (
                      <div
                        key={prod.id}
                        onClick={() => openProductModal(prod, cat.sector)}
                        style={{ "--stagger": Math.min(idx, 10) } as CSSProperties}
                        className="card-bistro cafe-card-hover cafe-stagger group flex cursor-pointer items-center justify-between gap-4 p-4"
                      >
                        <div className="flex min-w-0 flex-1 flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold">{prod.name}</h3>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(prod.id);
                                }}
                                aria-label="Favoritar"
                                className={`text-[var(--text-secondary)] transition hover:text-[var(--accent-primary)] ${
                                  poppingFavId === prod.id ? "animate-heart-pop" : ""
                                }`}
                              >
                                <Heart
                                  className={`h-3.5 w-3.5 transition-transform ${
                                    isFav
                                      ? "fill-[var(--accent-primary)] text-[var(--accent-primary)]"
                                      : "group-hover:scale-110"
                                  }`}
                                />
                              </button>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
                              {prod.description}
                            </p>
                          </div>
                          <div className="mt-3 flex items-center gap-3">
                            <span className="font-mono-num text-sm font-bold">
                              {formatBRL(prod.price)}
                              <span className="text-[11px] font-normal text-[var(--text-secondary)]">
                                /{prod.unit}
                              </span>
                            </span>
                            <span className="text-[11px] text-[var(--text-secondary)]">
                              ~{prod.prepTimeMinutes} min
                            </span>
                          </div>
                        </div>

                        <div className="relative shrink-0">
                          <div className="transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-2">
                            <ProductPhoto
                              imageUrl={prod.imageUrl}
                              name={prod.name}
                              sector={cat.sector}
                              size="md"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              addProductDirect(prod);
                            }}
                            aria-label={`Adicionar ${prod.name}`}
                            className={`absolute -right-1.5 -bottom-1.5 flex h-7 items-center justify-center rounded-full border px-2 text-xs font-bold shadow-xs transition duration-200 hover:scale-110 active:scale-95 ${
                              inCart
                                ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white"
                                : "border-[var(--border-warm)] bg-[var(--bg-surface)] text-[var(--accent-primary)] hover:border-[var(--accent-primary)]"
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

      {/* Footer */}
      <footer className="cafe-sidebar mt-12 border-t pb-20 text-stone-100 lg:pb-8">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6">
          <div>
            <p className="font-display text-base font-bold text-white">
              {storeSettings?.storeName ?? "Forno & Mesa"} — Padaria &amp; Bistrô
            </p>
            <p className="mt-1 text-xs text-stone-300">
              {storeSettings?.address ?? "Rua das Flores, 240 — Centro"}
            </p>
          </div>
          <div className="text-xs text-stone-300">
            <p className="font-semibold text-white">Horário de Atendimento</p>
            <p className="mt-1">
              {storeSettings?.openingHours ?? "Ter–Dom · 07:00 às 22:00"}
            </p>
            <p className="mt-1">Tel: {storeSettings?.phone ?? "(11) 99999-0000"}</p>
          </div>
          <div className="text-xs text-stone-300">
            <p className="font-semibold text-white">Clube &amp; Pagamento</p>
            <p className="mt-1">PIX, Cartão de Crédito/Débito e Dinheiro na entrega.</p>
            <p className="mt-1">Frete grátis acima de {formatBRL(freeAboveThreshold)}.</p>
            <div className="mt-3 flex flex-wrap gap-3 border-t border-white/10 pt-2.5 text-[11px]">
              <Link href="/" className="text-stone-300 transition hover:text-white">
                Início
              </Link>
              <Link href="/conta" className="text-stone-300 transition hover:text-white">
                Clube Fidelidade
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-[#E8643C] transition hover:underline"
              >
                <Lock className="h-3 w-3" /> Área da Equipe
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Floating Sacola Bar */}
      {cart.length > 0 && !bagOpen && (
        <div className="cafe-topbar safe-bottom animate-sheet-up fixed inset-x-0 bottom-0 z-30 border-t p-3 shadow-lg lg:hidden">
          <button
            key={bagPopKey}
            type="button"
            onClick={() => setBagOpen(true)}
            className={`btn-primary flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-bold ${
              bagPopKey > 0 ? "animate-cart-pop" : ""
            }`}
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
          className="animate-backdrop-fade fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={() => setHistoryModalOpen(false)}
        >
          <div
            className="card-bistro animate-scale-in w-full max-w-md p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-warm)] pb-3">
              <h3 className="font-display text-base font-bold">
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
                  className="flex items-center justify-between rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-xs transition hover:border-[var(--accent-primary)]"
                >
                  <div>
                    <p className="font-mono-num font-bold">{ord.code}</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      {new Date(ord.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-num font-bold text-[var(--accent-primary)]">
                      {formatBRL(ord.total)}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
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
          className="animate-backdrop-fade fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={() => setLocationModalOpen(false)}
        >
          <div
            className="card-bistro animate-scale-in w-full max-w-md p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-warm)] pb-3">
              <h3 className="font-display text-base font-bold">
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
              <div className="segmented grid w-full grid-cols-2">
                <button
                  type="button"
                  data-active={mode === "DELIVERY"}
                  onClick={() => setMode("DELIVERY")}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Bike className="h-4 w-4" /> Delivery
                  </span>
                </button>
                <button
                  type="button"
                  data-active={mode === "RETIRADA"}
                  onClick={() => {
                    setMode("RETIRADA");
                    setLocationModalOpen(false);
                  }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Store className="h-4 w-4" /> Retirar no Balcão
                  </span>
                </button>
              </div>

              {mode === "DELIVERY" && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[var(--text-secondary)]">
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
                            ? "border-[var(--accent-primary)] bg-[var(--bg-subtle)]/40"
                            : "border-[var(--border-warm)] bg-[var(--bg-canvas)] hover:border-[var(--accent-primary)]"
                        }`}
                      >
                        <div>
                          <p className="font-bold">{z.name}</p>
                          <p className="text-[11px] text-[var(--text-secondary)]">
                            ~{z.etaMinutes} min · Mín. {formatBRL(z.minOrder)}
                          </p>
                        </div>
                        <span className="font-mono-num font-bold">
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
          className="animate-backdrop-fade fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-xs sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="card-bistro animate-sheet-up sm:animate-scale-in w-full max-w-lg rounded-t-2xl p-5 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border-warm)] pb-4">
              <div className="flex items-start gap-3">
                <ProductPhoto
                  imageUrl={selectedProduct.product.imageUrl}
                  name={selectedProduct.product.name}
                  sector={selectedProduct.sector}
                  size="md"
                />
                <div>
                  <h3 className="font-display text-base font-bold">
                    {selectedProduct.product.name}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {selectedProduct.product.description}
                  </p>
                  <p className="font-mono-num mt-2 text-sm font-bold">
                    {formatBRL(selectedProduct.product.price)}
                    <span className="text-xs font-normal text-[var(--text-secondary)]">
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
                <div className="flex items-center gap-2 rounded-lg border border-[var(--border-warm)] bg-[var(--bg-canvas)] px-2 py-1">
                  <button
                    type="button"
                    onClick={() => {
                      const step = selectedProduct.product.unit === "KG" ? 0.1 : 1;
                      setModalQty((q) => Math.max(step, Number((q - step).toFixed(3))));
                    }}
                    className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
                    className="p-1 text-[var(--accent-primary)]"
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
                  className="btn-primary flex flex-1 items-center justify-between rounded-lg px-4 py-2.5 text-sm font-bold"
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
          className="animate-backdrop-fade fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={() => setBagOpen(false)}
        >
          <div
            className="animate-drawer-left flex h-full w-full max-w-md flex-col border-l border-[var(--border-warm)] bg-[var(--bg-surface)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-warm)] px-5 py-4">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-[var(--accent-primary)]" />
                <h2 className="font-display text-base font-bold">Sua sacola</h2>
                {cart.length > 0 && (
                  <span className="font-mono-num rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] font-semibold">
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

            <form
              onSubmit={handleCheckout}
              className="flex flex-1 flex-col justify-between overflow-y-auto"
            >
              <div className="space-y-4 p-5">
                <div className="segmented grid w-full grid-cols-2">
                  <button
                    type="button"
                    data-active={mode === "DELIVERY"}
                    onClick={() => setMode("DELIVERY")}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Bike className="h-4 w-4" /> Entrega
                    </span>
                  </button>
                  <button
                    type="button"
                    data-active={mode === "RETIRADA"}
                    onClick={() => setMode("RETIRADA")}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Store className="h-4 w-4" /> Retirada
                    </span>
                  </button>
                </div>

                {mode === "DELIVERY" && (
                  <div className="rounded-lg border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3 text-[11px]">
                    <div className="flex items-center justify-between font-semibold">
                      <span>
                        {freeShippingRemaining === 0
                          ? "Frete grátis desbloqueado!"
                          : `Faltam ${formatBRL(freeShippingRemaining)} para frete grátis`}
                      </span>
                      <span className="font-mono-num text-[var(--text-secondary)]">
                        {freeShippingPct}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                      <div
                        className="cafe-shimmer h-full rounded-full bg-[var(--accent-primary)] transition-all duration-500 ease-out"
                        style={{ width: `${freeShippingPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {cart.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--border-warm)] bg-[var(--bg-canvas)] p-8 text-center">
                    <ShoppingBag className="mx-auto h-8 w-8 text-[var(--text-secondary)]" />
                    <p className="mt-2 text-xs font-semibold">
                      Sua sacola está vazia
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                      Adicione itens do cardápio para fazer seu pedido.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {cart.map((line) => (
                      <div
                        key={line.product.id}
                        className="rounded-lg border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-bold">{line.product.name}</p>
                            <p className="font-mono-num text-[11px] text-[var(--text-secondary)]">
                              {formatBRL(line.product.price)}/{line.product.unit}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateQty(line.product.id, 0)}
                            className="text-[var(--text-secondary)] hover:text-red-700"
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
                          <span className="font-mono-num font-bold text-[var(--accent-primary)]">
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

                {cart.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-[var(--text-secondary)]">
                      <Tag className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
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
                        className="shrink-0 rounded-lg bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[var(--accent-primary-dark)]"
                      >
                        Aplicar
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {displayedCoupons.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => handleApplyCoupon(c.code)}
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition ${
                            appliedCoupon === c.code
                              ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white"
                              : "border-[var(--border-warm)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]"
                          }`}
                        >
                          {c.code} · {c.label}
                        </button>
                      ))}
                    </div>
                    {couponError && (
                      <p className="text-[11px] font-semibold text-red-600">{couponError}</p>
                    )}
                    {couponBenefit.valid && (
                      <p className="text-[11px] font-semibold text-emerald-600">
                        Cupom {couponBenefit.code} aplicado: {couponBenefit.label}
                      </p>
                    )}
                  </div>
                )}

                {canRedeemLoyalty && (
                  <label className="flex cursor-pointer items-center justify-between rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    <span className="inline-flex items-center gap-1.5">
                      <Award className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Usar 10 pontos fidelidade (-R$ 15,00)
                    </span>
                    <input
                      type="checkbox"
                      checked={redeemPoints}
                      onChange={(e) => setRedeemPoints(e.target.checked)}
                      className="h-4 w-4 accent-emerald-600"
                    />
                  </label>
                )}

                {cart.length > 0 && (
                  <div className="space-y-3 border-t border-[var(--border-warm)] pt-4">
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

                    {/* Scheduling */}
                    <div className="space-y-1.5">
                      <span className="field-label">Horário</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setScheduleChoice("NOW")}
                          className={`rounded-lg py-1.5 text-xs font-bold transition ${
                            scheduleChoice === "NOW"
                              ? "bg-[var(--accent-primary)] text-white"
                              : "border border-[var(--border-warm)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]"
                          }`}
                        >
                          Receber Agora (~{etaMinutes}m)
                        </button>
                        <button
                          type="button"
                          onClick={() => setScheduleChoice("SCHEDULED")}
                          className={`rounded-lg py-1.5 text-xs font-bold transition ${
                            scheduleChoice === "SCHEDULED"
                              ? "bg-[var(--accent-primary)] text-white"
                              : "border border-[var(--border-warm)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]"
                          }`}
                        >
                          Agendar Horário
                        </button>
                      </div>
                      {scheduleChoice === "SCHEDULED" && (
                        <input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="input-field font-mono-num"
                        />
                      )}
                    </div>

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
                                  ? "bg-[var(--accent-primary)] text-white"
                                  : "border border-[var(--border-warm)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]"
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

              {cart.length > 0 && (
                <div className="safe-bottom space-y-3 border-t border-[var(--border-warm)] bg-[var(--bg-canvas)] p-5">
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>Subtotal</span>
                      <span className="font-mono-num font-semibold">
                        {formatBRL(totals.subtotal)}
                      </span>
                    </div>
                    {totals.discount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>
                          Desconto{" "}
                          {couponBenefit.valid ? `(${couponBenefit.code})` : "(Fidelidade)"}
                        </span>
                        <span className="font-mono-num font-semibold">
                          -{formatBRL(totals.discount)}
                        </span>
                      </div>
                    )}
                    {mode === "DELIVERY" && (
                      <div className="flex justify-between text-[var(--text-secondary)]">
                        <span>Taxa de entrega ({selectedZone?.name ?? "—"})</span>
                        <span className="font-mono-num font-semibold">
                          {totals.deliveryFee === 0
                            ? "Grátis"
                            : formatBRL(totals.deliveryFee)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-[var(--border-warm)] pt-2 text-sm font-bold">
                      <span>Total</span>
                      <span className="font-mono-num text-[var(--accent-primary)]">
                        {formatBRL(totals.total)}
                      </span>
                    </div>
                  </div>

                  {minMissing > 0 && (
                    <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
                      Pedido mínimo para {selectedZone?.name}:{" "}
                      {formatBRL(selectedZone?.minOrder ?? 0)} (faltam{" "}
                      {formatBRL(minMissing)}).
                    </p>
                  )}

                  {error && (
                    <p className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-900 dark:text-red-200">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={
                      !isDeliveryOpen || cart.length === 0 || minMissing > 0 || submitting
                    }
                    className="btn-primary flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {!isDeliveryOpen
                      ? "Loja Pausada"
                      : submitting
                        ? "Enviando pedido..."
                        : `Fazer pedido · ${formatBRL(totals.total)}`}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
      <CafeFloatingToast
        message={quickToast}
        offsetBottom={cart.length > 0 && !bagOpen}
      />
    </div>
  );
}
