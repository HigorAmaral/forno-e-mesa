"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChefHat,
  Clock,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { formatBRL } from "@/lib/domain";
import type { CategoryDto, OrderItemDto, ProductDto } from "@/types/erp";

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
  PENDENTE: { label: "Na fila", badge: "bg-amber-100 text-amber-800" },
  PREPARANDO: { label: "Preparando", badge: "bg-orange-100 text-orange-800" },
  PRONTO: { label: "Pronto!", badge: "bg-emerald-100 text-emerald-800" },
  ENTREGUE: { label: "Entregue", badge: "bg-stone-100 text-stone-700" },
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
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requestingBill, setRequestingBill] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

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
    const timer = setInterval(refreshTable, 6000);
    return () => clearInterval(timer);
  }, [refreshTable]);

  const visibleCategories = useMemo(() => {
    if (selectedCategoryId === "ALL") return categories;
    return categories.filter((c) => c.id === selectedCategoryId);
  }, [categories, selectedCategoryId]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.product.price * l.qty, 0),
    [cart],
  );

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
  }

  function updateQty(productId: number, delta: number) {
    setCart((prev) =>
      prev
        .map((line) =>
          line.product.id === productId
            ? { ...line, qty: Number((line.qty + delta).toFixed(2)) }
            : line,
        )
        .filter((line) => line.qty > 0),
    );
  }

  function updateNotes(productId: number, notes: string) {
    setCart((prev) =>
      prev.map((line) => (line.product.id === productId ? { ...line, notes } : line)),
    );
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
      setFeedback("Garçom notificado! Sua conta foi solicitada para a mesa.");
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
      setFeedback(`Pedido enviado para a cozinha! Comanda ${json.order.code} atualizada.`);
      await refreshTable();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f6f3] pb-28">
      <header className="sticky top-0 z-20 border-b border-[#e5e4df] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3.5">
          <div>
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-[#d95d24]" />
              <h1 className="font-display text-lg font-bold text-[#121417]">
                Forno & Mesa
              </h1>
            </div>
            <p className="text-xs text-[#5a5f67]">
              {tableName} · {area} · Cardápio Digital
            </p>
          </div>

          <span className="rounded-full border border-[#e5e4df] bg-[#f6f6f3] px-3 py-1.5 text-xs font-semibold text-[#5a5f67]">
            Cardápio da Mesa
          </span>
        </div>

        <div className="mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 pb-3">
          <button
            type="button"
            onClick={() => setSelectedCategoryId("ALL")}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              selectedCategoryId === "ALL"
                ? "bg-[#121417] text-white"
                : "bg-[#eeeeea] text-[#5a5f67]"
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
                  ? "bg-[#d95d24] text-white"
                  : "bg-[#eeeeea] text-[#5a5f67]"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 pt-5">
        {feedback && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
            {feedback}
          </div>
        )}

        {activeCommand && (
          <section className="card-bistro animate-fade-in p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ChefHat className="h-4 w-4 text-[#d95d24]" />
                <h2 className="text-sm font-bold text-[#121417]">
                  Comanda Aberta · {activeCommand.code}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono-num text-sm font-bold text-[#d95d24]">
                  {formatBRL(activeCommand.total)}
                </span>
                <button
                  type="button"
                  disabled={requestingBill}
                  onClick={requestTableBill}
                  className="rounded-xl border border-orange-300 bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-900 hover:bg-orange-100 disabled:opacity-50"
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
                    className="flex items-center justify-between rounded-xl bg-[#f6f6f3] px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-[#121417]">
                        {item.qty}× {item.productName}
                      </p>
                      {item.notes && (
                        <p className="text-[11px] text-[#5a5f67]">Obs: {item.notes}</p>
                      )}
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${st.badge}`}>
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {visibleCategories.map((category) => (
          <section key={category.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-[#121417]">
                {category.name}
              </h2>
              <span className="text-xs font-medium text-[#5a5f67]">
                {category.products.length} opções
              </span>
            </div>

            <div className="space-y-2.5">
              {category.products.map((product) => {
                const inCart = cart.find((c) => c.product.id === product.id);
                return (
                  <div
                    key={product.id}
                    className="rounded-2xl border border-[#e5e4df] bg-white p-4 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-[#121417]">{product.name}</h3>
                          {product.isFeatured && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              <Sparkles className="h-3 w-3" /> Destaque
                            </span>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed text-[#5a5f67]">
                          {product.description}
                        </p>
                        <div className="flex items-center gap-3 pt-1 text-xs text-[#5a5f67]">
                          <span className="font-mono-num text-sm font-bold text-[#121417]">
                            {formatBRL(product.price)}{" "}
                            <span className="text-[11px] font-normal text-[#5a5f67]">
                              / {product.unit}
                            </span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> ~{product.prepTimeMinutes} min
                          </span>
                        </div>
                      </div>

                      {!inCart ? (
                        <button
                          type="button"
                          onClick={() => addToCart(product)}
                          className="shrink-0 rounded-xl bg-[#d95d24] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#b84917]"
                        >
                          + Adicionar
                        </button>
                      ) : (
                        <div className="flex shrink-0 items-center gap-2 rounded-xl border border-[#e5e4df] bg-[#f6f6f3] px-2 py-1">
                          <button
                            type="button"
                            onClick={() => updateQty(product.id, -1)}
                            className="rounded-lg p-1 text-[#121417] hover:bg-white"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="font-mono-num min-w-5 text-center text-xs font-bold">
                            {inCart.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQty(product.id, 1)}
                            className="rounded-lg p-1 text-[#121417] hover:bg-white"
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
                        className="mt-3 w-full rounded-xl border border-[#e5e4df] bg-[#f6f6f3] px-3 py-2 text-xs text-[#121417] outline-none focus:border-[#d95d24]"
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
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e5e4df] bg-white p-4 shadow-2xl">
          <div className="mx-auto flex max-w-2xl flex-col gap-2.5 sm:flex-row sm:items-center">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Seu nome (opcional)"
              className="rounded-xl border border-[#e5e4df] bg-[#f6f6f3] px-3 py-2 text-xs outline-none focus:border-[#d95d24] sm:w-44"
            />
            <button
              type="button"
              onClick={submitQrOrder}
              disabled={submitting}
              className="flex flex-1 items-center justify-between rounded-xl bg-[#d95d24] px-4 py-3 text-sm font-semibold text-white hover:bg-[#b84917] disabled:opacity-60"
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                {submitting
                  ? "Enviando pedido..."
                  : `Enviar para Cozinha (${cart.length} ${cart.length === 1 ? "item" : "itens"})`}
              </span>
              <span className="font-mono-num">{formatBRL(cartTotal)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
