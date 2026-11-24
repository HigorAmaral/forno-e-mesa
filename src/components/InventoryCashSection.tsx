"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  BookOpen,
  Boxes,
  Download,
  ImagePlus,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import {
  calculateMarginPercentage,
  calculateProductRecipeCost,
  formatBRL,
} from "@/lib/domain";
import type {
  CashSessionDto,
  CategoryDto,
  IngredientDto,
  ProductDto,
  StaffRole,
} from "@/types/erp";
import { compressImageFileToDataUrl, ProductPhoto } from "./ProductPhoto";

interface InventoryCashSectionProps {
  categories: CategoryDto[];
  products: ProductDto[];
  ingredients: IngredientDto[];
  openCashSession: CashSessionDto | null;
  operatorRole?: StaffRole;
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
}

export function InventoryCashSection({
  categories,
  products,
  ingredients,
  openCashSession,
  operatorRole = "ADMIN",
  onRefresh,
  onError,
}: InventoryCashSectionProps) {
  const canManageCatalog = operatorRole === "ADMIN" || operatorRole === "GERENTE";

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newPrice, setNewPrice] = useState("18");
  const [newPrepTime, setNewPrepTime] = useState("8");
  const [newFeatured, setNewFeatured] = useState(false);
  const [newUnit, setNewUnit] = useState<"UN" | "KG" | "FATIA" | "PORCAO">("UN");
  const [newStation, setNewStation] = useState<
    "BALCAO" | "FORNO" | "CONFEITARIA" | "COZINHA" | "BAR"
  >("COZINHA");
  const [newCategoryId, setNewCategoryId] = useState<number>(
    categories[0]?.id ?? 1,
  );
  const [productSearch, setProductSearch] = useState("");
  const [productCatFilter, setProductCatFilter] = useState<number | "ALL">("ALL");

  const [showNewCat, setShowNewCat] = useState(false);
  const [catName, setCatName] = useState("");
  const [catSector, setCatSector] = useState<
    "PADARIA" | "CONFEITARIA" | "RESTAURANTE" | "BEBIDAS"
  >("PADARIA");

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

  // Edit Product Modal
  const [editingProduct, setEditingProduct] = useState<ProductDto | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    imageUrl: "",
    price: "",
    unit: "UN",
    prepStation: "COZINHA",
    prepTimeMinutes: "5",
    categoryId: 1,
    stockQty: "0",
    minStockQty: "5",
    isFeatured: false,
    isAvailable: true,
  });

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCat = productCatFilter === "ALL" || p.categoryId === productCatFilter;
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [products, productSearch, productCatFilter]);

  async function handlePhotoUpload(
    file: File | undefined,
    onResult: (dataUrl: string) => void,
  ) {
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      onResult(dataUrl);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Erro ao processar foto.");
    }
  }

  // Recipe Modal
  const [recipeProduct, setRecipeProduct] = useState<ProductDto | null>(null);
  const [recipeDraft, setRecipeDraft] = useState<
    Array<{ ingredientId: number; qtyRequired: number }>
  >([]);

  useEffect(() => {
    if (!editingProduct && !recipeProduct) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setEditingProduct(null);
        setRecipeProduct(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingProduct, recipeProduct]);

  function openEditProduct(p: ProductDto) {
    setEditingProduct(p);
    setEditForm({
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl ?? "",
      price: String(p.price),
      unit: p.unit,
      prepStation: p.prepStation,
      prepTimeMinutes: String(p.prepTimeMinutes),
      categoryId: p.categoryId,
      stockQty: String(p.stockQty),
      minStockQty: String(p.minStockQty),
      isFeatured: p.isFeatured,
      isAvailable: p.isAvailable,
    });
  }

  function openRecipeEditor(p: ProductDto) {
    setRecipeProduct(p);
    setRecipeDraft(
      (p.recipeItems ?? []).map((ri) => ({
        ingredientId: ri.ingredientId,
        qtyRequired: ri.qtyRequired,
      })),
    );
  }

  const recipeCostPreview = useMemo(() => {
    const ingMap = new Map(ingredients.map((i) => [i.id, i]));
    return calculateProductRecipeCost(
      recipeDraft.map((r) => ({
        qtyRequired: r.qtyRequired,
        costPerUnit: ingMap.get(r.ingredientId)?.costPerUnit ?? 0,
      })),
    );
  }, [recipeDraft, ingredients]);

  async function saveEditProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProduct || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "product",
          id: editingProduct.id,
          name: editForm.name.trim(),
          description: editForm.description.trim(),
          imageUrl: editForm.imageUrl.trim() || null,
          price: Number(editForm.price) || editingProduct.price,
          unit: editForm.unit,
          prepStation: editForm.prepStation,
          prepTimeMinutes: Number(editForm.prepTimeMinutes) || 5,
          categoryId: Number(editForm.categoryId),
          stockQty: Number(editForm.stockQty) || 0,
          minStockQty: Number(editForm.minStockQty) || 0,
          isFeatured: editForm.isFeatured,
          isAvailable: editForm.isAvailable,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        onError(j.error ?? "Erro ao editar produto.");
        return;
      }
      setEditingProduct(null);
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveRecipe(e: React.FormEvent) {
    e.preventDefault();
    if (!recipeProduct || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "recipe",
          productId: recipeProduct.id,
          items: recipeDraft.filter((r) => r.qtyRequired > 0),
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        onError(j.error ?? "Erro ao salvar ficha técnica.");
        return;
      }
      setRecipeProduct(null);
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!catName.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "category",
          name: catName.trim(),
          sector: catSector,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        onError(j.error ?? "Erro ao criar categoria.");
        return;
      }
      setCatName("");
      setShowNewCat(false);
      if (j.category?.id) setNewCategoryId(j.category.id);
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

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

  async function deleteEntity(kind: "product" | "ingredient", id: number) {
    const res = await fetch(`/api/inventory?kind=${kind}&id=${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const j = await res.json();
      onError(j.error ?? "Erro ao remover item.");
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
          imageUrl: newImageUrl.trim() || null,
          price: Number(newPrice) || 10,
          prepTimeMinutes: Math.max(1, Number(newPrepTime) || 8),
          isFeatured: newFeatured,
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
      setNewImageUrl("");
      setNewFeatured(false);
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-[var(--accent-primary)]" />
              <div>
                <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                  Estoque de Insumos & Fichas Técnicas
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Baixa automática pelas vendas ligadas às receitas; cadastre e reponha em 1 clique.
                </p>
              </div>
            </div>
            <a
              href="/api/reports/export?scope=inventory"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              CSV Estoque
            </a>
          </div>

          <form
            onSubmit={createIngredient}
            className="mb-4 grid gap-2 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3 sm:grid-cols-6"
          >
            <input
              type="text"
              required
              value={ingName}
              onChange={(e) => setIngName(e.target.value)}
              placeholder="Novo insumo (ex: Morango)"
              className="input-field py-1.5 text-xs sm:col-span-2"
            />
            <select
              value={ingUnit}
              onChange={(e) => setIngUnit(e.target.value as typeof ingUnit)}
              className="input-field py-1.5 text-xs"
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
              className="input-field py-1.5 text-xs"
            />
            <input
              type="number"
              min="0"
              step="0.5"
              value={ingMin}
              onChange={(e) => setIngMin(e.target.value)}
              placeholder="Mínimo"
              className="input-field py-1.5 text-xs"
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
              className="input-field py-1.5 text-xs sm:col-span-2"
            />
            <input
              type="text"
              value={ingSupplier}
              onChange={(e) => setIngSupplier(e.target.value)}
              placeholder="Fornecedor (opcional)"
              className="input-field py-1.5 text-xs sm:col-span-4"
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
                      ? "border-red-300 bg-red-50/40"
                      : "border-[var(--border-warm)] bg-[var(--bg-canvas)]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[var(--text-primary)]">
                          {ing.name}
                        </span>
                        {isLow && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
                            <AlertTriangle className="h-3 w-3" /> Repor
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Atual:{" "}
                        <span className="font-mono-num font-bold text-[var(--text-primary)]">
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
                        className="icon-btn px-2.5 py-1 text-xs font-bold"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustIngredient(ing.id, 5)}
                        className="rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-800"
                      >
                        +5 {ing.unit}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteEntity("ingredient", ing.id)}
                        className="icon-btn p-1 text-red-700"
                        title="Remover insumo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isLow ? "bg-red-500" : "bg-emerald-600"
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
            <Banknote className="h-5 w-5 text-emerald-600" />
            <div>
              <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                Frente de Caixa (Turnos)
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Controle de abertura, sangria, suprimento e fechamento do dia.
              </p>
            </div>
          </div>

          {!openCashSession ? (
            <div className="space-y-3 rounded-xl border border-dashed border-[var(--border-warm)] bg-[var(--bg-canvas)] p-4">
              <p className="text-xs font-semibold text-[var(--text-primary)]">
                Nenhum turno de caixa aberto.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={openedBy}
                  onChange={(e) => setOpenedBy(e.target.value)}
                  placeholder="Operador"
                  className="input-field py-2 text-xs"
                />
                <input
                  type="number"
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  placeholder="Troco inicial R$"
                  className="input-field py-2 text-xs"
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
                className="w-full rounded-xl bg-emerald-700 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                Abrir Turno de Caixa
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5 rounded-xl bg-[var(--bg-canvas)] p-3.5 text-xs">
                <div>
                  <span className="text-[var(--text-secondary)]">Operador</span>
                  <p className="font-bold text-[var(--text-primary)]">
                    {openCashSession.openedBy}
                  </p>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)]">
                    Saldo Esperado (Dinheiro)
                  </span>
                  <p className="font-mono-num text-base font-bold text-emerald-600">
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
                  className="input-field py-2 text-xs"
                />
                <input
                  type="text"
                  value={movDesc}
                  onChange={(e) => setMovDesc(e.target.value)}
                  placeholder="Motivo (ex: Pag. gelo)"
                  className="input-field py-2 text-xs"
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
                  className="flex-1 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
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

              <div className="max-h-64 space-y-1.5 overflow-y-auto border-t border-[var(--border-warm)] pt-3">
                {openCashSession.movements.map((mov) => (
                  <div
                    key={mov.id}
                    className="flex items-center justify-between rounded-lg bg-[var(--bg-canvas)] px-3 py-1.5 text-xs"
                  >
                    <div>
                      <span className="font-bold text-[var(--text-primary)]">
                        {mov.type}
                      </span>
                      <span className="ml-2 text-[var(--text-secondary)]">
                        {mov.description}
                      </span>
                    </div>
                    <span
                      className={`font-mono-num font-bold ${
                        mov.type === "SANGRIA"
                          ? "text-red-700"
                          : "text-emerald-600"
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-[var(--accent-primary)]" />
            <div>
              <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                Catálogo Unificado de Produtos & Fichas Técnicas
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Edite produtos, configure fichas técnicas com CMV automático e gerencie categorias.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowNewCat((v) => !v)}
            className="rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
          >
            {showNewCat ? "Fechar Categoria" : "+ Nova Categoria"}
          </button>
        </div>

        {showNewCat && (
          <form
            onSubmit={createCategory}
            className="mb-4 grid gap-2 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3 sm:grid-cols-4"
          >
            <input
              type="text"
              required
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Nome da categoria (ex: Salgados)"
              className="input-field py-2 text-xs sm:col-span-2"
            />
            <select
              value={catSector}
              onChange={(e) => setCatSector(e.target.value as typeof catSector)}
              className="input-field py-2 text-xs"
            >
              <option value="PADARIA">Padaria</option>
              <option value="CONFEITARIA">Confeitaria</option>
              <option value="RESTAURANTE">Restaurante</option>
              <option value="BEBIDAS">Bebidas</option>
            </select>
            <button type="submit" disabled={busy} className="btn-primary rounded-xl py-2 text-xs font-bold">
              Criar Categoria
            </button>
          </form>
        )}

        {canManageCatalog && (
          <form
            onSubmit={createProduct}
            className="mb-5 space-y-3 rounded-2xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Adicionar Novo Produto (Admin / Gerente)
              </p>
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={newFeatured}
                  onChange={(e) => setNewFeatured(e.target.checked)}
                />
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                Destaque no cardápio
              </label>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-6">
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome do produto"
                className="input-field py-2 text-xs sm:col-span-2"
              />
              <input
                type="text"
                required
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Descrição completa para os clientes"
                className="input-field py-2 text-xs sm:col-span-3"
              />
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="Preço (R$)"
                className="input-field py-2 text-xs"
              />
              <select
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(Number(e.target.value))}
                className="input-field py-2 text-xs"
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
                className="input-field py-2 text-xs"
              >
                <option value="UN">Unidade (UN)</option>
                <option value="KG">Quilo (KG)</option>
                <option value="FATIA">Fatia</option>
                <option value="PORCAO">Porção</option>
              </select>
              <select
                value={newStation}
                onChange={(e) => setNewStation(e.target.value as typeof newStation)}
                className="input-field py-2 text-xs"
              >
                <option value="COZINHA">Estação: Cozinha</option>
                <option value="FORNO">Estação: Forno</option>
                <option value="CONFEITARIA">Estação: Confeitaria</option>
                <option value="BAR">Estação: Bar / Café</option>
                <option value="BALCAO">Estação: Balcão</option>
              </select>
              <input
                type="number"
                min="1"
                value={newPrepTime}
                onChange={(e) => setNewPrepTime(e.target.value)}
                placeholder="Preparo (min)"
                title="Tempo estimado de preparo em minutos"
                className="input-field py-2 text-xs"
              />
              <button
                type="submit"
                disabled={busy}
                className="btn-primary flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold sm:col-span-2"
              >
                <Plus className="h-4 w-4" /> Adicionar ao Cardápio
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-warm)] pt-3">
              <ProductPhoto
                imageUrl={newImageUrl}
                name={newName || "Preview"}
                sector={categories.find((c) => c.id === newCategoryId)?.sector}
                size="sm"
              />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)]">
                  <ImagePlus className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                  Enviar foto
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      void handlePhotoUpload(file, setNewImageUrl);
                      e.target.value = "";
                    }}
                  />
                </label>
                <input
                  type="text"
                  value={newImageUrl.startsWith("data:") ? "" : newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="Ou cole o link (https://...) da foto do produto"
                  className="input-field min-w-[200px] flex-1 py-1.5 text-xs"
                />
                {newImageUrl && (
                  <button
                    type="button"
                    onClick={() => setNewImageUrl("")}
                    className="text-xs font-semibold text-red-700 hover:underline"
                  >
                    Remover foto
                  </button>
                )}
              </div>
            </div>
          </form>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Buscar produto por nome, descrição ou SKU..."
              className="input-field py-2 pl-9 text-xs"
            />
          </div>
          <select
            value={productCatFilter}
            onChange={(e) =>
              setProductCatFilter(
                e.target.value === "ALL" ? "ALL" : Number(e.target.value),
              )
            }
            className="input-field w-auto py-2 text-xs font-semibold"
          >
            <option value="ALL">Todas categorias ({products.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="flex flex-col justify-between gap-2 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3"
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex min-w-0 items-start gap-2.5">
                  <ProductPhoto
                    imageUrl={product.imageUrl}
                    name={product.name}
                    sector={product.category.sector}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[var(--text-primary)]">
                      {product.name}
                    </p>
                    <p className="line-clamp-2 text-[11px] text-[var(--text-secondary)]">
                      {product.description}
                    </p>
                    <p className="font-mono-num mt-0.5 text-[11px] font-semibold text-[var(--accent-primary)]">
                      {formatBRL(product.price)}/{product.unit} · {product.prepStation}{" "}
                      · Estq: {product.stockQty}
                    </p>
                  </div>
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
                      className="rounded-md bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]"
                    >
                      {ri.ingredient.name}: {ri.qtyRequired}
                      {ri.ingredient.unit}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-1 border-t border-[var(--border-warm)] pt-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      adjustProductQuick(product, {
                        price: Math.max(1, Number((product.price - 1).toFixed(2))),
                      })
                    }
                    className="icon-btn px-2 py-0.5 text-[10px] font-bold"
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
                    className="icon-btn px-2 py-0.5 text-[10px] font-bold"
                  >
                    +R$1
                  </button>
                  {canManageCatalog && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditProduct(product)}
                        className="icon-btn inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold"
                        title="Editar produto (nome, descrição, foto, preço)"
                      >
                        <Pencil className="h-3 w-3" /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => openRecipeEditor(product)}
                        className="icon-btn p-1"
                        title="Ficha Técnica / Receita"
                      >
                        <BookOpen className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteEntity("product", product.id)}
                        className="icon-btn p-1 text-red-700"
                        title="Excluir produto"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    adjustProductQuick(product, {
                      stockQty: Number((product.stockQty + 5).toFixed(2)),
                    })
                  }
                  className="rounded-md bg-emerald-700 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-800"
                >
                  +5 Estq
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Edit Product Modal */}
      {editingProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label={`Editar ${editingProduct.name}`}
          onClick={() => setEditingProduct(null)}
        >
          <form
            onSubmit={saveEditProduct}
            onClick={(e) => e.stopPropagation()}
            className="card-bistro animate-scale-in max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">
                Editar Produto · {editingProduct.sku}
              </h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="icon-btn"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3 sm:col-span-2">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Foto do Produto
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <ProductPhoto
                    imageUrl={editForm.imageUrl}
                    name={editForm.name || editingProduct.name}
                    sector={
                      categories.find((c) => c.id === Number(editForm.categoryId))
                        ?.sector ?? editingProduct.category.sector
                    }
                    size="md"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)]">
                        <ImagePlus className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                        Enviar nova foto
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            void handlePhotoUpload(file, (url) =>
                              setEditForm((f) => ({ ...f, imageUrl: url })),
                            );
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {editForm.imageUrl && (
                        <button
                          type="button"
                          onClick={() => setEditForm((f) => ({ ...f, imageUrl: "" }))}
                          className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100"
                        >
                          Remover foto
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={editForm.imageUrl.startsWith("data:") ? "" : editForm.imageUrl}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, imageUrl: e.target.value }))
                      }
                      placeholder={
                        editForm.imageUrl.startsWith("data:")
                          ? "Foto enviada do aparelho (cole uma URL para substituir)"
                          : "Ou cole o link da foto (https://...)"
                      }
                      className="input-field py-1.5 text-xs"
                    />
                  </div>
                </div>
              </div>

              <label className="field-label sm:col-span-2">
                Nome
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="input-field"
                />
              </label>
              <label className="field-label sm:col-span-2">
                Descrição
                <textarea
                  rows={2}
                  required
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="input-field resize-none"
                />
              </label>
              <label className="field-label">
                Preço (R$)
                <input
                  type="number"
                  step="0.5"
                  value={editForm.price}
                  onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                  className="input-field font-mono-num"
                />
              </label>
              <label className="field-label">
                Categoria
                <select
                  value={editForm.categoryId}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, categoryId: Number(e.target.value) }))
                  }
                  className="input-field"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Unidade
                <select
                  value={editForm.unit}
                  onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
                  className="input-field"
                >
                  <option value="UN">UN</option>
                  <option value="KG">KG</option>
                  <option value="FATIA">FATIA</option>
                  <option value="PORCAO">PORCAO</option>
                </select>
              </label>
              <label className="field-label">
                Estação KDS
                <select
                  value={editForm.prepStation}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, prepStation: e.target.value }))
                  }
                  className="input-field"
                >
                  <option value="COZINHA">Cozinha</option>
                  <option value="FORNO">Forno</option>
                  <option value="CONFEITARIA">Confeitaria</option>
                  <option value="BAR">Bar</option>
                  <option value="BALCAO">Balcão</option>
                </select>
              </label>
              <label className="field-label">
                Estoque Atual
                <input
                  type="number"
                  step="0.5"
                  value={editForm.stockQty}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, stockQty: e.target.value }))
                  }
                  className="input-field font-mono-num"
                />
              </label>
              <label className="field-label">
                Tempo Preparo (min)
                <input
                  type="number"
                  min="1"
                  value={editForm.prepTimeMinutes}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, prepTimeMinutes: e.target.value }))
                  }
                  className="input-field font-mono-num"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-4 pt-1 text-xs font-semibold">
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={editForm.isFeatured}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, isFeatured: e.target.checked }))
                  }
                />
                Destaque no Cardápio
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={editForm.isAvailable}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, isAvailable: e.target.checked }))
                  }
                />
                Disponível para venda
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="rounded-xl border border-[var(--border-warm)] px-4 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button type="submit" disabled={busy} className="btn-primary rounded-xl px-5 py-2 text-xs font-bold">
                Salvar Produto
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Recipe / Ficha Técnica Modal */}
      {recipeProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label={`Ficha técnica ${recipeProduct.name}`}
          onClick={() => setRecipeProduct(null)}
        >
          <form
            onSubmit={saveRecipe}
            onClick={(e) => e.stopPropagation()}
            className="card-bistro animate-scale-in max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold">
                  Ficha Técnica · {recipeProduct.name}
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Venda: {formatBRL(recipeProduct.price)} · CMV:{" "}
                  <strong className="font-mono-num">{formatBRL(recipeCostPreview)}</strong>{" "}
                  · Margem:{" "}
                  <strong className="font-mono-num text-emerald-600">
                    {calculateMarginPercentage(recipeProduct.price, recipeCostPreview)}%
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRecipeProduct(null)}
                className="icon-btn"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {recipeDraft.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={row.ingredientId}
                    onChange={(e) =>
                      setRecipeDraft((prev) =>
                        prev.map((r, i) =>
                          i === idx ? { ...r, ingredientId: Number(e.target.value) } : r,
                        ),
                      )
                    }
                    className="input-field flex-1 py-1.5 text-xs"
                  >
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.unit} · {formatBRL(ing.costPerUnit)})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0.001"
                    value={row.qtyRequired}
                    onChange={(e) =>
                      setRecipeDraft((prev) =>
                        prev.map((r, i) =>
                          i === idx
                            ? { ...r, qtyRequired: Number(e.target.value) || 0 }
                            : r,
                        ),
                      )
                    }
                    className="input-field font-mono-num w-24 py-1.5 text-right text-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setRecipeDraft((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="icon-btn p-1.5 text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  ingredients[0] &&
                  setRecipeDraft((prev) => [
                    ...prev,
                    { ingredientId: ingredients[0].id, qtyRequired: 0.1 },
                  ])
                }
                className="inline-flex items-center gap-1 text-xs font-bold text-[var(--accent-primary)] hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar insumo à receita
              </button>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--border-warm)] pt-3">
              <button
                type="button"
                onClick={() => setRecipeProduct(null)}
                className="rounded-xl border border-[var(--border-warm)] px-4 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button type="submit" disabled={busy} className="btn-primary rounded-xl px-5 py-2 text-xs font-bold">
                Salvar Ficha Técnica
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
