import { ErpWorkspace } from "@/components/ErpWorkspace";
import { OperatorLockScreen } from "@/components/OperatorLockScreen";
import { getServerOperatorSession } from "@/lib/access-guard";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import { getWorkspaceSnapshot } from "@/lib/workspace-service";
import type { WorkspaceSnapshotDto } from "@/types/erp";

export const dynamic = "force-dynamic";

const EMPTY_SNAPSHOT: WorkspaceSnapshotDto = {
  categories: [],
  products: [],
  ingredients: [],
  tables: [],
  orders: [],
  batches: [],
  cakeOrders: [],
  openCashSession: null,
  cashSessions: [],
  customers: [],
  shiftNotes: [],
  financialEntries: [],
  deliveryZones: [],
  storeSettings: {
    id: 1,
    storeName: "Forno & Mesa",
    slogan: "Padaria Artesanal, Cafeteria & Bistrô",
    phone: "(11) 99999-0000",
    address: "Rua das Flores, 240 — Centro",
    openingHours: "Ter–Dom · 07:00 às 22:00",
    isDeliveryOpen: true,
    dailyGoal: 2500,
    defaultServiceFeePct: 10,
    freeDeliveryAbove: 150,
    creditCardFeePct: 3.2,
    debitCardFeePct: 1.6,
    updatedAt: new Date().toISOString(),
  },
  staffUsers: [],
  coupons: [],
  reservations: [],
  reviews: [],
  auditLogs: [],
  metrics: {
    revenueToday: 0,
    paidCount: 0,
    avgTicket: 0,
    activeOrdersCount: 0,
    occupiedTables: 0,
    totalTables: 0,
    lowStockAlerts: 0,
    activeCakeOrders: 0,
    kdsPendingCount: 0,
    activeDeliveries: 0,
    deliveryRevenue: 0,
    waiterCallsCount: 0,
    averageRating: 5,
    reviewsCount: 0,
  },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const operatorSession = await getServerOperatorSession();
  if (!operatorSession) {
    let storeName = "Forno & Mesa";
    let slogan = "Padaria Artesanal, Cafeteria & Bistrô";
    let openingHours = "Ter–Dom · 07:00 às 22:00";
    let isDeliveryOpen = true;
    try {
      await ensureSeeded();
      const s = await prisma.storeSettings.findUnique({ where: { id: 1 } });
      if (s) {
        storeName = s.storeName;
        slogan = s.slogan;
        openingHours = s.openingHours;
        isDeliveryOpen = s.isDeliveryOpen;
      }
    } catch {
      // Fallback to defaults if DB offline
    }
    const authNotice =
      reason === "forbidden"
        ? "Acesso negado para essa rota com o perfil anterior."
        : reason === "auth"
          ? "Faça login para acessar a área interna do sistema."
          : null;
    return (
      <OperatorLockScreen
        storeName={storeName}
        slogan={slogan}
        openingHours={openingHours}
        isDeliveryOpen={isDeliveryOpen}
        authNotice={authNotice}
      />
    );
  }

  let dbError: string | null = null;
  let snapshot: WorkspaceSnapshotDto = EMPTY_SNAPSHOT;

  try {
    const raw = await getWorkspaceSnapshot(operatorSession.role);
    snapshot = JSON.parse(JSON.stringify(raw)) as WorkspaceSnapshotDto;
  } catch (err) {
    dbError =
      err instanceof Error ? err.message : "Erro ao conectar no banco PostgreSQL.";
  }

  return (
    <ErpWorkspace
      initialData={snapshot}
      operatorSession={operatorSession}
      dbError={dbError}
    />
  );
}
