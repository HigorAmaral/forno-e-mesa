"use client";

import { useState } from "react";
import { AlertTriangle, Banknote, Boxes, Plus, Utensils } from "lucide-react";
import { formatBRL } from "@/lib/domain";
import type {
  CashSessionDto,
  CategoryDto,
  IngredientDto,
  ProductDto,
} from "@/types/erp";

interface InventoryCashSectionProps {
  categories: CategoryDto[];
  products: ProductDto[];
  ingredients: IngredientDto[];
  openCashSession: CashSessionDto | null;
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
}

export function InventoryCashSection({
  categories,
  products,
  ingredients,
  openCashSession,
  onRefresh,
  onError,
}: InventoryCashSectionProps) {
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPrice, setNewPrice] = useState("18");
  const [newUnit, setNewUnit] = useState<"UN" | "KG" | "FATIA" | "PORCAO">("UN");
  const [newStation, setNewStation] = useState<
    "BALCAO" | "FORNO" | "CONFEITARIA" | "COZINHA" | "BAR"
  >("COZINHA");
  const [newCategoryId, setNewCategoryId] = useState<number>(
    categories[0]?.id ?? 1,
  );

  const [ingName, setIngName] = useState("");
  const [ingUnit, setIngUnit] = useState<"KG" | "L" | "UN" | "G" | "ML">("KG");
  const [ingQty, setIngQty] = useState("10");
  const [ingMin, setIngMin] = useState("3");
  const [ingCost, setIngCost] = useState("25");
  const [ingSupplier, setIngSupplier] = useState("");

  const [movAmount, setMovAmount] = useState("50");
  const [movDesc, setMovDesc] = useState("");
  const [openedBy, setOpenedBy] = useState("Operador Caixa");
  const [openingAmount, setOpeningAmount] = useState("250");
  const [busy, setBusy] = useState(false);

  async function adjustIngredient(id: number, deltaQty: number) {
    const res = await fetch("/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "ingredient", id, deltaQty }),
    });
    if (!res.ok) {
      const j = await res.json();
      onError(j.error ?? "Erro ao ajustar estoque.");
      return;
    }
    await onRefresh();
  }

  async function createIngredient(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "ingredient",
          name: ingName,
          unit: ingUnit,
          currentQty: Number(ingQty) || 0,
          minQty: Number(ingMin) || 1,
          costPerUnit: Number(ingCost) || 0,
          supplierName: ingSupplier,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        onError(j.error ?? "Erro ao cadastrar insumo.");
        return;
      }
      setIngName("");
      setIngSupplier("");
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleProductAvailability(product: ProductDto) {
    const res = await fetch("/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "product",
        id: product.id,
        isAvailable: !product.isAvailable,
      }),
    });
    if (!res.ok) {
      const j = await res.json();
      onError(j.error ?? "Erro ao atualizar produto.");
      return;
    }
    await onRefresh();
  }

  async function adjustProductQuick(
    product: ProductDto,
    patch: { price?: number; stockQty?: number },
  ) {
    const res = await fetch("/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "product",
        id: product.id,
        ...patch,
      }),
    });
    if (!res.ok) {
      const j = await res.json();
      onError(j.error ?? "Erro ao ajustar produto.");
      return;
    }
    await onRefresh();
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: newDesc,
          price: Number(newPrice) || 10,
          unit: newUnit,
          prepStation: newStation,
          categoryId: Number(newCategoryId),
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        onError(j.error ?? "Erro ao criar produto.");
        return;
      }
      setNewName("");
      setNewDesc("");
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function cashAction(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json();
        onError(j.error ?? "Erro na operação de caixa.");
        return;
      }
      setMovDesc("");
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="grid gap-6 xl:grid-cols-12">
        {/* Insumos / Estoque */}
        <section className="card-bistro p-5 xl:col-span-7">
          <div className="mb-4 flex items-center gap-2">
            <Boxes className="h-5 w-5 text-[#d95d24]" />
            <div>
              <h2 className="font-display text-lg font-bold text-[#121417]">
                Estoque de Insumos & Fichas Técnicas
              </h2>
              <p className="text-xs text-[#5a5f67]">
                Baixa automática pelas vendas ligadas às receitas; cadastre e
                reponha insumos em 1 clique.
              </p>
            </div>
          </div>

          <form
            onSubmit={createIngredient}
            className="mb-4 grid gap-2 rounded-xl border border-[#eeeeea] bg-[#f6f6f3] p-3 sm:grid-cols-6"
          >
            <input
              type="text"
              required
              value={ingName}
              onChange={(e) => setIngName(e.target.value)}
              placeholder="Novo insumo (ex: Morango)"
              className="rounded-lg border border-[#e5e4df] bg-white px-2.5 py-1.5 text-xs sm:col-span-2"
            />
            <select
              value={ingUnit}
              onChange={(e) => setIngUnit(e.target.value as typeof ingUnit)}
              className="rounded-lg border border-[#e5e4df] bg-white px-2 py-1.5 text-xs"
            >
              <option value="KG">KG</option>
              <option value="L">L</option>
              <option value="UN">UN</option>
              <option value="G">G</option>
              <option value="ML">ML</option>
            </select>
            <input
              type="number"
              min="0"
              step="0.5"
              value={ingQty}
              onChange={(e) => setIngQty(e.target.value)}
              placeholder="Qtd"
              className="rounded-lg border border-[#e5e4df] bg-white px-2.5 py-1.5 text-xs"
            />
            <input
              type="number"
              min="0"
              step="0.5"
              value={ingMin}
              onChange={(e) => setIngMin(e.target.value)}
              placeholder="Mínimo"
              className="rounded-lg border border-[#e5e4df] bg-white px-2.5 py-1.5 text-xs"
            />
            <button
              type="submit"
              disabled={busy}
              className="btn-primary flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" /> Insumo
            </button>
            <input
              type="number"
              min="0"
              step="0.5"
              value={ingCost}
              onChange={(e) => setIngCost(e.target.value)}
              placeholder="Custo unit. R$"
              className="rounded-lg border border-[#e5e4df] bg-white px-2.5 py-1.5 text-xs sm:col-span-2"
            />
            <input
              type="text"
              value={ingSupplier}
              onChange={(e) => setIngSupplier(e.target.value)}
              placeholder="Fornecedor (opcional)"
              className="rounded-lg border border-[#e5e4df] bg-white px-2.5 py-1.5 text-xs sm:col-span-4"
            />
          </form>

          <div className="space-y-2.5">
            {ingredients.map((ing) => {
              const isLow = ing.currentQty <= ing.minQty;
              const pct = Math.min(
                100,
                Math.round((ing.currentQty / Math.max(1, ing.minQty * 2)) * 100),
              );
              return (
                <div
                  key={ing.id}
                  className={`rounded-xl border p-3 ${
                    isLow
                      ? "border-red-200 bg-red-50/50"
                      : "border-[#eeeeea] bg-[#f6f6f3]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#121417]">
                          {ing.name}
                        </span>
                        {isLow && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
                            <AlertTriangle className="h-3 w-3" /> Repor
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#5a5f67]">
                        Atual:{" "}
                        <span className="font-mono-num font-bold text-[#121417]">
                          {ing.currentQty} {ing.unit}
                        </span>{" "}
                        · Mínimo: {ing.minQty} {ing.unit} · Custo:{" "}
                        {formatBRL(ing.costPerUnit)}/{ing.unit}
                        {ing.supplierName ? ` · Forn: ${ing.supplierName}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => adjustIngredient(ing.id, -1)}
                        className="rounded-lg border border-[#e5e4df] bg-white px-2.5 py-1 text-xs font-bold hover:bg-[#eeeeea]"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustIngredient(ing.id, 5)}
                        className="rounded-lg bg-[#15803d] px-2.5 py-1 text-xs font-bold text-white hover:bg-[#22523d]"
                      >
                        +5 {ing.unit}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isLow ? "bg-red-500" : "bg-[#15803d]"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Caixa */}
        <section className="card-bistro p-5 xl:col-span-5">
          <div className="mb-4 flex items-center gap-2">
            <Banknote className="h-5 w-5 text-[#15803d]" />
            <div>
              <h2 className="font-display text-lg font-bold text-[#121417]">
                Frente de Caixa (Turnos)
              </h2>
              <p className="text-xs text-[#5a5f67]">
                Controle de abertura, sangria, suprimento e fechamento do dia.
              </p>
            </div>
          </div>

          {!openCashSession ? (
            <div className="space-y-3 rounded-xl border border-dashed border-[#e5e4df] bg-[#f6f6f3] p-4">
              <p className="text-xs font-semibold text-[#121417]">
                Nenhum turno de caixa aberto.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={openedBy}
                  onChange={(e) => setOpenedBy(e.target.value)}
                  placeholder="Operador"
                  className="rounded-xl border border-[#e5e4df] bg-white px-3 py-2 text-xs"
                />
                <input
                  type="number"
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  placeholder="Troco inicial R$"
                  className="rounded-xl border border-[#e5e4df] bg-white px-3 py-2 text-xs"
                />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  cashAction({
                    action: "OPEN",
                    openedBy,
                    openingAmount: Number(openingAmount) || 0,
                  })
                }
                className="w-full rounded-xl bg-[#15803d] py-2.5 text-xs font-semibold text-white hover:bg-[#22523d]"
              >
                Abrir Turno de Caixa
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5 rounded-xl bg-[#f6f6f3] p-3.5 text-xs">
                <div>
                  <span className="text-[#5a5f67]">Operador</span>
                  <p className="font-bold text-[#121417]">
                    {openCashSession.openedBy}
                  </p>
                </div>
                <div>
                  <span className="text-[#5a5f67]">
                    Saldo Esperado (Dinheiro)
                  </span>
                  <p className="font-mono-num text-base font-bold text-[#15803d]">
                    {formatBRL(openCashSession.expectedAmount)}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="number"
                  min="1"
                  value={movAmount}
                  onChange={(e) => setMovAmount(e.target.value)}
                  placeholder="Valor R$"
                  className="rounded-xl border border-[#e5e4df] bg-[#f6f6f3] px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  value={movDesc}
                  onChange={(e) => setMovDesc(e.target.value)}
                  placeholder="Motivo (ex: Pag. gelo)"
                  className="rounded-xl border border-[#e5e4df] bg-[#f6f6f3] px-3 py-2 text-xs"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    cashAction({
                      action: "MOVEMENT",
                      movementType: "SUPRIMENTO",
                      amount: Number(movAmount) || 0,
                      description: movDesc,
                    })
                  }
                  className="flex-1 rounded-xl bg-[#15803d] px-3 py-2 text-xs font-semibold text-white hover:bg-[#22523d]"
                >
                  + Suprimento
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    cashAction({
                      action: "MOVEMENT",
                      movementType: "SANGRIA",
                      amount: Number(movAmount) || 0,
                      description: movDesc,
                    })
                  }
                  className="flex-1 rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  - Sangria
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => cashAction({ action: "CLOSE" })}
                  className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100"
                >
                  Fechar Caixa
                </button>
              </div>

              <div className="max-h-64 space-y-1.5 overflow-y-auto border-t border-[#eeeeea] pt-3">
                {openCashSession.movements.map((mov) => (
                  <div
                    key={mov.id}
                    className="flex items-center justify-between rounded-lg bg-[#f6f6f3] px-3 py-1.5 text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#121417]">
                        {mov.type}
                      </span>
                      <span className="ml-2 text-[#5a5f67]">
                        {mov.description}
                      </span>
                    </div>
                    <span
                      className={`font-mono-num font-bold ${
                        mov.type === "SANGRIA"
                          ? "text-red-700"
                          : "text-[#15803d]"
                      }`}
                    >
                      {mov.type === "SANGRIA" ? "-" : "+"}{" "}
                      {formatBRL(mov.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Cardápio / Cadastro rápido */}
      <section className="card-bistro p-5">
        <div className="mb-4 flex items-center gap-2">
          <Utensils className="h-5 w-5 text-[#d95d24]" />
          <div>
            <h2 className="font-display text-lg font-bold text-[#121417]">
              Catálogo Unificado de Produtos & Fichas Técnicas
            </h2>
            <p className="text-xs text-[#5a5f67]">
              Cadastre novos itens, pause disponibilidade em tempo real e
              acompanhe os insumos ligados a cada receita.
            </p>
          </div>
        </div>

        <form onSubmit={createProduct} className="mb-5 grid gap-2.5 sm:grid-cols-6">
          <input
            type="text"
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome do produto"
            className="rounded-xl border border-[#e5e4df] bg-[#f6f6f3] px-3 py-2 text-xs sm:col-span-2"
          />
          <input
            type="text"
            required
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Descrição curta"
            className="rounded-xl border border-[#e5e4df] bg-[#f6f6f3] px-3 py-2 text-xs sm:col-span-2"
          />
          <input
            type="number"
            step="0.5"
            min="0.5"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder="Preço"
            className="rounded-xl border border-[#e5e4df] bg-[#f6f6f3] px-3 py-2 text-xs"
          />
          <select
            value={newCategoryId}
            onChange={(e) => setNewCategoryId(Number(e.target.value))}
            className="rounded-xl border border-[#e5e4df] bg-[#f6f6f3] px-3 py-2 text-xs"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value as typeof newUnit)}
            className="rounded-xl border border-[#e5e4df] bg-[#f6f6f3] px-3 py-2 text-xs"
          >
            <option value="UN">Unidade (UN)</option>
            <option value="KG">Quilo (KG)</option>
            <option value="FATIA">Fatia</option>
            <option value="PORCAO">Porção</option>
          </select>
          <select
            value={newStation}
            onChange={(e) => setNewStation(e.target.value as typeof newStation)}
            className="rounded-xl border border-[#e5e4df] bg-[#f6f6f3] px-3 py-2 text-xs"
          >
            <option value="COZINHA">Estação: Cozinha</option>
            <option value="FORNO">Estação: Forno</option>
            <option value="CONFEITARIA">Estação: Confeitaria</option>
            <option value="BAR">Estação: Bar / Café</option>
            <option value="BALCAO">Estação: Balcão</option>
          </select>
          <button
            type="submit"
            disabled={busy}
            className="btn-primary flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold sm:col-span-2"
          >
            <Plus className="h-4 w-4" /> Adicionar ao Cardápio
          </button>
        </form>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex flex-col justify-between gap-2 rounded-xl border border-[#eeeeea] bg-[#f6f6f3] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-[#121417]">
                    {product.name}
                  </p>
                  <p className="font-mono-num text-[11px] text-[#5a5f67]">
                    {formatBRL(product.price)}/{product.unit} · {product.prepStation}{" "}
                    · Estq: {product.stockQty}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleProductAvailability(product)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    product.isAvailable
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-stone-200 text-stone-700"
                  }`}
                >
                  {product.isAvailable ? "Ativo" : "Pausado"}
                </button>
              </div>
              {product.recipeItems && product.recipeItems.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {product.recipeItems.map((ri) => (
                    <span
                      key={ri.id}
                      className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#5a5f67]"
                    >
                      {ri.ingredient.name}: {ri.qtyRequired}
                      {ri.ingredient.unit}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-1 border-t border-[#e5e4df]/70 pt-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      adjustProductQuick(product, {
                        price: Math.max(1, Number((product.price - 1).toFixed(2))),
                      })
                    }
                    className="rounded-md border border-[#e5e4df] bg-white px-2 py-0.5 text-[10px] font-bold text-[#5a5f67] hover:bg-[#eeeeea]"
                  >
                    -R$1
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      adjustProductQuick(product, {
                        price: Number((product.price + 1).toFixed(2)),
                      })
                    }
                    className="rounded-md border border-[#e5e4df] bg-white px-2 py-0.5 text-[10px] font-bold text-[#5a5f67] hover:bg-[#eeeeea]"
                  >
                    +R$1
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    adjustProductQuick(product, {
                      stockQty: Number((product.stockQty + 5).toFixed(2)),
                    })
                  }
                  className="rounded-md bg-[#15803d] px-2 py-0.5 text-[10px] font-bold text-white hover:bg-[#22523d]"
                >
                  +5 Estq
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
