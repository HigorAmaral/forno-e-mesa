import type { StaffRole } from "../types/erp.ts";

export type { StaffRole };

export type ErpTabId =
  | "overview"
  | "pdv"
  | "delivery"
  | "tables"
  | "kds"
  | "bakery"
  | "orders"
  | "finance"
  | "customers"
  | "inventory"
  | "settings";

export const ALL_STAFF_ROLES: StaffRole[] = [
  "ADMIN",
  "GERENTE",
  "CAIXA",
  "GARCOM",
  "COZINHA",
];

export const ROLE_LABELS: Record<StaffRole, string> = {
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  CAIXA: "Caixa / PDV",
  GARCOM: "Garçom / Salão",
  COZINHA: "Cozinha / Produção",
};

export const ROLE_BADGE_CLASSES: Record<StaffRole, string> = {
  ADMIN: "bg-[#3E2723] text-[#FAF3E8] border-[#C07F5A]/50",
  GERENTE: "bg-amber-100 text-amber-950 border-amber-300",
  CAIXA: "bg-emerald-100 text-emerald-900 border-emerald-300",
  GARCOM: "bg-sky-100 text-sky-900 border-sky-300",
  COZINHA: "bg-orange-100 text-orange-900 border-orange-300",
};

export const ROLE_ALLOWED_TABS: Record<StaffRole, ErpTabId[]> = {
  ADMIN: [
    "overview",
    "pdv",
    "delivery",
    "tables",
    "kds",
    "bakery",
    "orders",
    "finance",
    "customers",
    "inventory",
    "settings",
  ],
  GERENTE: [
    "overview",
    "pdv",
    "delivery",
    "tables",
    "kds",
    "bakery",
    "orders",
    "finance",
    "customers",
    "inventory",
    "settings",
  ],
  CAIXA: [
    "overview",
    "pdv",
    "delivery",
    "tables",
    "orders",
    "customers",
    "inventory",
  ],
  GARCOM: ["tables", "pdv", "kds", "overview"],
  COZINHA: ["kds", "bakery", "delivery"],
};

export function canAccessTab(
  role: StaffRole | string | null | undefined,
  tab: ErpTabId,
): boolean {
  const normalized = (role ?? "ADMIN") as StaffRole;
  const allowed = ROLE_ALLOWED_TABS[normalized];
  if (!allowed) return false;
  return allowed.includes(tab);
}

export function hasAnyRole(
  role: StaffRole | string | null | undefined,
  allowedRoles?: StaffRole[],
): boolean {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.includes((role ?? "") as StaffRole);
}

export function defaultTabForRole(
  role: StaffRole | string | null | undefined,
): ErpTabId {
  const normalized = (role ?? "ADMIN") as StaffRole;
  const allowed = ROLE_ALLOWED_TABS[normalized];
  if (!allowed || allowed.length === 0) return "overview";
  return allowed[0];
}
