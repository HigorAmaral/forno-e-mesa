"use client";

import { useState } from "react";
import {
  CheckCircle2,
  History,
  KeyRound,
  Plus,
  Shield,
  Star,
  Store,
  Tag,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { formatBRL } from "@/lib/domain";
import { ALL_STAFF_ROLES, ROLE_BADGE_CLASSES, ROLE_LABELS } from "@/lib/rbac";
import type {
  AuditLogDto,
  OrderReviewDto,
  PromoCouponDto,
  StaffRole,
  StaffUserDto,
  StoreSettingsDto,
} from "@/types/erp";

interface SettingsTeamSectionProps {
  storeSettings: StoreSettingsDto;
  staffUsers: StaffUserDto[];
  coupons: PromoCouponDto[];
  reviews: OrderReviewDto[];
  auditLogs: AuditLogDto[];
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export function SettingsTeamSection({
  storeSettings,
  staffUsers,
  coupons,
  reviews,
  auditLogs,
  onRefresh,
  onError,
  onSuccess,
}: SettingsTeamSectionProps) {
  const [subTab, setSubTab] = useState<"store" | "team" | "coupons" | "audit">(
    "store",
  );
  const [busy, setBusy] = useState(false);

  // Store Settings State
  const [storeForm, setStoreForm] = useState({
    storeName: storeSettings.storeName,
    slogan: storeSettings.slogan,
    phone: storeSettings.phone,
    address: storeSettings.address,
    openingHours: storeSettings.openingHours,
    isDeliveryOpen: storeSettings.isDeliveryOpen,
    dailyGoal: String(storeSettings.dailyGoal),
    defaultServiceFeePct: String(storeSettings.defaultServiceFeePct),
    freeDeliveryAbove: String(storeSettings.freeDeliveryAbove),
    creditCardFeePct: String(storeSettings.creditCardFeePct),
    debitCardFeePct: String(storeSettings.debitCardFeePct),
  });

  // New Staff Form
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState<StaffRole>("CAIXA");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffPin, setStaffPin] = useState("");

  // New Coupon Form
  const [couponCode, setCouponCode] = useState("");
  const [couponLabel, setCouponLabel] = useState("");
  const [couponType, setCouponType] = useState<"PERCENT" | "FIXED" | "FREE_DELIVERY">("PERCENT");
  const [couponValue, setCouponValue] = useState("10");
  const [couponMaxDiscount, setCouponMaxDiscount] = useState("");
  const [couponMinOrder, setCouponMinOrder] = useState("0");

  async function saveStoreSettings(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName: storeForm.storeName.trim(),
          slogan: storeForm.slogan.trim(),
          phone: storeForm.phone.trim(),
          address: storeForm.address.trim(),
          openingHours: storeForm.openingHours.trim(),
          isDeliveryOpen: storeForm.isDeliveryOpen,
          dailyGoal: Number(storeForm.dailyGoal) || 2500,
          defaultServiceFeePct: Number(storeForm.defaultServiceFeePct) || 0,
          freeDeliveryAbove: Number(storeForm.freeDeliveryAbove) || 0,
          creditCardFeePct: Number(storeForm.creditCardFeePct) || 0,
          debitCardFeePct: Number(storeForm.debitCardFeePct) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onError(json.error ?? "Erro ao salvar configurações.");
        return;
      }
      onSuccess("Configurações da loja atualizadas!");
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function createStaffUser(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: staffName.trim(),
          email: staffEmail.trim(),
          role: staffRole,
          password: staffPassword,
          pin: staffPin.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onError(json.error ?? "Erro ao cadastrar colaborador.");
        return;
      }
      setStaffName("");
      setStaffEmail("");
      setStaffPassword("");
      setStaffPin("");
      onSuccess("Colaborador cadastrado com sucesso!");
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleStaffActive(user: StaffUserDto) {
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, isActive: !user.isActive }),
    });
    const json = await res.json();
    if (!res.ok) {
      onError(json.error ?? "Erro ao atualizar colaborador.");
      return;
    }
    await onRefresh();
  }

  async function updateStaffRole(user: StaffUserDto, role: StaffRole) {
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, role }),
    });
    const json = await res.json();
    if (!res.ok) {
      onError(json.error ?? "Erro ao alterar perfil.");
      return;
    }
    onSuccess(`Perfil de ${user.name} atualizado para ${ROLE_LABELS[role]}.`);
    await onRefresh();
  }

  async function removeStaffUser(user: StaffUserDto) {
    const res = await fetch(`/api/staff?id=${user.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      onError(json.error ?? "Erro ao remover colaborador.");
      return;
    }
    onSuccess("Colaborador removido.");
    await onRefresh();
  }

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode.trim().toUpperCase(),
          label: couponLabel.trim(),
          type: couponType,
          value: couponType === "FREE_DELIVERY" ? 0 : Number(couponValue) || 0,
          maxDiscount: couponMaxDiscount ? Number(couponMaxDiscount) : null,
          minOrder: Number(couponMinOrder) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onError(json.error ?? "Erro ao criar cupom.");
        return;
      }
      setCouponCode("");
      setCouponLabel("");
      setCouponValue("10");
      setCouponMaxDiscount("");
      setCouponMinOrder("0");
      onSuccess("Cupom promocional criado!");
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleCoupon(coupon: PromoCouponDto) {
    const res = await fetch("/api/coupons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: coupon.id, isActive: !coupon.isActive }),
    });
    if (!res.ok) {
      onError("Erro ao atualizar cupom.");
      return;
    }
    await onRefresh();
  }

  async function deleteCoupon(id: number) {
    const res = await fetch(`/api/coupons?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      onError("Erro ao remover cupom.");
      return;
    }
    await onRefresh();
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
            Equipe, Loja, Cupons & Auditoria
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Controle de permissões (RBAC), operação do delivery, cupons promocionais e trilha de auditoria.
          </p>
        </div>

        <div className="segmented">
          <button
            type="button"
            data-active={subTab === "store"}
            onClick={() => setSubTab("store")}
          >
            <span className="inline-flex items-center gap-1.5">
              <Store className="h-3.5 w-3.5" /> Loja & Taxas
            </span>
          </button>
          <button
            type="button"
            data-active={subTab === "team"}
            onClick={() => setSubTab("team")}
          >
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Equipe ({staffUsers.length})
            </span>
          </button>
          <button
            type="button"
            data-active={subTab === "coupons"}
            onClick={() => setSubTab("coupons")}
          >
            <span className="inline-flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" /> Cupons ({coupons.length})
            </span>
          </button>
          <button
            type="button"
            data-active={subTab === "audit"}
            onClick={() => setSubTab("audit")}
          >
            <span className="inline-flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" /> Auditoria & Avaliações
            </span>
          </button>
        </div>
      </div>

      {subTab === "store" && (
        <form onSubmit={saveStoreSettings} className="card-bistro space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-warm)] pb-4">
            <div>
              <h3 className="font-display text-lg font-bold">
                Dados Gerais & Funcionamento do Delivery
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Refletidos em tempo real no painel, DRE, vitrine /delivery e cupons.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] px-3.5 py-2 text-xs font-bold">
              <input
                type="checkbox"
                checked={storeForm.isDeliveryOpen}
                onChange={(e) =>
                  setStoreForm((f) => ({ ...f, isDeliveryOpen: e.target.checked }))
                }
                className="h-4 w-4 accent-[#C07F5A]"
              />
              {storeForm.isDeliveryOpen
                ? "Delivery & Retirada ABERTOS"
                : "Delivery PAUSADO"}
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="field-label">
              Nome da Casa
              <input
                type="text"
                required
                value={storeForm.storeName}
                onChange={(e) =>
                  setStoreForm((f) => ({ ...f, storeName: e.target.value }))
                }
                className="input-field"
              />
            </label>
            <label className="field-label">
              Slogan
              <input
                type="text"
                required
                value={storeForm.slogan}
                onChange={(e) =>
                  setStoreForm((f) => ({ ...f, slogan: e.target.value }))
                }
                className="input-field"
              />
            </label>
            <label className="field-label">
              WhatsApp / Telefone
              <input
                type="text"
                required
                value={storeForm.phone}
                onChange={(e) =>
                  setStoreForm((f) => ({ ...f, phone: e.target.value }))
                }
                className="input-field"
              />
            </label>
            <label className="field-label sm:col-span-2">
              Endereço
              <input
                type="text"
                required
                value={storeForm.address}
                onChange={(e) =>
                  setStoreForm((f) => ({ ...f, address: e.target.value }))
                }
                className="input-field"
              />
            </label>
            <label className="field-label">
              Horário de Funcionamento
              <input
                type="text"
                required
                value={storeForm.openingHours}
                onChange={(e) =>
                  setStoreForm((f) => ({ ...f, openingHours: e.target.value }))
                }
                className="input-field"
              />
            </label>

            <label className="field-label">
              Meta Diária Padrão (R$)
              <input
                type="number"
                step="50"
                value={storeForm.dailyGoal}
                onChange={(e) =>
                  setStoreForm((f) => ({ ...f, dailyGoal: e.target.value }))
                }
                className="input-field font-mono-num"
              />
            </label>
            <label className="field-label">
              Taxa de Serviço Mesa (%)
              <input
                type="number"
                step="0.5"
                value={storeForm.defaultServiceFeePct}
                onChange={(e) =>
                  setStoreForm((f) => ({
                    ...f,
                    defaultServiceFeePct: e.target.value,
                  }))
                }
                className="input-field font-mono-num"
              />
            </label>
            <label className="field-label">
              Frete Grátis Acima de (R$)
              <input
                type="number"
                step="5"
                value={storeForm.freeDeliveryAbove}
                onChange={(e) =>
                  setStoreForm((f) => ({
                    ...f,
                    freeDeliveryAbove: e.target.value,
                  }))
                }
                className="input-field font-mono-num"
              />
            </label>
            <label className="field-label">
              Taxa Cartão Crédito (%)
              <input
                type="number"
                step="0.1"
                value={storeForm.creditCardFeePct}
                onChange={(e) =>
                  setStoreForm((f) => ({
                    ...f,
                    creditCardFeePct: e.target.value,
                  }))
                }
                className="input-field font-mono-num"
              />
            </label>
            <label className="field-label">
              Taxa Cartão Débito (%)
              <input
                type="number"
                step="0.1"
                value={storeForm.debitCardFeePct}
                onChange={(e) =>
                  setStoreForm((f) => ({
                    ...f,
                    debitCardFeePct: e.target.value,
                  }))
                }
                className="input-field font-mono-num"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {busy ? "Salvando..." : "Salvar Configurações"}
            </button>
          </div>
        </form>
      )}

      {subTab === "team" && (
        <div className="grid gap-5 lg:grid-cols-12">
          <form
            onSubmit={createStaffUser}
            className="card-bistro space-y-3 p-5 lg:col-span-4"
          >
            <h3 className="font-display flex items-center gap-2 text-lg font-bold">
              <UserPlus className="h-4 w-4 text-[var(--accent-primary)]" />
              Novo Colaborador
            </h3>
            <label className="field-label">
              Nome Completo
              <input
                type="text"
                required
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="Ex: Ana Paula"
                className="input-field"
              />
            </label>
            <label className="field-label">
              E-mail de Acesso
              <input
                type="email"
                required
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                placeholder="ana@fornoemesa.com"
                className="input-field"
              />
            </label>
            <label className="field-label">
              Perfil (Permissões)
              <select
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value as StaffRole)}
                className="input-field"
              >
                {ALL_STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="field-label">
                Senha
                <input
                  type="password"
                  required
                  minLength={4}
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="Min. 4 chars"
                  className="input-field"
                />
              </label>
              <label className="field-label">
                PIN Rápido
                <input
                  type="text"
                  inputMode="numeric"
                  minLength={4}
                  value={staffPin}
                  onChange={(e) => setStaffPin(e.target.value)}
                  placeholder="Ex: 4040"
                  className="input-field font-mono-num"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full rounded-xl py-2.5 text-xs font-bold disabled:opacity-50"
            >
              Cadastrar Colaborador
            </button>
          </form>

          <div className="card-bistro overflow-x-auto p-0 lg:col-span-8">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Perfil</th>
                  <th>PIN</th>
                  <th>Status</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {staffUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <p className="font-bold text-[var(--text-primary)]">{u.name}</p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        {u.email}
                      </p>
                    </td>
                    <td>
                      <select
                        value={u.role}
                        onChange={(e) =>
                          updateStaffRole(u, e.target.value as StaffRole)
                        }
                        className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${
                          ROLE_BADGE_CLASSES[u.role]
                        }`}
                      >
                        {ALL_STAFF_ROLES.map((r) => (
                          <option key={r} value={r} className="bg-white text-[#3E2723]">
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {u.hasPin ? (
                        <span className="chip bg-emerald-100 text-emerald-900">
                          <KeyRound className="h-3 w-3" /> Ativo
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--text-secondary)]">—</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => toggleStaffActive(u)}
                        className={`chip ${
                          u.isActive
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-stone-200 text-stone-700"
                        }`}
                      >
                        {u.isActive ? "Ativo" : "Suspenso"}
                      </button>
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => removeStaffUser(u)}
                        className="icon-btn text-red-700"
                        title="Remover colaborador"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "coupons" && (
        <div className="grid gap-5 lg:grid-cols-12">
          <form
            onSubmit={createCoupon}
            className="card-bistro space-y-3 p-5 lg:col-span-4"
          >
            <h3 className="font-display flex items-center gap-2 text-lg font-bold">
              <Plus className="h-4 w-4 text-[var(--accent-primary)]" />
              Novo Cupom Promocional
            </h3>
            <label className="field-label">
              Código do Cupom
              <input
                type="text"
                required
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="EX: CAFE20"
                className="input-field font-mono-num uppercase"
              />
            </label>
            <label className="field-label">
              Descrição / Rótulo
              <input
                type="text"
                required
                value={couponLabel}
                onChange={(e) => setCouponLabel(e.target.value)}
                placeholder="Ex: 20% OFF no café da manhã"
                className="input-field"
              />
            </label>
            <label className="field-label">
              Tipo de Benefício
              <select
                value={couponType}
                onChange={(e) =>
                  setCouponType(
                    e.target.value as "PERCENT" | "FIXED" | "FREE_DELIVERY",
                  )
                }
                className="input-field"
              >
                <option value="PERCENT">Percentual (%)</option>
                <option value="FIXED">Valor Fixo (R$)</option>
                <option value="FREE_DELIVERY">Frete Grátis</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {couponType !== "FREE_DELIVERY" && (
                <label className="field-label">
                  {couponType === "PERCENT" ? "Desconto (%)" : "Valor (R$)"}
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={couponValue}
                    onChange={(e) => setCouponValue(e.target.value)}
                    className="input-field font-mono-num"
                  />
                </label>
              )}
              <label className="field-label">
                Pedido Mínimo (R$)
                <input
                  type="number"
                  step="5"
                  value={couponMinOrder}
                  onChange={(e) => setCouponMinOrder(e.target.value)}
                  className="input-field font-mono-num"
                />
              </label>
              {couponType === "PERCENT" && (
                <label className="field-label col-span-2">
                  Teto Máximo Desconto (R$ — opcional)
                  <input
                    type="number"
                    step="5"
                    value={couponMaxDiscount}
                    onChange={(e) => setCouponMaxDiscount(e.target.value)}
                    placeholder="Sem limite"
                    className="input-field font-mono-num"
                  />
                </label>
              )}
            </div>
            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full rounded-xl py-2.5 text-xs font-bold disabled:opacity-50"
            >
              Criar Cupom
            </button>
          </form>

          <div className="card-bistro overflow-x-auto p-0 lg:col-span-8">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Regra</th>
                  <th>Usos</th>
                  <th>Status</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <p className="font-mono-num font-bold text-[var(--accent-primary)]">
                        {c.code}
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        {c.label}
                      </p>
                    </td>
                    <td className="text-xs">
                      {c.type === "FREE_DELIVERY"
                        ? "Frete Grátis"
                        : c.type === "PERCENT"
                          ? `${c.value}%${c.maxDiscount ? ` (até ${formatBRL(c.maxDiscount)})` : ""}`
                          : formatBRL(c.value)}
                      {c.minOrder > 0 && (
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          Mín: {formatBRL(c.minOrder)}
                        </p>
                      )}
                    </td>
                    <td className="font-mono-num font-bold">{c.usageCount}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => toggleCoupon(c)}
                        className={`chip ${
                          c.isActive
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-stone-200 text-stone-700"
                        }`}
                      >
                        {c.isActive ? "Ativo" : "Pausado"}
                      </button>
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => deleteCoupon(c.id)}
                        className="icon-btn text-red-700"
                        title="Excluir cupom"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "audit" && (
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="card-bistro p-5 lg:col-span-5">
            <h3 className="font-display mb-3 flex items-center gap-2 text-lg font-bold">
              <Star className="h-4 w-4 text-amber-500" />
              Avaliações de Clientes ({reviews.length})
            </h3>
            {reviews.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                Nenhuma avaliação recebida ainda. Clientes podem avaliar pedidos entregues na página de acompanhamento.
              </p>
            ) : (
              <div className="max-h-96 space-y-2.5 overflow-y-auto pr-1">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">
                        {rev.customerName ?? "Cliente"}{" "}
                        {rev.order?.code ? `· ${rev.order.code}` : ""}
                      </span>
                      <span className="font-mono-num font-bold text-amber-600">
                        {"★".repeat(rev.rating)}{"☆".repeat(5 - rev.rating)}
                      </span>
                    </div>
                    {rev.comment && (
                      <p className="mt-1 text-[var(--text-secondary)]">{rev.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card-bistro p-5 lg:col-span-7">
            <h3 className="font-display mb-3 flex items-center gap-2 text-lg font-bold">
              <Shield className="h-4 w-4 text-[var(--accent-primary)]" />
              Trilha de Auditoria ({auditLogs.length})
            </h3>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                Nenhum evento registrado ainda.
              </p>
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-bold text-[var(--text-primary)]">
                        {log.action}{" "}
                        <span className="font-normal text-[var(--text-secondary)]">
                          por {log.actorName} ({log.actorRole})
                        </span>
                      </p>
                      {log.details && (
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {log.details}
                        </p>
                      )}
                    </div>
                    <span className="font-mono-num shrink-0 text-[10px] text-[var(--text-secondary)]">
                      {new Date(log.createdAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
