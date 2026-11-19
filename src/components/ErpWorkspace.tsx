"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  BarChart3,
  Boxes,
  CakeSlice,
  CheckSquare,
  ChefHat,
  ClipboardList,
  Coffee,
  Croissant,
  Download,
  ExternalLink,
  Landmark,
  LayoutDashboard,
  Menu,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState("");
  const [dailyGoal, setDailyGoal] = useState(2500);
  const [noteAuthor, setNoteAuthor] = useState("Barista");
  const [noteContent, setNoteContent] = useState("");
  const [notePriority, setNotePriority] = useState<"NORMAL" | "IMPORTANTE">("NORMAL");
  const [noteBusy, setNoteBusy] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("forno_mesa_daily_goal");
      if (saved && Number(saved) >= 500) setDailyGoal(Number(saved));
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("forno_mesa_daily_goal", String(dailyGoal));
    } catch {
      // Ignore
    }
  }, [dailyGoal]);

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
    if (dbError) return;
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void refreshWorkspace();
    }, 15000);
    return () => clearInterval(timer);
  }, [dbError, refreshWorkspace]);

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
    const maxHourRevenue = Math.max(1, ...salesByHour);

    return {
      totalPaid,
      channels: [...byChannel.entries()],
      payments: [...byPayment.entries()],
      topProducts,
      salesByHour,
      maxHourRevenue,
    };
  }, [data.orders]);

  const navGroups: Array<{
    title: string;
    items: Array<{
      id: TabId;
      label: string;
      icon: typeof LayoutDashboard;
      badge?: number;
    }>;
  }> = [
    {
      title: "Operação",
      items: [
        { id: "overview", label: "Painel Geral", icon: LayoutDashboard },
        { id: "pdv", label: "PDV & Caixa", icon: ShoppingCart },
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
      ],
    },
    {
      title: "Gestão & Produção",
      items: [
        {
          id: "bakery",
          label: "Padaria & Bolos",
          icon: CakeSlice,
          badge: data.metrics.activeCakeOrders || undefined,
        },
        { id: "orders", label: "Pedidos & CSV", icon: ClipboardList },
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
      ],
    },
  ];

  const allNavItems = navGroups.flatMap((g) => g.items);
  const currentTabLabel =
    allNavItems.find((i) => i.id === activeTab)?.label ?? "Painel Geral";

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

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-4 text-[#f4f4f1]">
      <div className="space-y-6">
        {/* Brand */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#C07F5A] text-white">
              <Coffee className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight text-white">
                Forno & Mesa
              </h1>
              <p className="text-[11px] font-medium text-[#E6CCB2]">
                Gestão & Delivery
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-lg p-1.5 text-[#E6CCB2] hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="space-y-5">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#8C5A3C]">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
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
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        active
                          ? "bg-[#C07F5A] text-white"
                          : "text-[#FAF3E8]/85 hover:bg-[#543832] hover:text-white"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </span>
                      {item.badge !== undefined && (
                        <span
                          className={`font-mono-num rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            active
                              ? "bg-white/20 text-white"
                              : "bg-[#543832] text-[#FAF3E8]"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Status & Storefront Link */}
      <div className="space-y-2 border-t border-[#543832] pt-4">
        <a
          href="/delivery"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between rounded-lg border border-[#8C5A3C]/40 bg-[#543832] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#543832]"
        >
          <span className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-[#C07F5A]" />
            Cardápio Delivery
          </span>
          <ExternalLink className="h-3.5 w-3.5 text-[#E6CCB2]" />
        </a>

        <div className="rounded-lg bg-[#543832]/80 px-3 py-2 text-[11px]">
          <p className="text-[#E6CCB2]">Status do Caixa</p>
          <p
            className={`font-mono-num mt-0.5 font-bold ${
              data.openCashSession ? "text-emerald-400" : "text-amber-300"
            }`}
          >
            {data.openCashSession
              ? `Aberto · ${formatBRL(data.openCashSession.expectedAmount)}`
              : "Caixa Fechado"}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#FAF3E8] text-[#3E2723]">
      {/* Desktop Fixed Sidebar */}
      <aside className="cafe-sidebar hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:block lg:w-64 lg:overflow-y-auto lg:border-r">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="cafe-sidebar relative z-10 h-full w-72 max-w-[85vw] overflow-y-auto shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col pb-20 lg:pl-64 lg:pb-0">
        {/* Slim Sticky Topbar */}
        <header className="cafe-topbar sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="icon-btn lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-base font-bold leading-tight text-[#3E2723] sm:text-lg">
                {currentTabLabel}
              </h2>
              <p className="hidden text-xs text-[#8C5A3C] sm:block">
                Salão, Balcão, Delivery & Produção
              </p>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end gap-2">
            {/* Global Quick Search */}
            <div className="relative hidden w-full max-w-xs lg:block">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#8C5A3C]" />
              <input
                type="text"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Buscar pedido, cliente ou produto..."
                className="w-full rounded-lg border border-[#E6CCB2] bg-[#FAF3E8] py-1.5 pr-7 pl-8 text-xs text-[#3E2723] placeholder:text-[#8C5A3C]/70 focus:border-[#C07F5A] focus:bg-[#FFFDF9] focus:outline-none"
              />
              {quickSearch && (
                <button
                  type="button"
                  onClick={() => setQuickSearch("")}
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-[#8C5A3C] hover:text-[#3E2723]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {quickSearch.trim().length >= 2 && (
                <div className="absolute top-full right-0 left-0 z-50 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-[#E6CCB2] bg-[#FFFDF9] p-2 shadow-xl">
                  {(() => {
                    const q = quickSearch.trim().toLowerCase();
                    const matchedOrders = data.orders
                      .filter(
                        (o) =>
                          o.code.toLowerCase().includes(q) ||
                          (o.customerName ?? "").toLowerCase().includes(q) ||
                          (o.customerPhone ?? "").includes(q),
                      )
                      .slice(0, 4);
                    const matchedCustomers = data.customers
                      .filter(
                        (c) =>
                          c.name.toLowerCase().includes(q) ||
                          c.phone.includes(q),
                      )
                      .slice(0, 3);
                    const matchedProducts = data.products
                      .filter((p) => p.name.toLowerCase().includes(q))
                      .slice(0, 4);

                    if (
                      matchedOrders.length === 0 &&
                      matchedCustomers.length === 0 &&
                      matchedProducts.length === 0
                    ) {
                      return (
                        <p className="p-3 text-center text-xs text-[#8C5A3C]">
                          Nenhum resultado para &ldquo;{quickSearch}&rdquo;
                        </p>
                      );
                    }

                    return (
                      <div className="space-y-2 text-xs">
                        {matchedOrders.length > 0 && (
                          <div>
                            <p className="px-2 py-1 text-[10px] font-bold uppercase text-[#8C5A3C]">
                              Pedidos
                            </p>
                            {matchedOrders.map((o) => (
                              <button
                                key={o.id}
                                type="button"
                                onClick={() => {
                                  setReceiptOrder(o);
                                  setQuickSearch("");
                                }}
                                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-[#FAF3E8]"
                              >
                                <span className="font-semibold text-[#3E2723]">
                                  {o.code} · {o.customerName ?? channelLabel(o.channel)}
                                </span>
                                <span className="font-mono-num font-bold text-[#C07F5A]">
                                  {formatBRL(o.total)}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                        {matchedCustomers.length > 0 && (
                          <div>
                            <p className="px-2 py-1 text-[10px] font-bold uppercase text-[#8C5A3C]">
                              Clientes
                            </p>
                            {matchedCustomers.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setPreselectedCustomerId(c.id);
                                  setActiveTab("customers");
                                  setQuickSearch("");
                                }}
                                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-[#FAF3E8]"
                              >
                                <span className="font-semibold text-[#3E2723]">{c.name}</span>
                                <span className="text-[11px] text-[#8C5A3C]">{c.phone}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {matchedProducts.length > 0 && (
                          <div>
                            <p className="px-2 py-1 text-[10px] font-bold uppercase text-[#8C5A3C]">
                              Produtos (ir ao PDV)
                            </p>
                            {matchedProducts.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setActiveTab("pdv");
                                  setQuickSearch("");
                                }}
                                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-[#FAF3E8]"
                              >
                                <span className="font-semibold text-[#3E2723]">{p.name}</span>
                                <span className="font-mono-num text-[#8C5A3C]">
                                  {formatBRL(p.price)}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <a
              href="/delivery"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 rounded-lg border border-[#C07F5A]/40 bg-[#FAF3E8] px-3 py-1.5 text-xs font-semibold text-[#C07F5A] transition hover:bg-[#E6CCB2]/60 sm:inline-flex"
            >
              <Truck className="h-3.5 w-3.5" />
              Abrir Delivery (Cliente)
            </a>
            <button
              type="button"
              onClick={() => setQrTableNumber(data.tables[0]?.number ?? 1)}
              className="hidden items-center gap-1.5 rounded-lg border border-[#E6CCB2] bg-white px-3 py-1.5 text-xs font-semibold text-[#3E2723] transition hover:bg-[#FAF3E8] md:inline-flex"
            >
              <QrCode className="h-3.5 w-3.5 text-[#8C5A3C]" />
              QR Mesas
            </button>
            <a
              href="/api/reports/export"
              className="hidden items-center gap-1.5 rounded-lg border border-[#E6CCB2] bg-white px-3 py-1.5 text-xs font-semibold text-[#3E2723] transition hover:bg-[#FAF3E8] md:inline-flex"
            >
              <Download className="h-3.5 w-3.5 text-emerald-700" />
              CSV
            </a>
            <button
              type="button"
              onClick={refreshWorkspace}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6CCB2] bg-white px-3 py-1.5 text-xs font-semibold text-[#3E2723] transition hover:bg-[#FAF3E8]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </header>

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
              {/* Hero + KPI Bento Grid */}
              <div className="grid gap-4 xl:grid-cols-12">
                <div className="flex flex-col justify-between rounded-2xl bg-[#3E2723] p-5 text-white shadow-lg sm:p-6 xl:col-span-5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-[#f2b880]">
                        <Target className="h-3.5 w-3.5 text-[#C07F5A]" />
                        Meta Diária
                      </span>
                      <div className="flex items-center gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setDailyGoal((g) => Math.max(500, g - 250))}
                          className="rounded-lg border border-white/15 bg-white/10 px-2 py-0.5 font-bold hover:bg-white/20"
                        >
                          -250
                        </button>
                        <span className="font-mono-num px-1 font-semibold text-[#f2b880]">
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

                    <div className="mt-5 flex items-baseline justify-between gap-3">
                      <div>
                        <p className="text-xs text-[#8b9098]">Faturamento Pago Hoje</p>
                        <p className="font-mono-num mt-1 text-3xl font-bold tracking-tight text-white">
                          {formatBRL(data.metrics.revenueToday)}
                        </p>
                      </div>
                      <span className="font-mono-num rounded-xl bg-emerald-500/20 px-3 py-1 text-sm font-bold text-emerald-300">
                        {goalPct}%
                      </span>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#C07F5A] to-[#22c55e] transition-all duration-500"
                        style={{ width: `${goalPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-xs">
                    <span className="text-[#8b9098]">
                      {data.metrics.paidCount} vendas · Ticket{" "}
                      <strong className="font-mono-num text-white">
                        {formatBRL(data.metrics.avgTicket)}
                      </strong>
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab("pdv")}
                        className="btn-primary rounded-xl px-3 py-1.5 font-semibold"
                      >
                        + Novo Pedido
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("delivery")}
                        className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 font-semibold text-white hover:bg-white/20"
                      >
                        Delivery ({data.metrics.activeDeliveries})
                      </button>
                    </div>
                  </div>
                </div>

                {/* 4 KPI Tiles */}
                <div className="grid gap-4 sm:grid-cols-2 xl:col-span-7">
                  <div className="card-bistro flex flex-col justify-between p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-[#8C5A3C]">Mesas & Salão</p>
                      <span className="rounded-xl bg-amber-50 p-2 text-amber-700">
                        <UtensilsCrossed className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="font-mono-num mt-2 text-2xl font-bold text-[#3E2723]">
                      {data.metrics.occupiedTables} / {data.metrics.totalTables}
                    </p>
                    <p className="mt-1 text-[11px] text-[#8C5A3C]">
                      {data.metrics.activeOrdersCount} pedidos em aberto no salão
                    </p>
                  </div>

                  <div className="card-bistro flex flex-col justify-between p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-[#8C5A3C]">Delivery & KDS</p>
                      <span className="rounded-xl bg-orange-50 p-2 text-[#C07F5A]">
                        <Truck className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="font-mono-num mt-2 text-2xl font-bold text-[#C07F5A]">
                      {data.metrics.activeDeliveries} entregas · {data.metrics.kdsPendingCount} KDS
                    </p>
                    <p className="mt-1 text-[11px] text-[#8C5A3C]">
                      Receita delivery hoje: {formatBRL(data.metrics.deliveryRevenue)}
                    </p>
                  </div>

                  <div className="card-bistro flex flex-col justify-between p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-[#8C5A3C]">Clube Fidelidade</p>
                      <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                        <Award className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="font-mono-num mt-2 text-2xl font-bold text-emerald-700">
                      {data.customers.length} clientes
                    </p>
                    <p className="mt-1 text-[11px] text-[#8C5A3C]">
                      {activePointsTotal} pontos acumulados · {data.metrics.activeCakeOrders} encomendas
                    </p>
                  </div>

                  <div className="card-bistro flex flex-col justify-between p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-[#8C5A3C]">Alertas de Estoque</p>
                      <span className="rounded-xl bg-red-50 p-2 text-red-700">
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="font-mono-num mt-2 text-2xl font-bold text-amber-700">
                      {data.metrics.lowStockAlerts}
                    </p>
                    <p className="mt-1 text-[11px] text-[#8C5A3C]">
                      Insumos ou produtos abaixo do mínimo
                    </p>
                  </div>
                </div>
              </div>

              {/* Analytics + Hourly Chart */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="card-bistro p-5">
                  <h3 className="font-display text-base font-bold">Receita por Canal</h3>
                  <div className="mt-3 space-y-2.5 text-xs">
                    {analytics.channels.length === 0 ? (
                      <p className="text-[#8C5A3C]">Sem vendas pagas ainda.</p>
                    ) : (
                      analytics.channels.map(([ch, val]) => {
                        const pct = Math.round((val / Math.max(1, analytics.totalPaid)) * 100);
                        return (
                          <div key={ch} className="space-y-1">
                            <div className="flex justify-between font-semibold">
                              <span>{channelLabel(ch)}</span>
                              <span className="font-mono-num">
                                {formatBRL(val)} ({pct}%)
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-[#E6CCB2]">
                              <div
                                className="h-full rounded-full bg-[#C07F5A]"
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
                  <h3 className="font-display text-base font-bold">Meios de Pagamento</h3>
                  <div className="mt-3 space-y-2.5 text-xs">
                    {analytics.payments.length === 0 ? (
                      <p className="text-[#8C5A3C]">Sem recebimentos ainda.</p>
                    ) : (
                      analytics.payments.map(([pm, val]) => {
                        const pct = Math.round((val / Math.max(1, analytics.totalPaid)) * 100);
                        return (
                          <div key={pm} className="space-y-1">
                            <div className="flex justify-between font-semibold">
                              <span>{pm}</span>
                              <span className="font-mono-num">
                                {formatBRL(val)} ({pct}%)
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-[#E6CCB2]">
                              <div
                                className="h-full rounded-full bg-[#15803d]"
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
                  <h3 className="font-display flex items-center gap-1.5 text-base font-bold">
                    <BarChart3 className="h-4 w-4 text-[#C07F5A]" /> Vendas por Hora
                  </h3>
                  <div className="mt-4 flex h-28 items-end gap-1">
                    {analytics.salesByHour.slice(7, 23).map((val, idx) => {
                      const hour = idx + 7;
                      const heightPct = val > 0 ? Math.max(12, Math.round((val / analytics.maxHourRevenue) * 100)) : 4;
                      return (
                        <div key={hour} className="group flex flex-1 flex-col items-center gap-1">
                          <div className="flex h-20 w-full items-end">
                            <div
                              title={`${hour}h: ${formatBRL(val)}`}
                              className={`w-full rounded-t-sm transition-all ${
                                val > 0 ? "bg-[#C07F5A] group-hover:bg-[#A66844]" : "bg-[#E6CCB2]"
                              }`}
                              style={{ height: `${heightPct}%` }}
                            />
                          </div>
                          {hour % 3 === 0 && (
                            <span className="font-mono-num text-[9px] text-[#8b9098]">{hour}h</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="card-bistro p-5">
                  <h3 className="font-display text-base font-bold">Top 5 Produtos</h3>
                  <div className="mt-3 space-y-2 text-xs">
                    {analytics.topProducts.map((p, idx) => (
                      <div
                        key={p.name}
                        className="flex items-center justify-between rounded-lg bg-[#FAF3E8] px-2.5 py-1.5"
                      >
                        <span className="truncate font-semibold">
                          {idx + 1}. {p.name}
                        </span>
                        <span className="font-mono-num shrink-0 font-bold text-[#C07F5A]">
                          {formatBRL(p.revenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-12">
                {/* Recent Orders */}
                <div className="card-bistro p-5 xl:col-span-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold">Últimos Pedidos</h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab("pdv")}
                      className="text-xs font-semibold text-[#C07F5A] hover:underline"
                    >
                      Novo Pedido →
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {data.orders.slice(0, 6).map((order) => (
                      <div
                        key={order.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E6CCB2] bg-[#fafaf8] p-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono-num font-bold">{order.code}</span>
                            <span className="rounded bg-white px-2 py-0.5 text-[10px] font-bold">
                              {order.table ? order.table.name : channelLabel(order.channel)}
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
                          <p className="mt-1 text-[#8C5A3C]">
                            {order.customerName ?? "Cliente"} · {order.items.length} itens
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono-num text-sm font-bold text-[#3E2723]">
                            {formatBRL(order.total)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setReceiptOrder(order)}
                            className="icon-btn"
                            title="Ver Cupom 80mm"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mural do Turno */}
                <div className="card-bistro p-5 xl:col-span-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-display flex items-center gap-2 text-lg font-bold">
                      <StickyNote className="h-4 w-4 text-[#C07F5A]" />
                      Mural do Turno
                    </h3>
                    <span className="chip bg-[#E6CCB2] text-[#8C5A3C]">
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
                        className="input-field w-24 py-1.5 text-xs"
                      />
                      <select
                        value={notePriority}
                        onChange={(e) =>
                          setNotePriority(e.target.value as "NORMAL" | "IMPORTANTE")
                        }
                        className="input-field w-auto py-1.5 text-xs"
                      >
                        <option value="NORMAL">Normal</option>
                        <option value="IMPORTANTE">Importante</option>
                      </select>
                      <button
                        type="submit"
                        disabled={noteBusy || !noteContent.trim()}
                        className="btn-primary ml-auto inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" /> Fixar
                      </button>
                    </div>
                    <input
                      type="text"
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Recado para barista, forno ou caixa..."
                      className="input-field py-1.5 text-xs"
                    />
                  </form>

                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {data.shiftNotes.map((note) => (
                      <div
                        key={note.id}
                        className={`flex items-start justify-between gap-2 rounded-xl border p-2.5 text-xs ${
                          note.isDone
                            ? "border-[#E6CCB2] bg-[#fafaf8] opacity-60"
                            : note.priority === "IMPORTANTE"
                              ? "border-amber-300 bg-amber-50/70"
                              : "border-[#E6CCB2] bg-[#fafaf8]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleNote(note.id, !note.isDone)}
                          className="mt-0.5 text-[#C07F5A]"
                          title="Marcar concluído"
                        >
                          {note.isDone ? (
                            <CheckSquare className="h-4 w-4 text-emerald-700" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#3E2723]">{note.author}</span>
                            {note.priority === "IMPORTANTE" && (
                              <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-950">
                                IMPORTANTE
                              </span>
                            )}
                          </div>
                          <p
                            className={`mt-0.5 text-[#8C5A3C] ${
                              note.isDone ? "line-through" : ""
                            }`}
                          >
                            {note.content}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          className="text-[#8b9098] hover:text-red-700"
                          title="Apagar recado"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fornadas + QR */}
                <div className="space-y-4 xl:col-span-3">
                  <div className="card-bistro p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-display flex items-center gap-2 text-lg font-bold">
                        <Croissant className="h-4 w-4 text-[#C07F5A]" /> Fornadas
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveTab("bakery")}
                        className="text-xs font-semibold text-[#C07F5A] hover:underline"
                      >
                        Gerenciar →
                      </button>
                    </div>
                    <div className="space-y-2">
                      {data.batches.slice(0, 4).map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between rounded-xl bg-[#FAF3E8] px-3 py-2 text-xs"
                        >
                          <span className="truncate">
                            <strong className="font-mono-num">{b.bakeTime}</strong> ·{" "}
                            {b.productName}
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
                      <h3 className="font-display flex items-center gap-2 text-lg font-bold">
                        <QrCode className="h-4 w-4 text-[#C07F5A]" /> Mesas QR
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveTab("tables")}
                        className="text-xs font-semibold text-[#C07F5A] hover:underline"
                      >
                        Ver Mesas →
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {data.tables.slice(0, 6).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setQrTableNumber(t.number)}
                          className="rounded-xl border border-[#E6CCB2] bg-[#fafaf8] px-2.5 py-1.5 text-xs font-semibold hover:border-[#C07F5A]"
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
      </div>

      {/* Mobile Bottom Quick Dock */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[#E6CCB2] bg-white/95 px-2 py-1.5 backdrop-blur-md lg:hidden">
        {(
          [
            { id: "overview", label: "Painel", icon: LayoutDashboard },
            { id: "pdv", label: "PDV", icon: ShoppingCart },
            { id: "delivery", label: "Delivery", icon: Truck },
            { id: "tables", label: "Mesas", icon: UtensilsCrossed },
            { id: "kds", label: "KDS", icon: ChefHat },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 text-[10px] font-bold transition ${
                active ? "text-[#C07F5A]" : "text-[#8C5A3C]"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />
      <QrModal tableNumber={qrTableNumber} onClose={() => setQrTableNumber(null)} />
    </div>
  );
}
