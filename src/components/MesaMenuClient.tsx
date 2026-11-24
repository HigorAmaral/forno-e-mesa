"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  CheckCircle2,
  ChefHat,
  Clock,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Split,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { formatBRL, splitBillAmount } from "@/lib/domain";
import type { CategoryDto, OrderItemDto, ProductDto } from "@/types/erp";
import { CafeFloatingToast, CoffeeSteamEmblem } from "./CafeAtmosphere";
import { ProductPhoto } from "./ProductPhoto";

interface MesaMenuCategory extends CategoryDto {
  products: Array<Omit<ProductDto, "category">>;
}

interface MesaOrder {
  id: number;
  code: string;
  status: string;
  subtotal: number;
  serviceFee: number;
  total: number;
  items: OrderItemDto[];
}

interface MesaMenuClientProps {
  tableNumber: number;
  tableName: string;
  area: string;
  qrToken: string;
  initialCategories: MesaMenuCategory[];
  initialOrders: MesaOrder[];
}

interface CartLine {
  product: Omit<ProductDto, "category">;
  qty: number;
  notes: string;
}

const STATUS_LABELS: Record<string, { label: string; badge: string }> = {
  PENDENTE: {
    label: "Na fila",
    badge: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  },
  PREPARANDO: {
    label: "Preparando",
    badge: "bg-orange-500/15 text-orange-800 dark:text-orange-300",
  },
  PRONTO: {
    label: "Pronto!",
    badge: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  },
  ENTREGUE: {
    label: "Entregue",
    badge: "bg-stone-500/15 text-stone-700 dark:text-stone-300",
  },
};

export function MesaMenuClient({
  tableNumber,
  tableName,
  area,
  qrToken,
  initialCategories,
  initialOrders,
}: MesaMenuClientProps) {
  const [categories, setCategories] = useState<MesaMenuCategory[]>(initialCategories);
  const [orders, setOrders] = useState<MesaOrder[]>(initialOrders);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [splitPeople, setSplitPeople] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [requestingBill, setRequestingBill] = useState(false);
  const [callingWaiter, setCallingWaiter] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [floatingToast, setFloatingToast] = useState<string | null>(null);
  const [cartPopKey, setCartPopKey] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setFloatingToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setFloatingToast(null), 2600);
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const refreshTable = useCallback(async () => {
    const res = await fetch(
      `/api/tables/${tableNumber}?token=${encodeURIComponent(qrToken)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return;
    const data = await res.json();
    if (data.categories) setCategories(data.categories);
    if (data.table?.orders) setOrders(data.table.orders);
  }, [tableNumber, qrToken]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void refreshTable();
    }, 5000);
    return () => clearInterval(timer);
  }, [refreshTable]);

  useEffect(() => {
    if (!confirmOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmOpen]);

  const visibleCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories
      .filter((c) => selectedCategoryId === "ALL" || c.id === selectedCategoryId)
      .map((c) => ({
        ...c,
        products: q
          ? c.products.filter(
              (p) =>
                p.name.toLowerCase().includes(q) ||
                p.description.toLowerCase().includes(q),
            )
          : c.products,
      }))
      .filter((c) => c.products.length > 0);
  }, [categories, selectedCategoryId, search]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.product.price * l.qty, 0),
    [cart],
  );

  const suggestedAddons = useMemo(() => {
    const inCartIds = new Set(cart.map((c) => c.product.id));
    const candidates: Array<{
      product: Omit<ProductDto, "category">;
      sector: string;
    }> = [];
    for (const cat of categories) {
      for (const p of cat.products) {
        if (!inCartIds.has(p.id)) {
          candidates.push({ product: p, sector: cat.sector });
        }
      }
    }
    candidates.sort((a, b) => Number(b.product.isFeatured) - Number(a.product.isFeatured));
    return candidates.slice(0, 3);
  }, [categories, cart]);

  const activeCommand = orders[0] ?? null;

  function addToCart(product: Omit<ProductDto, "category">) {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        return prev.map((line, i) =>
          i === idx ? { ...line, qty: Number((line.qty + 1).toFixed(2)) } : line,
        );
      }
      return [...prev, { product, qty: 1, notes: "" }];
    });
    setCartPopKey((k) => k + 1);
    showToast(`${product.name} adicionado ao pedido`);
  }

  function updateQty(productId: number, delta: number) {
    setCart((prev) => {
      const next = prev
        .map((line) =>
          line.product.id === productId
            ? { ...line, qty: Number((line.qty + delta).toFixed(2)) }
            : line,
        )
        .filter((line) => line.qty > 0);
      if (next.length === 0) {
        setConfirmOpen(false);
      }
      return next;
    });
  }

  function removeFromCart(productId: number) {
    setCart((prev) => {
      const next = prev.filter((line) => line.product.id !== productId);
      if (next.length === 0) {
        setConfirmOpen(false);
      }
      return next;
    });
  }

  function updateNotes(productId: number, notes: string) {
    setCart((prev) =>
      prev.map((line) => (line.product.id === productId ? { ...line, notes } : line)),
    );
  }

  async function callWaiter() {
    if (callingWaiter) return;
    setCallingWaiter(true);
    try {
      const res = await fetch(`/api/tables/${tableNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CALL_WAITER", qrToken }),
      });
      if (!res.ok) {
        setFeedback("Não foi possível chamar o garçom no momento.");
        return;
      }
      const msg = "Garçom chamado! Em instantes alguém atenderá sua mesa.";
      setFeedback(msg);
      showToast(msg);
    } finally {
      setCallingWaiter(false);
    }
  }

  async function requestTableBill() {
    if (requestingBill) return;
    setRequestingBill(true);
    try {
      const res = await fetch(`/api/tables/${tableNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CONTA", qrToken }),
      });
      if (!res.ok) {
        setFeedback("Não foi possível chamar o garçom no momento.");
        return;
      }
      const msg = "Garçom notificado! Sua conta foi solicitada para a mesa.";
      setFeedback(msg);
      showToast(msg);
      await refreshTable();
    } finally {
      setRequestingBill(false);
    }
  }

  async function submitQrOrder() {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "QR_MESA",
          tableNumber,
          qrToken,
          customerName: customerName.trim() || undefined,
          applyServiceFee: true,
          items: cart.map((line) => ({
            productId: line.product.id,
            qty: line.qty,
            notes: line.notes.trim() || undefined,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback(json.error ?? "Não foi possível enviar seu pedido.");
        return;
      }
      setCart([]);
      setConfirmOpen(false);
      const msg = `Pedido enviado para a cozinha! Comanda ${json.order.code} atualizada.`;
      setFeedback(msg);
      showToast(msg);
      await refreshTable();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-32">
      <header className="cafe-topbar sticky top-0 z-20 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-[var(--accent-primary)]" />
              <h1 className="font-display text-lg font-bold">Forno & Mesa</h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              {tableName} · {area} · Cardápio Digital
            </p>
          </div>

          <button
            type="button"
            disabled={callingWaiter}
            onClick={callWaiter}
            className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/35 bg-orange-500/10 px-3 py-1.5 text-xs font-bold text-orange-800 transition hover:bg-orange-500/20 disabled:opacity-50 dark:text-orange-200"
          >
            <BellRing className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
            {callingWaiter ? "Chamando..." : "Chamar Garçom"}
          </button>
        </div>

        <div className="mx-auto max-w-2xl space-y-2.5 px-4 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar prato, café, pão ou doce..."
              className="input-field py-1.5 pl-8 text-xs"
            />
          </div>

          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedCategoryId("ALL")}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                selectedCategoryId === "ALL"
                  ? "bg-[var(--accent-primary)] text-white"
                  : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
              }`}
            >
              Tudo
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  selectedCategoryId === cat.id
                    ? "bg-[var(--accent-primary)] text-white"
                    : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 pt-5">
        <section className="cafe-hero-surface animate-cafe-rise rounded-2xl p-4 text-[#F5F3EF] sm:p-5">
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <CoffeeSteamEmblem size="md" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#FDE6D8]">
                  {area} · Cardápio à Mesa
                </p>
                <h2 className="font-display text-lg font-bold text-white sm:text-xl">
                  Bem-vindo à {tableName}
                </h2>
                <p className="text-xs text-stone-300">
                  Peça direto para a cozinha ou confeitaria com preparo artesanal na hora.
                </p>
              </div>
            </div>
            <span className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-amber-200 sm:inline-flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Mesa conectada
            </span>
          </div>
        </section>

        {feedback && (
          <div
            role="status"
            className="animate-scale-in flex items-center gap-2 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-900 dark:text-emerald-200"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            {feedback}
          </div>
        )}

        {activeCommand && (
          <section className="card-bistro animate-fade-in p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ChefHat className="h-4 w-4 text-[var(--accent-primary)]" />
                <h2 className="text-sm font-bold">
                  Comanda Aberta · {activeCommand.code}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono-num text-sm font-bold text-[var(--accent-primary)]">
                  {formatBRL(activeCommand.total)}
                </span>
                <button
                  type="button"
                  disabled={requestingBill}
                  onClick={requestTableBill}
                  className="rounded-xl border border-orange-500/35 bg-orange-500/10 px-2.5 py-1 text-[11px] font-bold text-orange-800 transition hover:bg-orange-500/20 disabled:opacity-50 dark:text-orange-200"
                >
                  {requestingBill ? "Chamando..." : "Pedir a Conta"}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {activeCommand.items.map((item) => {
                const st = STATUS_LABELS[item.itemStatus] ?? STATUS_LABELS.PENDENTE;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl bg-[var(--bg-canvas)] px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-semibold">
                        {item.qty}× {item.productName}
                      </p>
                      {item.notes && (
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          Obs: {item.notes}
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${st.badge}`}
                    >
                      {(item.itemStatus === "PENDENTE" || item.itemStatus === "PREPARANDO") && (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                      )}
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Split Bill Calculator */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] px-3 py-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--text-secondary)]">
                <Split className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                Simular divisão da conta:
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={splitPeople}
                  onChange={(e) => setSplitPeople(Number(e.target.value))}
                  className="input-field w-auto py-1 text-xs font-bold"
                  aria-label="Dividir conta por quantas pessoas"
                >
                  {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "pessoa" : "pessoas"}
                    </option>
                  ))}
                </select>
                {splitPeople > 1 && (
                  <span className="font-mono-num font-bold text-[var(--accent-primary)]">
                    {formatBRL(splitBillAmount(activeCommand.total, splitPeople))}/pessoa
                  </span>
                )}
              </div>
            </div>
          </section>
        )}

        {visibleCategories.map((category) => (
          <section key={category.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">{category.name}</h2>
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                {category.products.length} opções
              </span>
            </div>

            <div className="space-y-2.5">
              {category.products.map((product, idx) => {
                const inCart = cart.find((c) => c.product.id === product.id);
                return (
                  <div
                    key={product.id}
                    style={{ "--stagger": Math.min(idx, 10) } as CSSProperties}
                    className="card-bistro cafe-card-hover cafe-stagger group p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <ProductPhoto
                          imageUrl={product.imageUrl}
                          name={product.name}
                          sector={category.sector}
                          size="md"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{product.name}</h3>
                            {product.isFeatured && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                                <Sparkles className="h-3 w-3" /> Destaque
                              </span>
                            )}
                          </div>
                          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                            {product.description}
                          </p>
                          <div className="flex items-center gap-3 pt-1 text-xs text-[var(--text-secondary)]">
                            <span className="font-mono-num text-sm font-bold text-[var(--text-primary)]">
                              {formatBRL(product.price)}{" "}
                              <span className="text-[11px] font-normal text-[var(--text-secondary)]">
                                / {product.unit}
                              </span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" /> ~{product.prepTimeMinutes} min
                            </span>
                          </div>
                        </div>
                      </div>

                      {!inCart ? (
                        <button
                          type="button"
                          onClick={() => addToCart(product)}
                          className="btn-primary shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold"
                        >
                          + Adicionar
                        </button>
                      ) : (
                        <div className="flex shrink-0 items-center gap-2 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] px-2 py-1">
                          <button
                            type="button"
                            onClick={() => updateQty(product.id, -1)}
                            className="rounded-lg p-1 hover:bg-[var(--bg-surface)]"
                            aria-label="Diminuir quantidade"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="font-mono-num min-w-5 text-center text-xs font-bold">
                            {inCart.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQty(product.id, 1)}
                            className="rounded-lg p-1 hover:bg-[var(--bg-surface)]"
                            aria-label="Aumentar quantidade"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {inCart && (
                      <input
                        type="text"
                        value={inCart.notes}
                        onChange={(e) => updateNotes(product.id, e.target.value)}
                        placeholder="Observação para cozinha/confeitaria (ex: sem cebola, ponto da carne)..."
                        className="input-field mt-3 py-2 text-xs"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      {cart.length > 0 && (
        <div className="cafe-topbar safe-bottom animate-sheet-up fixed inset-x-0 bottom-0 z-30 border-t p-4 shadow-2xl">
          <div className="mx-auto flex max-w-2xl flex-col gap-2.5 sm:flex-row sm:items-center">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Seu nome (opcional)"
              className="input-field py-2 text-xs sm:w-44"
            />
            <button
              key={cartPopKey}
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={submitting}
              className={`btn-primary flex flex-1 items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60 ${
                cartPopKey > 0 ? "animate-cart-pop" : ""
              }`}
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                {submitting
                  ? "Enviando pedido..."
                  : `Revisar e Confirmar (${cart.length} ${cart.length === 1 ? "item" : "itens"})`}
              </span>
              <span className="font-mono-num">{formatBRL(cartTotal)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal de Revisão e Confirmação antes de enviar para a comanda */}
      {confirmOpen && cart.length > 0 && (
        <div
          className="animate-backdrop-fade fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar pedido da mesa"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="card-bistro animate-sheet-up sm:animate-scale-in flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border-warm)] px-5 py-4">
              <div>
                <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
                  Confirmar seu pedido?
                </h3>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Confira os itens antes de enviar para a cozinha. Você pode aumentar, remover ou pedir mais itens.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="icon-btn shrink-0"
                aria-label="Fechar confirmação"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="space-y-2.5">
                {cart.map((line) => (
                  <div
                    key={line.product.id}
                    className="rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <ProductPhoto
                          imageUrl={line.product.imageUrl}
                          name={line.product.name}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[var(--text-primary)]">
                            {line.product.name}
                          </p>
                          <p className="font-mono-num text-[11px] text-[var(--text-secondary)]">
                            {formatBRL(line.product.price)} / {line.product.unit}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(line.product.id)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-500/10 dark:text-red-400"
                        aria-label={`Remover ${line.product.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remover
                      </button>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-surface)] px-2 py-1">
                        <button
                          type="button"
                          onClick={() => updateQty(line.product.id, -1)}
                          className="rounded-lg p-1 hover:bg-[var(--bg-canvas)]"
                          aria-label="Diminuir quantidade"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="font-mono-num min-w-6 text-center text-xs font-bold">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(line.product.id, 1)}
                          className="rounded-lg p-1 text-[var(--accent-primary)] hover:bg-[var(--bg-canvas)]"
                          aria-label="Aumentar quantidade"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="font-mono-num text-sm font-bold text-[var(--accent-primary)]">
                        {formatBRL(line.qty * line.product.price)}
                      </span>
                    </div>

                    <input
                      type="text"
                      value={line.notes}
                      onChange={(e) => updateNotes(line.product.id, e.target.value)}
                      placeholder="Observação deste item (opcional)..."
                      className="input-field mt-2 py-1.5 text-[11px]"
                    />
                  </div>
                ))}
              </div>

              {suggestedAddons.length > 0 && (
                <div className="rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    <Sparkles className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                    Quer pedir mais alguma coisa?
                  </p>
                  <div className="space-y-2">
                    {suggestedAddons.map(({ product, sector }) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-warm)] bg-[var(--bg-surface)] px-2.5 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <ProductPhoto
                            imageUrl={product.imageUrl}
                            name={product.name}
                            sector={sector}
                            size="xs"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold">
                              {product.name}
                            </p>
                            <p className="font-mono-num text-[11px] text-[var(--accent-primary)]">
                              {formatBRL(product.price)}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => addToCart(product)}
                          className="shrink-0 rounded-lg border border-[var(--accent-primary)] px-2.5 py-1 text-[11px] font-bold text-[var(--accent-primary)] transition hover:bg-[var(--accent-primary)] hover:text-white"
                        >
                          + Adicionar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <label className="field-label">
                Seu nome para identificação na comanda (opcional)
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ex: Maria"
                  className="input-field py-2 text-xs"
                />
              </label>
            </div>

            <div className="safe-bottom space-y-2.5 border-t border-[var(--border-warm)] bg-[var(--bg-canvas)] px-5 py-4">
              <div className="flex items-center justify-between text-sm font-bold">
                <span>Total deste envio ({tableName})</span>
                <span className="font-mono-num text-base text-[var(--accent-primary)]">
                  {formatBRL(cartTotal)}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  className="rounded-xl border border-[var(--border-warm)] bg-[var(--bg-surface)] px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
                >
                  Pedir mais no cardápio
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={submitQrOrder}
                  className="btn-primary inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {submitting ? "Enviando pedido..." : "Confirmar e enviar pedido"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CafeFloatingToast message={floatingToast} offsetBottom={cart.length > 0} />
    </div>
  );
}
