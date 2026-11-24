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
  ADMIN:
    "bg-[#C84B28]/15 text-[#C84B28] border-[#C84B28]/30 dark:bg-[#E8643C]/20 dark:text-[#FF9E80] dark:border-[#E8643C]/40",
  GERENTE:
    "bg-amber-500/15 text-amber-800 border-amber-500/30 dark:bg-amber-400/20 dark:text-amber-300 dark:border-amber-400/35",
  CAIXA:
    "bg-emerald-500/15 text-emerald-800 border-emerald-500/30 dark:bg-emerald-400/20 dark:text-emerald-300 dark:border-emerald-400/35",
  GARCOM:
    "bg-sky-500/15 text-sky-800 border-sky-500/30 dark:bg-sky-400/20 dark:text-sky-300 dark:border-sky-400/35",
  COZINHA:
    "bg-orange-500/15 text-orange-800 border-orange-500/30 dark:bg-orange-400/20 dark:text-orange-300 dark:border-orange-400/35",
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

export function isValidStaffRole(role: string | null | undefined): role is StaffRole {
  if (!role) return false;
  return ALL_STAFF_ROLES.includes(role as StaffRole);
}

export function canAccessTab(
  role: StaffRole | string | null | undefined,
  tab: ErpTabId,
): boolean {
  if (!role || !isValidStaffRole(role)) return false;
  const allowed = ROLE_ALLOWED_TABS[role];
  if (!allowed) return false;
  return allowed.includes(tab);
}

export function hasAnyRole(
  role: StaffRole | string | null | undefined,
  allowedRoles?: StaffRole[],
): boolean {
  if (!role || !isValidStaffRole(role)) return false;
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.includes(role);
}

export function defaultTabForRole(
  role: StaffRole | string | null | undefined,
): ErpTabId {
  if (!role || !isValidStaffRole(role)) return "overview";
  const allowed = ROLE_ALLOWED_TABS[role];
  if (!allowed || allowed.length === 0) return "overview";
  return allowed[0];
}
