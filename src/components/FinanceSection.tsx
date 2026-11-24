"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  CheckCircle2,
  CreditCard,
  Download,
  Landmark,
  Percent,
  Plus,
  Printer,
  Search,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  calculateCardFeeRate,
  calculateMarginPercentage,
  calculateProductRecipeCost,
  computeFinancialDre,
  formatBRL,
  roundMoney,
} from "@/lib/domain";
import type {
  CakeOrderDto,
  CashSessionDto,
  FinancialEntryDto,
  OrderDto,
  ProductDto,
} from "@/types/erp";

interface FinanceSectionProps {
  orders: OrderDto[];
  products: ProductDto[];
  cakeOrders: CakeOrderDto[];
  cashSessions: CashSessionDto[];
  financialEntries: FinancialEntryDto[];
  creditCardFeePct?: number;
  debitCardFeePct?: number;
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  FORNECEDOR: "Fornecedor / Insumos",
  ALUGUEL: "Aluguel & Condomínio",
  FOLHA: "Folha & Baristas",
  ENERGIA: "Energia, Água & Gás",
  IMPOSTOS: "Impostos & Taxas",
  VENDAS_EXTRA: "Eventos / Assinaturas",
  OUTROS: "Outros",
};

export function FinanceSection({
  orders,
  products,
  cakeOrders,
  cashSessions,
  financialEntries,
  creditCardFeePct = 3.2,
  debitCardFeePct = 1.6,
  onRefresh,
  onError,
}: FinanceSectionProps) {
  const [periodFilter, setPeriodFilter] = useState<"TODAY" | "7D" | "30D" | "ALL">(
    "ALL",
  );
  const [filterType, setFilterType] = useState<
    "ALL" | "DESPESA" | "RECEITA" | "PENDENTE" | "PAGO"
  >("ALL");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const [type, setType] = useState<"DESPESA" | "RECEITA">("DESPESA");
  const [category, setCategory] = useState<
    | "FORNECEDOR"
    | "ALUGUEL"
    | "FOLHA"
    | "ENERGIA"
    | "IMPOSTOS"
    | "VENDAS_EXTRA"
    | "OUTROS"
  >("FORNECEDOR");
  const [description, setDescription] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [paymentMethod, setPaymentMethod] = useState<
    "PIX" | "BOLETO" | "TRANSFERENCIA" | "DINHEIRO" | "CREDITO" | "DEBITO"
  >("PIX");
  const [status, setStatus] = useState<"PENDENTE" | "PAGO">("PENDENTE");

  const [nowTs] = useState(() => Date.now());

  const periodOrders = useMemo(() => {
    if (periodFilter === "ALL") return orders;
    const todayStr = new Date(nowTs).toISOString().slice(0, 10);
    return orders.filter((o) => {
      const ref = o.paidAt ?? o.createdAt;
      if (periodFilter === "TODAY") {
        return ref.slice(0, 10) === todayStr;
      }
      const days = periodFilter === "7D" ? 7 : 30;
      return nowTs - new Date(ref).getTime() <= days * 86400000;
    });
  }, [orders, periodFilter, nowTs]);

  const productCostById = useMemo(() => {
    const map = new Map<number, number>();
    for (const product of products) {
      const recipeCost = calculateProductRecipeCost(
        (product.recipeItems ?? []).map((ri) => ({
          qtyRequired: ri.qtyRequired,
          costPerUnit: ri.ingredient.costPerUnit,
        })),
      );
      if (recipeCost > 0) {
        map.set(product.id, recipeCost);
      }
    }
    return map;
  }, [products]);

  const dre = useMemo(
    () =>
      computeFinancialDre({
        orders: periodOrders,
        productCostById,
        cakeOrders,
        entries: financialEntries,
        creditCardFeeRate: creditCardFeePct / 100,
        debitCardFeeRate: debitCardFeePct / 100,
      }),
    [
      periodOrders,
      productCostById,
      cakeOrders,
      financialEntries,
      creditCardFeePct,
      debitCardFeePct,
    ],
  );

  const paymentBreakdown = useMemo(() => {
    const groups = new Map<
      string,
      { gross: number; fee: number; net: number; count: number }
    >();
    for (const order of periodOrders) {
      if (order.status !== "PAGO") continue;
      const pm = order.paymentMethod ?? "OUTRO";
      const rate =
        pm === "CREDITO"
          ? creditCardFeePct / 100
          : pm === "DEBITO"
            ? debitCardFeePct / 100
            : calculateCardFeeRate(pm);
      const fee = roundMoney(order.total * rate);
      const cur = groups.get(pm) ?? { gross: 0, fee: 0, net: 0, count: 0 };
      cur.gross = roundMoney(cur.gross + order.total);
      cur.fee = roundMoney(cur.fee + fee);
      cur.net = roundMoney(cur.net + (order.total - fee));
      cur.count += 1;
      groups.set(pm, cur);
    }
    return [...groups.entries()].sort((a, b) => b[1].gross - a[1].gross);
  }, [periodOrders, creditCardFeePct, debitCardFeePct]);

  const productMargins = useMemo(() => {
    return products
      .map((p) => {
        const recipeCost = productCostById.get(p.id) ?? 0;
        const hasRecipe = recipeCost > 0;
        const unitCost = hasRecipe ? recipeCost : roundMoney(p.price * 0.32);
        const unitProfit = roundMoney(p.price - unitCost);
        const marginPct = calculateMarginPercentage(p.price, unitCost);
        return {
          product: p,
          hasRecipe,
          unitCost,
          unitProfit,
          marginPct,
        };
      })
      .sort((a, b) => b.marginPct - a.marginPct);
  }, [products, productCostById]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return financialEntries.filter((entry) => {
      if (filterType === "DESPESA" && entry.type !== "DESPESA") return false;
      if (filterType === "RECEITA" && entry.type !== "RECEITA") return false;
      if (filterType === "PENDENTE" && entry.status === "PAGO") return false;
      if (filterType === "PAGO" && entry.status !== "PAGO") return false;
      if (
        q &&
        !entry.description.toLowerCase().includes(q) &&
        !(entry.counterparty ?? "").toLowerCase().includes(q) &&
        !entry.category.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [financialEntries, filterType, search]);

  const pendingPayableCount = financialEntries.filter(
    (e) => e.type === "DESPESA" && e.status !== "PAGO",
  ).length;

  async function handleCreateEntry(e: React.FormEvent) {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!description.trim() || !Number.isFinite(numAmount) || numAmount <= 0) {
      onError("Informe descrição e um valor maior que zero.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          category,
          description: description.trim(),
          counterparty: counterparty.trim() || undefined,
          amount: numAmount,
          dueDate,
          status,
          paymentMethod,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onError(json.error ?? "Erro ao salvar lançamento financeiro.");
        return;
      }
      setDescription("");
      setCounterparty("");
      setAmount("");
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleEntryStatus(entry: FinancialEntryDto) {
    setBusy(true);
    try {
      const nextStatus = entry.status === "PAGO" ? "PENDENTE" : "PAGO";
      const res = await fetch("/api/finance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: entry.id,
          status: nextStatus,
          paymentMethod:
            (entry.paymentMethod as
              | "PIX"
              | "BOLETO"
              | "TRANSFERENCIA"
              | "DINHEIRO"
              | "CREDITO"
              | "DEBITO"
              | undefined) ?? "PIX",
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        onError(j.error ?? "Erro ao atualizar título financeiro.");
        return;
      }
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(id: number) {
    setBusy(true);
    try {
      const res = await fetch(`/api/finance?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        onError("Erro ao remover lançamento.");
        return;
      }
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Period Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="segmented">
          {(
            [
              { id: "TODAY", label: "Hoje" },
              { id: "7D", label: "7 dias" },
              { id: "30D", label: "30 dias" },
              { id: "ALL", label: "Todo período" },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              data-active={periodFilter === p.id}
              onClick={() => setPeriodFilter(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir DRE
          </button>
          <a
            href="/api/reports/export?scope=finance"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600" />
            Exportar Financeiro CSV
          </a>
        </div>
      </div>

      {/* KPI Bento Header */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card-bistro p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              Receita Bruta Realizada
            </span>
            <span className="rounded-lg bg-emerald-100 p-1.5 text-emerald-700">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <p className="font-mono-num mt-2 text-2xl font-bold text-emerald-600">
            {formatBRL(dre.grossRevenue)}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
            Vendas {formatBRL(dre.ordersRevenue)} · Sinais/Extras{" "}
            {formatBRL(dre.cakeDepositsReceived + dre.extraRevenuePaid)}
          </p>
        </div>

        <div className="card-bistro p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              Lucro Líquido Estimado (DRE)
            </span>
            <span className="rounded-lg bg-amber-100 p-1.5 text-[#C07F5A]">
              <Calculator className="h-4 w-4" />
            </span>
          </div>
          <p
            className={`font-mono-num mt-2 text-2xl font-bold ${
              dre.netProfit >= 0 ? "text-[var(--text-primary)]" : "text-red-700"
            }`}
          >
            {formatBRL(dre.netProfit)}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
            Margem líquida:{" "}
            <strong className="font-mono-num text-[var(--accent-primary)]">
              {dre.netMarginPct}%
            </strong>{" "}
            (já descontando CMV e taxas)
          </p>
        </div>

        <div className="card-bistro p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              Contas a Pagar (Pendentes)
            </span>
            <span className="rounded-lg bg-red-100 p-1.5 text-red-700">
              <ArrowDownRight className="h-4 w-4" />
            </span>
          </div>
          <p className="font-mono-num mt-2 text-2xl font-bold text-red-600">
            {formatBRL(dre.operatingExpensesPending)}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
            {pendingPayableCount} títulos em aberto · Já pago:{" "}
            {formatBRL(dre.operatingExpensesPaid)}
          </p>
        </div>

        <div className="card-bistro p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              A Receber (Mesas, Bolos & Extra)
            </span>
            <span className="rounded-lg bg-emerald-100 p-1.5 text-emerald-700">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
          <p className="font-mono-num mt-2 text-2xl font-bold text-[var(--accent-primary)]">
            {formatBRL(dre.receivablesPending)}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
            Comandas abertas + saldo encomendas + recebíveis
          </p>
        </div>
      </div>

      {/* DRE + Meios de Pagamento & Caixa */}
      <div className="grid gap-5 lg:grid-cols-12">
        <section id="dre-report-print" className="card-bistro p-5 lg:col-span-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-warm)] pb-3">
            <div className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-[var(--accent-primary)]" />
              <div>
                <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                  DRE Gerencial — Demonstrativo de Resultados
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Consolidado automático entre PDV, Mesas, Encomendas, CMV das fichas técnicas e despesas.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between rounded-xl bg-[var(--bg-canvas)] px-3.5 py-2.5">
              <span className="font-semibold text-[var(--text-primary)]">
                (+) Receita de Pedidos Pagos (PDV, Mesas & Delivery)
              </span>
              <span className="font-mono-num font-bold text-emerald-600">
                {formatBRL(dre.ordersRevenue)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--bg-canvas)] px-3.5 py-2.5">
              <span className="font-semibold text-[var(--text-primary)]">
                (+) Sinais de Bolos & Receitas Extras Recebidas
              </span>
              <span className="font-mono-num font-bold text-emerald-600">
                {formatBRL(dre.cakeDepositsReceived + dre.extraRevenuePaid)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2.5 text-emerald-950">
              <span className="font-bold">(=) Receita Bruta Total Realizada</span>
              <span className="font-mono-num text-sm font-bold text-emerald-900">
                {formatBRL(dre.grossRevenue)}
              </span>
            </div>
            <div className="flex items-center justify-between px-3.5 py-1.5 text-[var(--text-secondary)]">
              <span>
                (-) Taxas de Adquirência Estimadas (Crédito {creditCardFeePct}% · Débito {debitCardFeePct}%)
              </span>
              <span className="font-mono-num font-semibold text-red-600">
                - {formatBRL(dre.cardFeesEstimated)}
              </span>
            </div>
            <div className="flex items-center justify-between px-3.5 py-1.5 text-[var(--text-secondary)]">
              <span>(-) CMV Estimado (Custo de Insumos das Fichas Técnicas)</span>
              <span className="font-mono-num font-semibold text-red-600">
                - {formatBRL(dre.estimatedCmv)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--bg-subtle)] px-3.5 py-2.5">
              <span className="font-bold text-[var(--text-primary)]">
                (=) Margem de Contribuição
              </span>
              <span className="font-mono-num font-bold text-[var(--text-primary)]">
                {formatBRL(dre.contributionMargin)}
              </span>
            </div>
            <div className="flex items-center justify-between px-3.5 py-1.5 text-[var(--text-secondary)]">
              <span>(-) Despesas Operacionais Pagas (Fornecedores/Custos)</span>
              <span className="font-mono-num font-semibold text-red-600">
                - {formatBRL(dre.operatingExpensesPaid)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--bg-shell)] px-4 py-3 text-white">
              <div>
                <span className="font-display text-sm font-bold">
                  (=) Resultado Líquido Estimado
                </span>
                <p className="text-[10px] text-[#E6CCB2]">
                  Descontos concedidos: {formatBRL(dre.discountsTotal)} · Taxas de serviço:{" "}
                  {formatBRL(dre.serviceFeesTotal)}
                </p>
              </div>
              <div className="text-right">
                <span className="font-mono-num text-lg font-bold text-amber-300">
                  {formatBRL(dre.netProfit)}
                </span>
                <p className="font-mono-num text-[11px] text-emerald-300">
                  {dre.netMarginPct}% de margem
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Recebimentos Líquidos & Turnos de Caixa */}
        <section className="space-y-5 lg:col-span-5">
          <div className="card-bistro p-5">
            <div className="mb-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-[var(--accent-primary)]" />
              <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                Conciliação por Meio de Pagamento
              </h3>
            </div>
            <div className="space-y-2.5 text-xs">
              {paymentBreakdown.length === 0 ? (
                <p className="text-[var(--text-secondary)]">
                  Nenhuma venda paga registrada no período.
                </p>
              ) : (
                paymentBreakdown.map(([pm, stats]) => (
                  <div
                    key={pm}
                    className="rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3"
                  >
                    <div className="flex items-center justify-between font-bold text-[var(--text-primary)]">
                      <span>
                        {pm}{" "}
                        <span className="text-[10px] font-normal text-[var(--text-secondary)]">
                          ({stats.count} vendas)
                        </span>
                      </span>
                      <span className="font-mono-num text-emerald-600">
                        Líq. {formatBRL(stats.net)}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-[var(--text-secondary)]">
                      <span>Bruto: {formatBRL(stats.gross)}</span>
                      <span>Taxa est.: - {formatBRL(stats.fee)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card-bistro p-5">
            <div className="mb-3 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-[var(--accent-primary)]" />
              <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                Histórico de Turnos de Caixa
              </h3>
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1 text-xs">
              {cashSessions.length === 0 ? (
                <p className="text-[var(--text-secondary)]">Nenhum turno registrado.</p>
              ) : (
                cashSessions.map((session) => {
                  const diff =
                    session.closingAmount !== null
                      ? roundMoney(
                          session.closingAmount - session.expectedAmount,
                        )
                      : null;
                  return (
                    <div
                      key={session.id}
                      className="rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[var(--text-primary)]">
                          #{session.id} · {session.openedBy}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            session.status === "ABERTO"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-stone-200 text-stone-800"
                          }`}
                        >
                          {session.status}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap justify-between gap-2 text-[11px] text-[var(--text-secondary)]">
                        <span>Abertura: {formatBRL(session.openingAmount)}</span>
                        <span className="font-mono-num font-semibold text-[var(--text-primary)]">
                          Esperado: {formatBRL(session.expectedAmount)}
                        </span>
                        {diff !== null && (
                          <span
                            className={`font-mono-num font-bold ${
                              diff === 0
                                ? "text-emerald-600"
                                : diff > 0
                                  ? "text-amber-600"
                                  : "text-red-600"
                            }`}
                          >
                            Quebra: {diff >= 0 ? "+" : ""}
                            {formatBRL(diff)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Contas a Pagar & Receber */}
      <section className="card-bistro p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
              Contas a Pagar & Receber
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Registre compras, despesas operacionais, eventos e dê baixa em 1 clique.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar título ou fornecedor..."
                className="input-field py-1.5 pr-3 pl-8 text-xs"
              />
            </div>
            <div className="segmented">
              {(
                [
                  { id: "ALL", label: "Todos" },
                  { id: "DESPESA", label: "Despesas" },
                  { id: "RECEITA", label: "Receitas" },
                  { id: "PENDENTE", label: "Pendentes" },
                  { id: "PAGO", label: "Pagos" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  data-active={filterType === tab.id}
                  onClick={() => setFilterType(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <form
          onSubmit={handleCreateEntry}
          className="mb-5 grid gap-2.5 rounded-2xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-4 sm:grid-cols-2 lg:grid-cols-8"
        >
          <select
            value={type}
            onChange={(e) => {
              const next = e.target.value as "DESPESA" | "RECEITA";
              setType(next);
              if (next === "RECEITA") setCategory("VENDAS_EXTRA");
              else if (category === "VENDAS_EXTRA") setCategory("FORNECEDOR");
            }}
            className="input-field py-2 text-xs font-semibold"
          >
            <option value="DESPESA">Despesa (Pagar)</option>
            <option value="RECEITA">Receita (Receber)</option>
          </select>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="input-field py-2 text-xs"
          >
            {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>

          <input
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição (ex: Compra Leite A2)"
            className="input-field py-2 text-xs lg:col-span-2"
          />

          <input
            type="text"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            placeholder="Fornecedor / Cliente"
            className="input-field py-2 text-xs"
          />

          <input
            type="number"
            required
            min="0.5"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Valor R$"
            className="input-field font-mono-num py-2 text-xs"
          />

          <input
            type="date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="input-field py-2 text-xs"
          />

          <select
            value={paymentMethod}
            onChange={(e) =>
              setPaymentMethod(e.target.value as typeof paymentMethod)
            }
            className="input-field py-2 text-xs"
          >
            <option value="PIX">PIX</option>
            <option value="BOLETO">Boleto</option>
            <option value="TRANSFERENCIA">Transferência</option>
            <option value="DINHEIRO">Dinheiro</option>
            <option value="CREDITO">Crédito</option>
            <option value="DEBITO">Débito</option>
          </select>

          <div className="flex gap-1.5 sm:col-span-2 lg:col-span-8 lg:justify-end">
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "PENDENTE" | "PAGO")
              }
              className="input-field w-36 py-2 text-xs"
            >
              <option value="PENDENTE">Status: Pendente</option>
              <option value="PAGO">Status: Já Pago</option>
            </select>
            <button
              type="submit"
              disabled={busy}
              className="btn-primary inline-flex items-center justify-center gap-1 rounded-xl px-5 py-2 text-xs font-semibold disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Lançar Título Financeiro
            </button>
          </div>
        </form>

        <div className="space-y-2">
          {filteredEntries.length === 0 ? (
            <p className="py-6 text-center text-xs text-[var(--text-secondary)]">
              Nenhum lançamento financeiro encontrado para esse filtro.
            </p>
          ) : (
            filteredEntries.map((entry) => {
              const isExpense = entry.type === "DESPESA";
              const isPaid = entry.status === "PAGO";
              return (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          isExpense
                            ? "bg-red-100 text-red-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {isExpense ? "DESPESA" : "RECEITA"}
                      </span>
                      <span className="rounded bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                        {CATEGORY_LABELS[entry.category] ?? entry.category}
                      </span>
                      <span className="font-bold text-[var(--text-primary)]">
                        {entry.description}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                      {entry.counterparty ? `${entry.counterparty} · ` : ""}
                      Vencimento:{" "}
                      <strong className="font-mono-num">{entry.dueDate}</strong>
                      {entry.paymentMethod ? ` · ${entry.paymentMethod}` : ""}
                      {entry.notes ? ` · ${entry.notes}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`font-mono-num text-sm font-bold ${
                        isExpense ? "text-red-600" : "text-emerald-600"
                      }`}
                    >
                      {isExpense ? "-" : "+"} {formatBRL(entry.amount)}
                    </span>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggleEntryStatus(entry)}
                      className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold transition ${
                        isPaid
                          ? "bg-emerald-100 text-emerald-900 hover:bg-emerald-200"
                          : "bg-[var(--bg-shell)] text-[#FAF3E8] hover:opacity-90"
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {isPaid ? "Quitado" : "Dar Baixa"}
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => deleteEntry(entry.id)}
                      className="icon-btn p-1.5 text-red-700"
                      title="Excluir lançamento"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Engenharia de Cardápio (CMV & Margem por Produto) */}
      <section className="card-bistro p-5">
        <div className="mb-4 flex items-center gap-2">
          <Percent className="h-5 w-5 text-[var(--accent-primary)]" />
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
              Engenharia de Cardápio — CMV & Margem de Lucro por Produto
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Custo calculado pelas fichas técnicas ligadas aos insumos (ou referência de 32% quando sem ficha).
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {productMargins.map(
            ({ product, hasRecipe, unitCost, unitProfit, marginPct }) => (
              <div
                key={product.id}
                className="flex flex-col justify-between rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3.5 text-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-[var(--text-primary)]">
                      {product.name}
                    </span>
                    <span
                      className={`font-mono-num shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        marginPct >= 65
                          ? "bg-emerald-100 text-emerald-900"
                          : marginPct >= 45
                            ? "bg-amber-100 text-amber-900"
                            : "bg-red-100 text-red-900"
                      }`}
                    >
                      {marginPct}% margem
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
                    {product.category.name} ·{" "}
                    {hasRecipe ? "CMV Ficha Técnica" : "CMV Estimado (32%)"}
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-1 border-t border-[var(--border-warm)] pt-2 text-[11px]">
                  <div>
                    <p className="text-[10px] text-[var(--text-secondary)]">Venda</p>
                    <p className="font-mono-num font-bold text-[var(--text-primary)]">
                      {formatBRL(product.price)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--text-secondary)]">Custo</p>
                    <p className="font-mono-num font-semibold text-red-600">
                      {formatBRL(unitCost)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-[var(--text-secondary)]">Lucro/un</p>
                    <p className="font-mono-num font-bold text-emerald-600">
                      {formatBRL(unitProfit)}
                    </p>
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
