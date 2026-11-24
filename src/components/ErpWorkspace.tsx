"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Award,
  BarChart3,
  Bell,
  BellRing,
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
  Moon,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShoppingCart,
  Square,
  Star,
  StickyNote,
  Sun,
  Target,
  Trash2,
  Truck,
  UserCheck,
  UtensilsCrossed,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  channelLabel,
  computeSalesByHour,
  formatBRL,
  getKdsUrgencyLevel,
} from "@/lib/domain";
import {
  canAccessTab,
  defaultTabForRole,
  ROLE_BADGE_CLASSES,
  ROLE_LABELS,
  type ErpTabId,
} from "@/lib/rbac";
import type {
  OperatorSessionDto,
  OrderDto,
  WorkspaceSnapshotDto,
} from "@/types/erp";
import { PosSection } from "./PosSection";
import { TablesSection } from "./TablesSection";
import { KdsSection } from "./KdsSection";
import { BakeryCakeSection } from "./BakeryCakeSection";
import { CustomersSection } from "./CustomersSection";
import { FinanceSection } from "./FinanceSection";
import { InventoryCashSection } from "./InventoryCashSection";
import { OrdersHistorySection } from "./OrdersHistorySection";
import { DeliverySection } from "./DeliverySection";
import { SettingsTeamSection } from "./SettingsTeamSection";
import { ReceiptModal } from "./ReceiptModal";
import { QrModal } from "./QrModal";
import { CommandPalette } from "./CommandPalette";
import { SwitchOperatorModal } from "./SwitchOperatorModal";

interface ErpWorkspaceProps {
  initialData: WorkspaceSnapshotDto;
  operatorSession: OperatorSessionDto;
  dbError: string | null;
}

function playNotificationBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
  } catch {
    // Optional audio
  }
}

export function ErpWorkspace({
  initialData,
  operatorSession,
  dbError,
}: ErpWorkspaceProps) {
  const [data, setData] = useState<WorkspaceSnapshotDto>(initialData);
  const [activeTab, setActiveTab] = useState<ErpTabId>(() =>
    defaultTabForRole(operatorSession.role),
  );
  const [preselectedTable, setPreselectedTable] = useState<number | null>(null);
  const [preselectedCustomerId, setPreselectedCustomerId] = useState<number | null>(
    null,
  );
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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [switchOperatorOpen, setSwitchOperatorOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [alertSound, setAlertSound] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [dailyGoal, setDailyGoal] = useState(
    initialData.storeSettings?.dailyGoal ?? 2500,
  );
  const [noteAuthor, setNoteAuthor] = useState(
    operatorSession.name.split(" ")[0] || "Equipe",
  );
  const [noteContent, setNoteContent] = useState("");
  const [notePriority, setNotePriority] = useState<"NORMAL" | "IMPORTANTE">(
    "NORMAL",
  );
  const [noteBusy, setNoteBusy] = useState(false);

  const prevAlertCountRef = useRef<number | null>(null);

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      try {
        const domTheme = document.documentElement.dataset.theme;
        if (domTheme === "dark") setTheme("dark");
        const savedGoal = localStorage.getItem("forno_mesa_daily_goal");
        if (savedGoal && Number(savedGoal) >= 500) setDailyGoal(Number(savedGoal));
      } catch {
        // Ignore
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("forno_mesa_daily_goal", String(dailyGoal));
    } catch {
      // Ignore
    }
  }, [dailyGoal]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("forno_theme", next);
    } catch {
      // Ignore
    }
  }

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

  const waiterCallTables = useMemo(
    () => data.tables.filter((t) => Boolean(t.waiterCalledAt)),
    [data.tables],
  );

  const notifications = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      detail: string;
      severity: "urgent" | "warn" | "info";
      tab: ErpTabId;
    }> = [];

    for (const t of waiterCallTables) {
      items.push({
        id: `waiter-${t.id}`,
        title: `Chamado de garçom · ${t.name}`,
        detail: "Cliente solicitou atendimento pelo QR Code.",
        severity: "urgent",
        tab: "tables",
      });
    }

    const pendingDeliveries = data.orders.filter(
      (o) =>
        (o.channel === "DELIVERY" || o.channel === "RETIRADA") &&
        o.deliveryStatus === "RECEBIDO",
    );
    for (const d of pendingDeliveries.slice(0, 4)) {
      items.push({
        id: `del-${d.id}`,
        title: `Novo ${channelLabel(d.channel)} · ${d.code}`,
        detail: `${d.customerName ?? "Cliente"} · ${formatBRL(d.total)}`,
        severity: "info",
        tab: "delivery",
      });
    }

    const urgentKds = data.orders.filter(
      (o) =>
        !["PAGO", "CANCELADO"].includes(o.status) &&
        o.items.some((i) => i.itemStatus !== "ENTREGUE") &&
        getKdsUrgencyLevel(o.createdAt) === "urgent",
    );
    if (urgentKds.length > 0) {
      items.push({
        id: "kds-urgent",
        title: `${urgentKds.length} pedido(s) com SLA crítico (>15 min)`,
        detail: "Verifique a fila de preparo no KDS.",
        severity: "urgent",
        tab: "kds",
      });
    }

    if (data.metrics.lowStockAlerts > 0) {
      items.push({
        id: "stock-low",
        title: `${data.metrics.lowStockAlerts} alerta(s) de estoque mínimo`,
        detail: "Insumos ou produtos precisam de reposição.",
        severity: "warn",
        tab: "inventory",
      });
    }

    return items;
  }, [waiterCallTables, data.orders, data.metrics.lowStockAlerts]);

  useEffect(() => {
    const urgentCount =
      waiterCallTables.length +
      data.orders.filter(
        (o) =>
          (o.channel === "DELIVERY" || o.channel === "RETIRADA") &&
          o.deliveryStatus === "RECEBIDO",
      ).length;
    if (
      alertSound &&
      prevAlertCountRef.current !== null &&
      urgentCount > prevAlertCountRef.current
    ) {
      playNotificationBeep();
    }
    prevAlertCountRef.current = urgentCount;
  }, [waiterCallTables.length, data.orders, alertSound]);

  async function dismissWaiterCall(tableNumber: number) {
    const res = await fetch(`/api/tables/${tableNumber}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DISMISS_WAITER" }),
    });
    if (res.ok) {
      showToast("ok", `Chamado da Mesa ${tableNumber} marcado como atendido.`);
      await refreshWorkspace();
    }
  }

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

  const navGroups = useMemo(() => {
    const raw: Array<{
      title: string;
      items: Array<{
        id: ErpTabId;
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
            badge:
              data.metrics.waiterCallsCount ||
              data.metrics.occupiedTables ||
              undefined,
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
          {
            id: "settings",
            label: "Equipe & Loja",
            icon: Settings,
          },
        ],
      },
    ];

    return raw
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => canAccessTab(operatorSession.role, it.id)),
      }))
      .filter((g) => g.items.length > 0);
  }, [operatorSession.role, data]);

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
    <div className="flex h-full flex-col justify-between p-4 text-[#FAF3E8]">
      <div className="space-y-5">
        {/* Brand */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-primary)] text-white">
              <Coffee className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight text-white">
                {data.storeSettings?.storeName ?? "Forno & Mesa"}
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

        {/* Active Operator Badge */}
        <button
          type="button"
          onClick={() => setSwitchOperatorOpen(true)}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:bg-white/10"
        >
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-white">
              {operatorSession.name}
            </p>
            <span
              className={`mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[9px] font-bold ${
                ROLE_BADGE_CLASSES[operatorSession.role]
              }`}
            >
              {ROLE_LABELS[operatorSession.role]}
            </span>
          </div>
          <UserCheck className="h-4 w-4 shrink-0 text-[#E6CCB2]" />
        </button>

        {/* Navigation Groups */}
        <nav className="space-y-4" aria-label="Menu principal">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#E6CCB2]/65">
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
                          ? "bg-[var(--accent-primary)] text-white"
                          : "text-[#FAF3E8]/85 hover:bg-[var(--bg-shell-hover)] hover:text-white"
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
                              : "bg-[var(--bg-shell-hover)] text-[#FAF3E8]"
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

      {/* Bottom Status & Storefront Links */}
      <div className="space-y-2 border-t border-white/10 pt-4">
        <div className="grid grid-cols-2 gap-1.5">
          <a
            href="/delivery"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-lg border border-white/15 bg-white/5 px-2.5 py-2 text-[11px] font-semibold text-white transition hover:bg-white/15"
          >
            <span className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-[#E6CCB2]" />
              Delivery
            </span>
            <ExternalLink className="h-3 w-3 text-[#E6CCB2]" />
          </a>
          <a
            href="/conta"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-lg border border-white/15 bg-white/5 px-2.5 py-2 text-[11px] font-semibold text-white transition hover:bg-white/15"
          >
            <span className="flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-[#E6CCB2]" />
              Clube
            </span>
            <ExternalLink className="h-3 w-3 text-[#E6CCB2]" />
          </a>
        </div>

        <div className="rounded-lg bg-white/5 px-3 py-2 text-[11px]">
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

  const mobileDockTabs = allNavItems.slice(0, 4);

  return (
    <div className="min-h-screen w-full bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <a href="#erp-main" className="skip-link">
        Pular para o conteúdo
      </a>

      {/* Desktop Fixed Sidebar */}
      <aside className="cafe-sidebar hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:block lg:w-64 lg:overflow-y-auto lg:border-r">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
        >
          <div
            className="fixed inset-0 bg-black/55"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="cafe-sidebar relative z-10 h-full w-72 max-w-[85vw] overflow-y-auto shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col pb-24 lg:pl-64 lg:pb-0">
        {/* Slim Sticky Topbar */}
        <header className="cafe-topbar sticky top-0 z-30 flex items-center justify-between gap-2 px-4 py-3 sm:px-6 lg:px-8">
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
              <h2 className="text-base font-bold leading-tight text-[var(--text-primary)] sm:text-lg">
                {currentTabLabel}
              </h2>
              <p className="hidden text-xs text-[var(--text-secondary)] sm:block">
                {data.storeSettings?.isDeliveryOpen
                  ? "Loja & Delivery Abertos"
                  : "Delivery Pausado"}{" "}
                · {operatorSession.name}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 sm:gap-2">
            {/* Command Palette Trigger */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-warm)] bg-[var(--bg-canvas)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)] transition hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]"
              aria-label="Busca rápida (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Buscar ou comando...</span>
              <kbd className="hidden rounded border border-[var(--border-warm)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[10px] sm:inline">
                ⌘K
              </kbd>
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((v) => !v)}
                className="icon-btn relative"
                aria-label="Central de notificações"
              >
                {notifications.some((n) => n.severity === "urgent") ? (
                  <BellRing className="h-4 w-4 text-orange-600 animate-pulse" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
                {notifications.length > 0 && (
                  <span className="font-mono-num absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent-primary)] px-1 text-[9px] font-bold text-white">
                    {notifications.length}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="card-bistro animate-scale-in absolute top-full right-0 z-50 mt-2 w-80 max-w-[90vw] p-3 shadow-2xl">
                  <div className="mb-2 flex items-center justify-between border-b border-[var(--border-warm)] pb-2">
                    <span className="text-xs font-bold">
                      Alertas do Turno ({notifications.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setAlertSound((s) => !s)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-warm)] px-2 py-0.5 text-[10px] font-semibold"
                    >
                      {alertSound ? (
                        <Volume2 className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <VolumeX className="h-3 w-3" />
                      )}
                      {alertSound ? "Som ativo" : "Som mudo"}
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="py-4 text-center text-xs text-[var(--text-secondary)]">
                      Tudo tranquilo na operação!
                    </p>
                  ) : (
                    <div className="max-h-72 space-y-1.5 overflow-y-auto">
                      {notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            if (canAccessTab(operatorSession.role, n.tab)) {
                              setActiveTab(n.tab);
                            }
                            setNotificationsOpen(false);
                          }}
                          className={`block w-full rounded-xl border p-2.5 text-left text-xs transition hover:border-[var(--accent-primary)] ${
                            n.severity === "urgent"
                              ? "border-orange-300 bg-orange-50/70 text-orange-950"
                              : "border-[var(--border-warm)] bg-[var(--bg-canvas)]"
                          }`}
                        >
                          <p className="font-bold">{n.title}</p>
                          <p className="text-[11px] opacity-80">{n.detail}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="icon-btn"
              aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              title={theme === "dark" ? "Tema Creme" : "Tema Espresso Noturno"}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setQrTableNumber(data.tables[0]?.number ?? 1)}
              className="hidden items-center gap-1.5 rounded-lg border border-[var(--border-warm)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-canvas)] md:inline-flex"
            >
              <QrCode className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
              QR Mesas
            </button>

            {canAccessTab(operatorSession.role, "orders") && (
              <a
                href="/api/reports/export"
                className="hidden items-center gap-1.5 rounded-lg border border-[var(--border-warm)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-canvas)] md:inline-flex"
              >
                <Download className="h-3.5 w-3.5 text-emerald-700" />
                CSV
              </a>
            )}

            <button
              type="button"
              onClick={refreshWorkspace}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-warm)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-canvas)]"
              aria-label="Atualizar dados"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </header>

        <main id="erp-main" className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {dbError && (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-700" />
              <div>
                <p className="font-bold">Banco de dados indisponível</p>
                <p className="text-xs">{dbError}</p>
              </div>
            </div>
          )}

          {/* Waiter Call Urgent Banner */}
          {waiterCallTables.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-orange-300 bg-orange-50 px-4 py-3 text-xs text-orange-950 shadow-xs">
              <div className="flex items-center gap-2 font-bold">
                <BellRing className="h-4 w-4 text-orange-700 animate-pulse" />
                <span>
                  Chamado de garçom ativo:{" "}
                  {waiterCallTables.map((t) => t.name).join(", ")}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {waiterCallTables.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => dismissWaiterCall(t.number)}
                    className="rounded-lg bg-orange-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-orange-800"
                  >
                    Atendido ({t.name})
                  </button>
                ))}
              </div>
            </div>
          )}

          {toast && (
            <div
              role="status"
              className={`animate-fade-in mb-4 rounded-xl border px-4 py-2.5 text-xs font-semibold shadow-sm ${
                toast.type === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-red-200 bg-red-50 text-red-900"
              }`}
            >
              {toast.text}
            </div>
          )}

          {activeTab === "overview" && canAccessTab(operatorSession.role, "overview") && (
            <div className="animate-fade-in space-y-6">
              {/* Hero + KPI Bento Grid */}
              <div className="grid gap-4 xl:grid-cols-12">
                <div className="flex flex-col justify-between rounded-2xl bg-[var(--bg-shell)] p-5 text-white shadow-lg sm:p-6 xl:col-span-5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-[#f2b880]">
                        <Target className="h-3.5 w-3.5 text-[#D48D64]" />
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
                        <p className="text-xs text-[#E6CCB2]/85">Faturamento Pago Hoje</p>
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
                    <span className="text-[#E6CCB2]/85">
                      {data.metrics.paidCount} vendas · Ticket{" "}
                      <strong className="font-mono-num text-white">
                        {formatBRL(data.metrics.avgTicket)}
                      </strong>
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {canAccessTab(operatorSession.role, "pdv") && (
                        <button
                          type="button"
                          onClick={() => setActiveTab("pdv")}
                          className="btn-primary rounded-xl px-3 py-1.5 font-semibold"
                        >
                          + Novo Pedido
                        </button>
                      )}
                      {canAccessTab(operatorSession.role, "delivery") && (
                        <button
                          type="button"
                          onClick={() => setActiveTab("delivery")}
                          className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 font-semibold text-white hover:bg-white/20"
                        >
                          Delivery ({data.metrics.activeDeliveries})
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4 KPI Tiles */}
                <div className="grid gap-4 sm:grid-cols-2 xl:col-span-7">
                  <div className="card-bistro flex flex-col justify-between p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-[var(--text-secondary)]">
                        Mesas & Salão
                      </p>
                      <span className="rounded-xl bg-amber-50 p-2 text-amber-700">
                        <UtensilsCrossed className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="font-mono-num mt-2 text-2xl font-bold text-[var(--text-primary)]">
                      {data.metrics.occupiedTables} / {data.metrics.totalTables}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                      {data.metrics.activeOrdersCount} pedidos abertos ·{" "}
                      {data.metrics.waiterCallsCount} chamados
                    </p>
                  </div>

                  <div className="card-bistro flex flex-col justify-between p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-[var(--text-secondary)]">
                        Delivery & KDS
                      </p>
                      <span className="rounded-xl bg-orange-50 p-2 text-[#C07F5A]">
                        <Truck className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="font-mono-num mt-2 text-2xl font-bold text-[var(--accent-primary)]">
                      {data.metrics.activeDeliveries} entregas · {data.metrics.kdsPendingCount} KDS
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                      Receita delivery hoje: {formatBRL(data.metrics.deliveryRevenue)}
                    </p>
                  </div>

                  <div className="card-bistro flex flex-col justify-between p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-[var(--text-secondary)]">
                        Clube & Satisfação
                      </p>
                      <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                        <Award className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="font-mono-num mt-2 text-2xl font-bold text-emerald-600">
                      {data.customers.length} clientes ·{" "}
                      <span className="inline-flex items-center gap-1 text-amber-500">
                        <Star className="h-4 w-4 fill-amber-500" />
                        {data.metrics.averageRating.toFixed(1)}
                      </span>
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                      {activePointsTotal} pts acumulados · {data.metrics.reviewsCount} avaliações
                    </p>
                  </div>

                  <div className="card-bistro flex flex-col justify-between p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-[var(--text-secondary)]">
                        Alertas de Estoque
                      </p>
                      <span className="rounded-xl bg-red-50 p-2 text-red-700">
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="font-mono-num mt-2 text-2xl font-bold text-amber-600">
                      {data.metrics.lowStockAlerts}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
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
                      <p className="text-[var(--text-secondary)]">Sem vendas pagas ainda.</p>
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
                            <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                              <div
                                className="h-full rounded-full bg-[var(--accent-primary)]"
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
                      <p className="text-[var(--text-secondary)]">Sem recebimentos ainda.</p>
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
                            <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                              <div
                                className="h-full rounded-full bg-emerald-600"
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
                    <BarChart3 className="h-4 w-4 text-[var(--accent-primary)]" /> Vendas por Hora
                  </h3>
                  <div className="mt-4 flex h-28 items-end gap-1">
                    {analytics.salesByHour.slice(7, 23).map((val, idx) => {
                      const hour = idx + 7;
                      const heightPct =
                        val > 0
                          ? Math.max(12, Math.round((val / analytics.maxHourRevenue) * 100))
                          : 4;
                      return (
                        <div key={hour} className="group flex flex-1 flex-col items-center gap-1">
                          <div className="flex h-20 w-full items-end">
                            <div
                              title={`${hour}h: ${formatBRL(val)}`}
                              className={`w-full rounded-t-sm transition-all ${
                                val > 0
                                  ? "bg-[var(--accent-primary)] group-hover:bg-[var(--accent-primary-dark)]"
                                  : "bg-[var(--bg-subtle)]"
                              }`}
                              style={{ height: `${heightPct}%` }}
                            />
                          </div>
                          {hour % 3 === 0 && (
                            <span className="font-mono-num text-[9px] text-[var(--text-secondary)]">
                              {hour}h
                            </span>
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
                        className="flex items-center justify-between rounded-lg bg-[var(--bg-canvas)] px-2.5 py-1.5"
                      >
                        <span className="truncate font-semibold">
                          {idx + 1}. {p.name}
                        </span>
                        <span className="font-mono-num shrink-0 font-bold text-[var(--accent-primary)]">
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
                    {canAccessTab(operatorSession.role, "pdv") && (
                      <button
                        type="button"
                        onClick={() => setActiveTab("pdv")}
                        className="text-xs font-semibold text-[var(--accent-primary)] hover:underline"
                      >
                        Novo Pedido →
                      </button>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {data.orders.slice(0, 6).map((order) => (
                      <div
                        key={order.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono-num font-bold">{order.code}</span>
                            <span className="rounded bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-bold">
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
                          <p className="mt-1 text-[var(--text-secondary)]">
                            {order.customerName ?? "Cliente"} · {order.items.length} itens
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono-num text-sm font-bold text-[var(--text-primary)]">
                            {formatBRL(order.total)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setReceiptOrder(order)}
                            className="icon-btn"
                            title="Ver Cupom 80mm"
                            aria-label={`Cupom do pedido ${order.code}`}
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
                      <StickyNote className="h-4 w-4 text-[var(--accent-primary)]" />
                      Mural do Turno
                    </h3>
                    <span className="chip bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
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
                            ? "border-[var(--border-warm)] bg-[var(--bg-canvas)] opacity-60"
                            : note.priority === "IMPORTANTE"
                              ? "border-amber-300 bg-amber-50/70 text-amber-950"
                              : "border-[var(--border-warm)] bg-[var(--bg-canvas)]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleNote(note.id, !note.isDone)}
                          className="mt-0.5 text-[var(--accent-primary)]"
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
                            <span className="font-bold">{note.author}</span>
                            {note.priority === "IMPORTANTE" && (
                              <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-950">
                                IMPORTANTE
                              </span>
                            )}
                          </div>
                          <p
                            className={`mt-0.5 opacity-85 ${
                              note.isDone ? "line-through" : ""
                            }`}
                          >
                            {note.content}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          className="text-[var(--text-secondary)] hover:text-red-700"
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
                        <Croissant className="h-4 w-4 text-[var(--accent-primary)]" /> Fornadas
                      </h3>
                      {canAccessTab(operatorSession.role, "bakery") && (
                        <button
                          type="button"
                          onClick={() => setActiveTab("bakery")}
                          className="text-xs font-semibold text-[var(--accent-primary)] hover:underline"
                        >
                          Gerenciar →
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {data.batches.slice(0, 4).map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between rounded-xl bg-[var(--bg-canvas)] px-3 py-2 text-xs"
                        >
                          <span className="truncate">
                            <strong className="font-mono-num">{b.bakeTime}</strong> ·{" "}
                            {b.productName}
                          </span>
                          <span className="shrink-0 rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-bold">
                            {b.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card-bistro p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-display flex items-center gap-2 text-lg font-bold">
                        <QrCode className="h-4 w-4 text-[var(--accent-primary)]" /> Mesas QR
                      </h3>
                      {canAccessTab(operatorSession.role, "tables") && (
                        <button
                          type="button"
                          onClick={() => setActiveTab("tables")}
                          className="text-xs font-semibold text-[var(--accent-primary)] hover:underline"
                        >
                          Ver Mesas →
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {data.tables.slice(0, 6).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setQrTableNumber(t.number)}
                          className="rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] px-2.5 py-1.5 text-xs font-semibold hover:border-[var(--accent-primary)]"
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

          {activeTab === "pdv" && canAccessTab(operatorSession.role, "pdv") && (
            <PosSection
              products={data.products}
              tables={data.tables}
              customers={data.customers}
              deliveryZones={data.deliveryZones}
              storeSettings={data.storeSettings}
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

          {activeTab === "delivery" && canAccessTab(operatorSession.role, "delivery") && (
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

          {activeTab === "tables" && canAccessTab(operatorSession.role, "tables") && (
            <TablesSection
              tables={data.tables}
              orders={data.orders}
              reservations={data.reservations}
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

          {activeTab === "kds" && canAccessTab(operatorSession.role, "kds") && (
            <KdsSection
              orders={data.orders}
              onRefresh={refreshWorkspace}
              onError={(msg) => showToast("err", msg)}
            />
          )}

          {activeTab === "bakery" && canAccessTab(operatorSession.role, "bakery") && (
            <BakeryCakeSection
              products={data.products}
              batches={data.batches}
              cakeOrders={data.cakeOrders}
              onRefresh={refreshWorkspace}
              onError={(msg) => showToast("err", msg)}
            />
          )}

          {activeTab === "orders" && canAccessTab(operatorSession.role, "orders") && (
            <OrdersHistorySection
              orders={data.orders}
              onOpenReceipt={(order) => setReceiptOrder(order)}
              onRefresh={refreshWorkspace}
              onError={(msg) => showToast("err", msg)}
            />
          )}

          {activeTab === "finance" && canAccessTab(operatorSession.role, "finance") && (
            <FinanceSection
              orders={data.orders}
              products={data.products}
              cakeOrders={data.cakeOrders}
              cashSessions={data.cashSessions}
              financialEntries={data.financialEntries}
              creditCardFeePct={data.storeSettings?.creditCardFeePct ?? 3.2}
              debitCardFeePct={data.storeSettings?.debitCardFeePct ?? 1.6}
              onRefresh={refreshWorkspace}
              onError={(msg) => showToast("err", msg)}
            />
          )}

          {activeTab === "customers" && canAccessTab(operatorSession.role, "customers") && (
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

          {activeTab === "inventory" && canAccessTab(operatorSession.role, "inventory") && (
            <InventoryCashSection
              categories={data.categories}
              products={data.products}
              ingredients={data.ingredients}
              openCashSession={data.openCashSession}
              onRefresh={refreshWorkspace}
              onError={(msg) => showToast("err", msg)}
            />
          )}

          {activeTab === "settings" && canAccessTab(operatorSession.role, "settings") && (
            <SettingsTeamSection
              storeSettings={data.storeSettings}
              staffUsers={data.staffUsers}
              coupons={data.coupons}
              reviews={data.reviews}
              auditLogs={data.auditLogs}
              onRefresh={refreshWorkspace}
              onError={(msg) => showToast("err", msg)}
              onSuccess={(msg) => showToast("ok", msg)}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Quick Dock */}
      <nav
        className="cafe-topbar safe-bottom fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t px-2 pt-1.5 lg:hidden"
        aria-label="Atalhos mobile"
      >
        {mobileDockTabs.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1 text-[10px] font-bold transition ${
                active ? "text-[var(--accent-primary)]" : "text-[var(--text-secondary)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label.split(" ")[0]}</span>
              {item.badge !== undefined && (
                <span className="font-mono-num absolute top-0 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent-primary)] px-1 text-[9px] text-white">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1 text-[10px] font-bold text-[var(--text-secondary)]"
        >
          <Menu className="h-4 w-4" />
          <span>Mais</span>
        </button>
      </nav>

      <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />
      <QrModal
        tableNumber={qrTableNumber}
        onClose={() => setQrTableNumber(null)}
        onRotated={refreshWorkspace}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        role={operatorSession.role}
        orders={data.orders}
        products={data.products}
        customers={data.customers}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSelectTab={(tab) => setActiveTab(tab)}
        onOpenReceipt={(o) => setReceiptOrder(o)}
        onSelectCustomer={(id) => {
          setPreselectedCustomerId(id);
          setActiveTab("customers");
        }}
        onOpenQr={() => setQrTableNumber(data.tables[0]?.number ?? 1)}
        onOpenSwitchOperator={() => setSwitchOperatorOpen(true)}
      />
      <SwitchOperatorModal
        open={switchOperatorOpen}
        currentSession={operatorSession}
        onClose={() => setSwitchOperatorOpen(false)}
      />
    </div>
  );
}
