"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  Boxes,
  CakeSlice,
  ChefHat,
  ClipboardList,
  ExternalLink,
  Landmark,
  LayoutDashboard,
  Moon,
  QrCode,
  Search,
  Settings,
  ShoppingCart,
  Sun,
  Truck,
  UserCheck,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { channelLabel, formatBRL } from "@/lib/domain";
import { canAccessTab, type ErpTabId } from "@/lib/rbac";
import type {
  CustomerProfileDto,
  OrderDto,
  ProductDto,
  StaffRole,
} from "@/types/erp";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  role: StaffRole;
  orders: OrderDto[];
  products: ProductDto[];
  customers: CustomerProfileDto[];
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onSelectTab: (tab: ErpTabId) => void;
  onOpenReceipt: (order: OrderDto) => void;
  onSelectCustomer: (customerId: number) => void;
  onOpenQr: () => void;
  onOpenSwitchOperator: () => void;
}

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  subtitle?: string;
  icon: typeof Search;
  onRun: () => void;
}

export function CommandPalette(props: CommandPaletteProps) {
  if (!props.open) return null;
  return <CommandPaletteInner {...props} />;
}

function CommandPaletteInner({
  onClose,
  role,
  orders,
  products,
  customers,
  theme,
  onToggleTheme,
  onSelectTab,
  onOpenReceipt,
  onSelectCustomer,
  onOpenQr,
  onOpenSwitchOperator,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const list: PaletteItem[] = [];

    const navDefs: Array<{ id: ErpTabId; label: string; icon: typeof Search }> = [
      { id: "overview", label: "Ir para Painel Geral", icon: LayoutDashboard },
      { id: "pdv", label: "Abrir PDV & Balcão", icon: ShoppingCart },
      { id: "delivery", label: "Abrir Painel Delivery", icon: Truck },
      { id: "tables", label: "Abrir Mesas & Reservas", icon: UtensilsCrossed },
      { id: "kds", label: "Abrir KDS Cozinha", icon: ChefHat },
      { id: "bakery", label: "Abrir Padaria & Bolos", icon: CakeSlice },
      { id: "orders", label: "Abrir Pedidos & CSV", icon: ClipboardList },
      { id: "finance", label: "Abrir Financeiro & DRE", icon: Landmark },
      { id: "customers", label: "Abrir Clube Fidelidade", icon: Award },
      { id: "inventory", label: "Abrir Estoque & Caixa", icon: Boxes },
      { id: "settings", label: "Abrir Equipe & Loja", icon: Settings },
    ];

    for (const nav of navDefs) {
      if (!canAccessTab(role, nav.id)) continue;
      if (!q || nav.label.toLowerCase().includes(q)) {
        list.push({
          id: `nav-${nav.id}`,
          group: "Navegação",
          label: nav.label,
          icon: nav.icon,
          onRun: () => {
            onSelectTab(nav.id);
            onClose();
          },
        });
      }
    }

    const actions: PaletteItem[] = [
      {
        id: "act-theme",
        group: "Ações Rápidas",
        label: theme === "dark" ? "Ativar tema claro (Creme)" : "Ativar tema escuro (Espresso)",
        icon: theme === "dark" ? Sun : Moon,
        onRun: () => {
          onToggleTheme();
          onClose();
        },
      },
      {
        id: "act-qr",
        group: "Ações Rápidas",
        label: "Gerar QR Code de Mesa",
        icon: QrCode,
        onRun: () => {
          onOpenQr();
          onClose();
        },
      },
      {
        id: "act-operator",
        group: "Ações Rápidas",
        label: "Trocar Operador / Bloquear Tela",
        icon: UserCheck,
        onRun: () => {
          onClose();
          onOpenSwitchOperator();
        },
      },
      {
        id: "act-delivery-public",
        group: "Ações Rápidas",
        label: "Abrir Vitrine Delivery (Cliente)",
        icon: ExternalLink,
        onRun: () => {
          window.open("/delivery", "_blank", "noopener,noreferrer");
          onClose();
        },
      },
    ];

    for (const act of actions) {
      if (!q || act.label.toLowerCase().includes(q)) {
        list.push(act);
      }
    }

    if (q.length >= 2) {
      for (const o of orders) {
        if (
          o.code.toLowerCase().includes(q) ||
          (o.customerName ?? "").toLowerCase().includes(q) ||
          (o.customerPhone ?? "").includes(q)
        ) {
          list.push({
            id: `ord-${o.id}`,
            group: "Pedidos",
            label: `${o.code} · ${o.customerName ?? channelLabel(o.channel)}`,
            subtitle: `${o.status} · ${formatBRL(o.total)}`,
            icon: ClipboardList,
            onRun: () => {
              onOpenReceipt(o);
              onClose();
            },
          });
        }
      }

      for (const c of customers) {
        if (c.name.toLowerCase().includes(q) || c.phone.includes(q)) {
          list.push({
            id: `cust-${c.id}`,
            group: "Clientes",
            label: c.name,
            subtitle: `${c.phone} · ${c.loyaltyPoints} pts`,
            icon: Award,
            onRun: () => {
              onSelectCustomer(c.id);
              onClose();
            },
          });
        }
      }

      for (const p of products) {
        if (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) {
          list.push({
            id: `prod-${p.id}`,
            group: "Produtos",
            label: p.name,
            subtitle: `${p.sku} · ${formatBRL(p.price)}`,
            icon: ShoppingCart,
            onRun: () => {
              if (canAccessTab(role, "pdv")) onSelectTab("pdv");
              onClose();
            },
          });
        }
      }
    }

    return list.slice(0, 18);
  }, [
    query,
    role,
    theme,
    orders,
    customers,
    products,
    onSelectTab,
    onClose,
    onToggleTheme,
    onOpenQr,
    onOpenSwitchOperator,
    onOpenReceipt,
    onSelectCustomer,
  ]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((idx) => (items.length ? (idx + 1) % items.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((idx) =>
          items.length ? (idx - 1 + items.length) % items.length : 0,
        );
      } else if (e.key === "Enter" && items[selectedIndex]) {
        e.preventDefault();
        items[selectedIndex].onRun();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, selectedIndex, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 p-4 pt-16 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Busca e comandos rápidos"
      onClick={onClose}
    >
      <div
        className="card-bistro animate-scale-in w-full max-w-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border-warm)] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Buscar pedido, cliente, produto ou comando (↑↓ Enter)..."
            className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="icon-btn"
            aria-label="Fechar busca rápida"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="py-8 text-center text-xs text-[var(--text-secondary)]">
              Nenhum resultado para &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <div className="space-y-1">
              {items.map((item, idx) => {
                const Icon = item.icon;
                const active = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onRun}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition ${
                      active
                        ? "bg-[var(--accent-primary)] text-white"
                        : "text-[var(--text-primary)] hover:bg-[var(--bg-canvas)]"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{item.label}</p>
                        {item.subtitle && (
                          <p
                            className={`truncate text-[11px] ${
                              active ? "text-white/85" : "text-[var(--text-secondary)]"
                            }`}
                          >
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        active
                          ? "bg-white/20 text-white"
                          : "bg-[var(--bg-canvas)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {item.group}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border-warm)] bg-[var(--bg-canvas)] px-4 py-2 text-[10px] text-[var(--text-secondary)]">
          <span>Use ↑ ↓ para navegar · Enter para executar</span>
          <span>Esc para fechar</span>
        </div>
      </div>
    </div>
  );
}
