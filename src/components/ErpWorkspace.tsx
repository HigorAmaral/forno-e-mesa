"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  Boxes,
  CakeSlice,
  CheckSquare,
  ChefHat,
  ClipboardList,
  Coffee,
  Croissant,
  Download,
  Landmark,
  LayoutDashboard,
  Menu,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  ShoppingCart,
  Square,
  StickyNote,
  Target,
  Trash2,
  Truck,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { channelLabel, computeSalesByHour, formatBRL } from "@/lib/domain";
import type { OrderDto, WorkspaceSnapshotDto } from "@/types/erp";
import { PosSection } from "./PosSection";
import { TablesSection } from "./TablesSection";
import { KdsSection } from "./KdsSection";
import { BakeryCakeSection } from "./BakeryCakeSection";
import { CustomersSection } from "./CustomersSection";
import { FinanceSection } from "./FinanceSection";
import { InventoryCashSection } from "./InventoryCashSection";
import { OrdersHistorySection } from "./OrdersHistorySection";
import { DeliverySection } from "./DeliverySection";
import { ReceiptModal } from "./ReceiptModal";
import { QrModal } from "./QrModal";

type TabId =
  | "overview"
  | "pdv"
  | "delivery"
  | "tables"
  | "kds"
  | "bakery"
  | "orders"
  | "finance"
  | "customers"
  | "inventory";

interface ErpWorkspaceProps {
  initialData: WorkspaceSnapshotDto;
  dbError: string | null;
}

export function ErpWorkspace({ initialData, dbError }: ErpWorkspaceProps) {
  const [data, setData] = useState<WorkspaceSnapshotDto>(initialData);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [preselectedTable, setPreselectedTable] = useState<number | null>(null);
  const [preselectedCustomerId, setPreselectedCustomerId] = useState<number | null>(null);
  const [preselectedPosMode, setPreselectedPosMode] = useState<
    "BALCAO" | "MESA" | "DELIVERY" | "RETIRADA" | null
  >(null);
  const [receiptOrder, setReceiptOrder] = useState<OrderDto | null>(null);
  const [qrTableNumber, setQrTableNumber] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [autoPoll, setAutoPoll] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(2500);
  const [noteAuthor, setNoteAuthor] = useState("Barista");
  const [noteContent, setNoteContent] = useState("");
  const [notePriority, setNotePriority] = useState<"NORMAL" | "IMPORTANTE">("NORMAL");
  const [noteBusy, setNoteBusy] = useState(false);

  const showToast = useCallback((type: "ok" | "err", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4200);
  }, []);

  const refreshWorkspace = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/workspace", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as WorkspaceSnapshotDto;
      setData(json);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!autoPoll || dbError) return;
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void refreshWorkspace();
    }, 15000);
    return () => clearInterval(timer);
  }, [autoPoll, dbError, refreshWorkspace]);

  const analytics = useMemo(() => {
    const paid = data.orders.filter((o) => o.status === "PAGO");
    const totalPaid = paid.reduce((s, o) => s + o.total, 0);

    const byChannel = new Map<string, number>();
    const byPayment = new Map<string, number>();
    const topProductsMap = new Map<string, { qty: number; revenue: number }>();

    for (const order of paid) {
      byChannel.set(order.channel, (byChannel.get(order.channel) ?? 0) + order.total);
      const pm = order.paymentMethod ?? "OUTRO";
      byPayment.set(pm, (byPayment.get(pm) ?? 0) + order.total);
    }

    for (const order of data.orders) {
      if (order.status === "CANCELADO") continue;
      for (const item of order.items) {
        const cur = topProductsMap.get(item.productName) ?? {
          qty: 0,
          revenue: 0,
        };
        cur.qty += item.qty;
        cur.revenue += item.totalPrice;
        topProductsMap.set(item.productName, cur);
      }
    }

    const topProducts = [...topProductsMap.entries()]
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const salesByHour = computeSalesByHour(data.orders);

    return {
      totalPaid,
      channels: [...byChannel.entries()],
      payments: [...byPayment.entries()],
      topProducts,
      salesByHour,
    };
  }, [data.orders]);

  const navItems: Array<{
    id: TabId;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: number;
  }> = [
    { id: "overview", label: "Painel Geral", icon: LayoutDashboard },
    { id: "pdv", label: "PDV Balcão", icon: ShoppingCart },
    {
      id: "delivery",
      label: "Delivery",
      icon: Truck,
      badge: data.metrics.activeDeliveries || undefined,
    },
    {
      id: "tables",
      label: "Mesas & QR",
      icon: UtensilsCrossed,
      badge: data.metrics.occupiedTables || undefined,
    },
    {
      id: "kds",
      label: "KDS Cozinha",
      icon: ChefHat,
      badge: data.metrics.kdsPendingCount || undefined,
    },
    {
      id: "bakery",
      label: "Padaria & Bolos",
      icon: CakeSlice,
      badge: data.metrics.activeCakeOrders || undefined,
    },
    {
      id: "orders",
      label: "Pedidos & CSV",
      icon: ClipboardList,
    },
    {
      id: "finance",
      label: "Financeiro & DRE",
      icon: Landmark,
      badge:
        data.financialEntries.filter(
          (e) => e.type === "DESPESA" && e.status !== "PAGO",
        ).length || undefined,
    },
    {
      id: "customers",
      label: "Clube / Clientes",
      icon: Award,
      badge: data.customers.length || undefined,
    },
    {
      id: "inventory",
      label: "Estoque & Caixa",
      icon: Boxes,
      badge: data.metrics.lowStockAlerts || undefined,
    },
  ];

  async function handleCreateNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteContent.trim() || noteBusy) return;
    setNoteBusy(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: noteAuthor.trim() || "Equipe",
          content: noteContent.trim(),
          priority: notePriority,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        showToast("err", j.error ?? "Erro ao criar recado.");
        return;
      }
      setNoteContent("");
      setNotePriority("NORMAL");
      await refreshWorkspace();
    } finally {
      setNoteBusy(false);
    }
  }

  async function handleToggleNote(id: number, isDone: boolean) {
    const res = await fetch("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isDone }),
    });
    if (!res.ok) {
      showToast("err", "Erro ao atualizar recado.");
      return;
    }
    await refreshWorkspace();
  }

  async function handleDeleteNote(id: number) {
    const res = await fetch(`/api/notes?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("err", "Erro ao remover recado.");
      return;
    }
    await refreshWorkspace();
  }

  const goalPct = Math.min(
    100,
    Math.round((data.metrics.revenueToday / Math.max(1, dailyGoal)) * 100),
  );
  const activePointsTotal = data.customers.reduce(
    (s, c) => s + c.loyaltyPoints,
    0,
  );

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden text-[#211611]">
      {/* Full-Width Top Espresso Command Dock */}
      <header className="cafe-sidebar sticky top-0 z-30 w-full text-[#fbf8f3] shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#d4943a] to-[#b5652a] text-white shadow-md">
              <Coffee className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-lg leading-tight font-bold text-white sm:text-xl">
                Forno & Mesa
              </h1>
              <p className="text-[11px] font-medium text-[#d3c1ae]">
                Torrefação, Cafeteria, Padaria & Bistrô · Operação em Tempo Real
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono-num hidden items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 sm:inline-flex">
              {data.openCashSession
                ? `Caixa Aberto · ${formatBRL(data.openCashSession.expectedAmount)}`
                : "Caixa Fechado"}
            </span>
            <a
              href="/delivery"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 rounded-xl border border-orange-300/30 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 md:inline-flex"
            >
              <Truck className="h-3.5 w-3.5 text-[#d4943a]" />
              Cardápio Delivery
            </a>
            <button
              type="button"
              onClick={() => setQrTableNumber(data.tables[0]?.number ?? 1)}
              className="hidden items-center gap-1.5 rounded-xl border border-amber-300/30 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 lg:inline-flex"
            >
              <QrCode className="h-3.5 w-3.5 text-[#d4943a]" />
              QR Cardápio
            </button>
            <a
              href="/api/reports/export"
              className="hidden items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 sm:inline-flex"
            >
              <Download className="h-3.5 w-3.5 text-emerald-300" />
              CSV
            </a>
            <button
              type="button"
              onClick={() => setAutoPoll((v) => !v)}
              className={`hidden rounded-xl border px-3 py-1.5 text-xs font-semibold sm:inline-flex ${
                autoPoll
                  ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-200"
                  : "border-white/15 bg-white/10 text-[#d3c1ae]"
              }`}
            >
              {autoPoll ? "● Sync 15s" : "Sync pausado"}
            </button>
            <button
              type="button"
              onClick={refreshWorkspace}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="rounded-xl bg-white/10 p-2 text-white hover:bg-white/20 md:hidden"
              aria-label="Alternar menu"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Horizontal Segmented Pill Navigation Dock */}
        <nav
          className={`border-t border-white/10 px-4 py-2 sm:px-6 lg:px-8 ${
            mobileMenuOpen ? "block" : "hidden md:block"
          }`}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                    active
                      ? "bg-gradient-to-r from-[#c06d30] to-[#944b19] text-white shadow-md"
                      : "text-[#d3c1ae] hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`font-mono-num rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        active
                          ? "bg-white text-[#8c4517]"
                          : "bg-white/15 text-amber-200"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {!mobileMenuOpen && (
          <div className="flex gap-1.5 overflow-x-auto border-t border-white/10 px-3 py-2 md:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-[#b5652a] text-white"
                      : "bg-white/10 text-[#d3c1ae]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                  {item.badge !== undefined && (
                    <span className="font-mono-num rounded-full bg-black/25 px-1.5 text-[10px]">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Full-Width Viewport Workspace */}
      <main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-8">

          {dbError && (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-700" />
              <div>
                <p className="font-bold">Banco de dados indisponível</p>
                <p className="text-xs">{dbError}</p>
              </div>
            </div>
          )}

          {toast && (
            <div
              className={`animate-fade-in mb-4 rounded-xl border px-4 py-2.5 text-xs font-semibold shadow-sm ${
                toast.type === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-red-200 bg-red-50 text-red-900"
              }`}
            >
              {toast.text}
            </div>
          )}

          {activeTab === "overview" && (
            <div className="animate-fade-in space-y-6">
              {/* Top Hero Bento Grid */}
              <div className="grid gap-4 lg:grid-cols-12">
                {/* Meta Diaria Hero Card */}
                <div className="flex flex-col justify-between rounded-2xl border border-[#3a271d] bg-gradient-to-br from-[#211611] via-[#311f16] to-[#4b2d1f] p-5 text-[#fbf8f3] shadow-lg lg:col-span-5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-amber-200">
                        <Target className="h-3.5 w-3.5 text-[#d4943a]" />
                        Meta Diária do Turno
                      </span>
                      <div className="flex items-center gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() =>
                            setDailyGoal((g) => Math.max(500, g - 250))
                          }
                          className="rounded-lg border border-white/15 bg-white/10 px-2 py-0.5 font-bold hover:bg-white/20"
                        >
                          -250
                        </button>
                        <span className="font-mono-num px-1 font-semibold text-amber-200">
                          {formatBRL(dailyGoal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDailyGoal((g) => g + 250)}
                          className="rounded-lg border border-white/15 bg-white/10 px-2 py-0.5 font-bold hover:bg-white/20"
                        >
                          +250
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex items-baseline justify-between gap-3">
                      <div>
                        <p className="text-xs text-[#d3c1ae]">
                          Faturamento Pago Hoje
                        </p>
                        <p className="font-mono-num mt-0.5 text-3xl font-bold text-white">
                          {formatBRL(data.metrics.revenueToday)}
                        </p>
                      </div>
                      <span className="font-mono-num rounded-xl bg-emerald-500/20 px-3 py-1 text-sm font-bold text-emerald-300">
                        {goalPct}% da meta
                      </span>
                    </div>

                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/15">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#d4943a] to-[#40916c] transition-all duration-500"
                        style={{ width: `${goalPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs">
                    <span className="text-[#d3c1ae]">
                      {data.metrics.paidCount} vendas · Ticket médio{" "}
                      <strong className="font-mono-num text-white">
                        {formatBRL(data.metrics.avgTicket)}
                      </strong>
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab("pdv")}
                        className="rounded-xl bg-[#b5652a] px-3 py-1.5 font-semibold text-white hover:bg-[#9c511d]"
                      >
                        + Novo Pedido PDV
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("delivery")}
                        className="rounded-xl border border-orange-300/30 bg-orange-500/20 px-3 py-1.5 font-semibold text-orange-200 hover:bg-orange-500/30"
                      >
                        Delivery ({data.metrics.activeDeliveries})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("tables")}
                        className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 font-semibold text-white hover:bg-white/20"
                      >
                        Mesas
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("finance")}
                        className="rounded-xl border border-emerald-400/30 bg-emerald-500/20 px-3 py-1.5 font-semibold text-emerald-200 hover:bg-emerald-500/30"
                      >
                        Financeiro
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right 4 KPI Bento Tiles */}
                <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
                  <div className="card-bistro flex flex-col justify-between p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-[#6e594b]">
                        Mesas & Comandas
                      </p>
                      <span className="rounded-lg bg-amber-100 p-1.5 text-amber-800">
                        <UtensilsCrossed className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="font-mono-num mt-2 text-2xl font-bold text-[#211611]">
                      {data.metrics.occupiedTables} / {data.metrics.totalTables}
                    </p>
                    <p className="mt-1 text-[11px] text-[#6e594b]">
                      {data.metrics.activeOrdersCount} pedidos em aberto no salão
                    </p>
                  </div>

                  <div className="card-bistro flex flex-col justify-between p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-[#6e594b]">
                        Fila KDS & Encomendas
                      </p>
                      <span className="rounded-lg bg-orange-100 p-1.5 text-[#b5652a]">
                        <ChefHat className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="font-mono-num mt-2 text-2xl font-bold text-[#b5652a]">
                      {data.metrics.kdsPendingCount} itens
                    </p>
                    <p className="mt-1 text-[11px] text-[#6e594b]">
                      {data.metrics.activeCakeOrders} encomendas de confeitaria
                      ativas
                    </p>
                  </div>

                  <div className="card-bistro flex flex-col justify-between p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-[#6e594b]">
                        Clube Fidelidade
                      </p>
                      <span className="rounded-lg bg-emerald-100 p-1.5 text-[#2d6a4f]">
                        <Award className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="font-mono-num mt-2 text-2xl font-bold text-[#2d6a4f]">
                      {data.customers.length} clientes
                    </p>
                    <p className="mt-1 text-[11px] text-[#6e594b]">
                      {activePointsTotal} pontos acumulados · clique em Clube
                    </p>
                  </div>

                  <div className="card-bistro flex flex-col justify-between p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-[#6e594b]">
                        Alertas de Estoque
                      </p>
                      <span className="rounded-lg bg-red-100 p-1.5 text-red-700">
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="font-mono-num mt-2 text-2xl font-bold text-amber-700">
                      {data.metrics.lowStockAlerts}
                    </p>
                    <p className="mt-1 text-[11px] text-[#6e594b]">
                      Insumos ou produtos abaixo do mínimo
                    </p>
                  </div>
                </div>
              </div>

              {/* Analytics Breakdown */}
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="card-bistro p-5">
                  <h3 className="font-display text-base font-bold">
                    Receita por Canal
                  </h3>
                  <div className="mt-3 space-y-2.5 text-xs">
                    {analytics.channels.length === 0 ? (
                      <p className="text-[#6e594b]">Sem vendas pagas ainda.</p>
                    ) : (
                      analytics.channels.map(([ch, val]) => {
                        const pct = Math.round(
                          (val / Math.max(1, analytics.totalPaid)) * 100,
                        );
                        return (
                          <div key={ch} className="space-y-1">
                            <div className="flex justify-between font-semibold">
                              <span>{channelLabel(ch)}</span>
                              <span className="font-mono-num">
                                {formatBRL(val)} ({pct}%)
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-[#f2ebe1]">
                              <div
                                className="h-full rounded-full bg-[#b5652a]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="card-bistro p-5">
                  <h3 className="font-display text-base font-bold">
                    Meios de Pagamento
                  </h3>
                  <div className="mt-3 space-y-2.5 text-xs">
                    {analytics.payments.length === 0 ? (
                      <p className="text-[#6e594b]">Sem recebimentos ainda.</p>
                    ) : (
                      analytics.payments.map(([pm, val]) => {
                        const pct = Math.round(
                          (val / Math.max(1, analytics.totalPaid)) * 100,
                        );
                        return (
                          <div key={pm} className="space-y-1">
                            <div className="flex justify-between font-semibold">
                              <span>{pm}</span>
                              <span className="font-mono-num">
                                {formatBRL(val)} ({pct}%)
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-[#f2ebe1]">
                              <div
                                className="h-full rounded-full bg-[#2d6a4f]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="card-bistro p-5">
                  <h3 className="font-display text-base font-bold">
                    Mais Vendidos (Top 5)
                  </h3>
                  <div className="mt-3 space-y-2 text-xs">
                    {analytics.topProducts.map((p, idx) => (
                      <div
                        key={p.name}
                        className="flex items-center justify-between rounded-lg bg-[#fbf8f3] px-2.5 py-1.5"
                      >
                        <span className="truncate font-semibold">
                          {idx + 1}. {p.name}
                        </span>
                        <span className="font-mono-num shrink-0 font-bold text-[#b5652a]">
                          {formatBRL(p.revenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-12">
                {/* Recent Orders */}
                <div className="card-bistro p-5 lg:col-span-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold">
                      Últimos Pedidos
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab("pdv")}
                      className="text-xs font-semibold text-[#b5652a] hover:underline"
                    >
                      Novo Pedido no PDV →
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {data.orders.slice(0, 6).map((order) => (
                      <div
                        key={order.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#f2ebe1] bg-[#fbf8f3] p-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono-num font-bold">
                              {order.code}
                            </span>
                            <span className="rounded bg-white px-2 py-0.5 text-[10px] font-bold">
                              {order.table ? order.table.name : order.channel}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                order.status === "PAGO"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : order.status === "CANCELADO"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-amber-100 text-amber-900"
                              }`}
                            >
                              {order.status}
                            </span>
                          </div>
                          <p className="mt-1 text-[#6e594b]">
                            {order.customerName ?? "Cliente"} ·{" "}
                            {order.items.length} itens
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono-num text-sm font-bold text-[#211611]">
                            {formatBRL(order.total)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setReceiptOrder(order)}
                            className="rounded-lg border border-[#e8ddd0] bg-white p-1.5 hover:bg-[#f2ebe1]"
                            title="Ver Cupom 80mm"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mural do Turno (Shift Handoff Notes) */}
                <div className="card-bistro p-5 lg:col-span-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 font-display text-lg font-bold">
                      <StickyNote className="h-4 w-4 text-[#b5652a]" />
                      Mural do Turno
                    </h3>
                    <span className="rounded-full bg-[#f2ebe1] px-2.5 py-0.5 text-[10px] font-bold text-[#6e594b]">
                      {data.shiftNotes.filter((n) => !n.isDone).length} ativos
                    </span>
                  </div>

                  <form onSubmit={handleCreateNote} className="mb-3 space-y-2">
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={noteAuthor}
                        onChange={(e) => setNoteAuthor(e.target.value)}
                        placeholder="Autor"
                        className="w-24 rounded-lg border border-[#e8ddd0] bg-[#fbf8f3] px-2.5 py-1.5 text-xs outline-none focus:border-[#b5652a]"
                      />
                      <select
                        value={notePriority}
                        onChange={(e) =>
                          setNotePriority(
                            e.target.value as "NORMAL" | "IMPORTANTE",
                          )
                        }
                        className="rounded-lg border border-[#e8ddd0] bg-[#fbf8f3] px-2 py-1.5 text-xs outline-none focus:border-[#b5652a]"
                      >
                        <option value="NORMAL">Normal</option>
                        <option value="IMPORTANTE">Importante</option>
                      </select>
                      <button
                        type="submit"
                        disabled={noteBusy || !noteContent.trim()}
                        className="btn-primary ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" /> Fixar
                      </button>
                    </div>
                    <input
                      type="text"
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Recado para barista, forno ou caixa..."
                      className="w-full rounded-lg border border-[#e8ddd0] bg-[#fbf8f3] px-3 py-1.5 text-xs outline-none focus:border-[#b5652a]"
                    />
                  </form>

                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {data.shiftNotes.map((note) => (
                      <div
                        key={note.id}
                        className={`flex items-start justify-between gap-2 rounded-xl border p-2.5 text-xs ${
                          note.isDone
                            ? "border-[#e8ddd0] bg-[#fbf8f3]/60 opacity-65"
                            : note.priority === "IMPORTANTE"
                              ? "border-amber-300 bg-amber-50/70"
                              : "border-[#f2ebe1] bg-[#fbf8f3]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleNote(note.id, !note.isDone)}
                          className="mt-0.5 text-[#b5652a]"
                          title="Marcar concluído"
                        >
                          {note.isDone ? (
                            <CheckSquare className="h-4 w-4 text-[#2d6a4f]" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#211611]">
                              {note.author}
                            </span>
                            {note.priority === "IMPORTANTE" && (
                              <span className="rounded bg-amber-200 px-1.5 py-0.2 text-[9px] font-bold text-amber-950">
                                IMPORTANTE
                              </span>
                            )}
                          </div>
                          <p
                            className={`mt-0.5 text-[#6e594b] ${
                              note.isDone ? "line-through" : ""
                            }`}
                          >
                            {note.content}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          className="text-[#6e594b] hover:text-red-700"
                          title="Apagar recado"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fornadas + QR */}
                <div className="space-y-4 lg:col-span-3">
                  <div className="card-bistro p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 font-display text-lg font-bold">
                        <Croissant className="h-4 w-4 text-[#b5652a]" />{" "}
                        Fornadas
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveTab("bakery")}
                        className="text-xs font-semibold text-[#b5652a] hover:underline"
                      >
                        Gerenciar →
                      </button>
                    </div>
                    <div className="space-y-2">
                      {data.batches.slice(0, 4).map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between rounded-xl bg-[#fbf8f3] px-3 py-2 text-xs"
                        >
                          <span className="truncate">
                            <strong className="font-mono-num">
                              {b.bakeTime}
                            </strong>{" "}
                            · {b.productName}
                          </span>
                          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold">
                            {b.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card-bistro p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 font-display text-lg font-bold">
                        <QrCode className="h-4 w-4 text-[#b5652a]" /> Mesas QR
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveTab("tables")}
                        className="text-xs font-semibold text-[#b5652a] hover:underline"
                      >
                        Ver Mesas →
                      </button>
                    </div>
                    <p className="mb-3 text-xs text-[#6e594b]">
                      Teste o cardápio digital caindo direto no KDS:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {data.tables.slice(0, 6).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setQrTableNumber(t.number)}
                          className="rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] px-2.5 py-1.5 text-xs font-semibold hover:border-[#b5652a]"
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "pdv" && (
            <PosSection
              products={data.products}
              tables={data.tables}
              customers={data.customers}
              deliveryZones={data.deliveryZones}
              preselectedTableNumber={preselectedTable}
              preselectedCustomerId={preselectedCustomerId}
              preselectedMode={preselectedPosMode}
              onClearPreselectedTable={() => setPreselectedTable(null)}
              onClearPreselectedCustomer={() => setPreselectedCustomerId(null)}
              onClearPreselectedMode={() => setPreselectedPosMode(null)}
              onOrderCreated={async (order, openReceipt) => {
                await refreshWorkspace();
                showToast("ok", `Pedido ${order.code} registrado com sucesso!`);
                if (openReceipt) setReceiptOrder(order);
              }}
              onError={(msg) => showToast("err", msg)}
            />
          )}

          {activeTab === "delivery" && (
            <DeliverySection
              orders={data.orders}
              zones={data.deliveryZones}
              onOpenReceipt={(order) => setReceiptOrder(order)}
              onNewDeliveryOrder={() => {
                setPreselectedTable(null);
                setPreselectedPosMode("DELIVERY");
                setActiveTab("pdv");
              }}
              onRefresh={refreshWorkspace}
              onError={(msg) => showToast("err", msg)}
              onSuccess={(msg) => showToast("ok", msg)}
            />
          )}

          {activeTab === "tables" && (
            <TablesSection
              tables={data.tables}
              orders={data.orders}
              onOpenPosForTable={(tableNumber) => {
                setPreselectedTable(tableNumber);
                setActiveTab("pdv");
              }}
              onOpenQr={(tableNumber) => setQrTableNumber(tableNumber)}
              onOpenReceipt={(order) => setReceiptOrder(order)}
              onRefresh={refreshWorkspace}
              onError={(msg) => showToast("err", msg)}
            />
          )}

          {activeTab === "kds" && (
            <KdsSection
              orders={data.orders}
              onRefresh={refreshWorkspace}
              onError={(msg) => showToast("err", msg)}
            />
          )}

          {activeTab === "bakery" && (
            <BakeryCakeSection
              products={data.products}
              batches={data.batches}
              cakeOrders={data.cakeOrders}
              onRefresh={refreshWorkspace}
              onError={(msg) => showToast("err", msg)}
            />
          )}

          {activeTab === "orders" && (
            <OrdersHistorySection
              orders={data.orders}
              onOpenReceipt={(order) => setReceiptOrder(order)}
              onRefresh={refreshWorkspace}
              onError={(msg) => showToast("err", msg)}
            />
          )}

          {activeTab === "finance" && (
            <FinanceSection
              orders={data.orders}
              products={data.products}
              cakeOrders={data.cakeOrders}
              cashSessions={data.cashSessions}
              financialEntries={data.financialEntries}
              onRefresh={refreshWorkspace}
              onError={(msg) => showToast("err", msg)}
            />
          )}

          {activeTab === "customers" && (
            <CustomersSection
              customers={data.customers}
              onStartOrderForCustomer={(customerId) => {
                setPreselectedCustomerId(customerId);
                setActiveTab("pdv");
              }}
              onRefresh={refreshWorkspace}
              onError={(msg) => showToast("err", msg)}
            />
          )}

          {activeTab === "inventory" && (
            <InventoryCashSection
              categories={data.categories}
              products={data.products}
              ingredients={data.ingredients}
              openCashSession={data.openCashSession}
              onRefresh={refreshWorkspace}
              onError={(msg) => showToast("err", msg)}
            />
          )}
      </main>

      <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />
      <QrModal tableNumber={qrTableNumber} onClose={() => setQrTableNumber(null)} />
    </div>
  );
}
