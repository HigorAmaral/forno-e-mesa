import { ErpWorkspace } from "@/components/ErpWorkspace";
import { OperatorLockScreen } from "@/components/OperatorLockScreen";
import { isServerErpAuthorized } from "@/lib/access-guard";
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
  },
};

export default async function HomePage() {
  const authorized = await isServerErpAuthorized();
  if (!authorized) {
    return <OperatorLockScreen />;
  }

  let dbError: string | null = null;
  let snapshot: WorkspaceSnapshotDto = EMPTY_SNAPSHOT;

  try {
    const raw = await getWorkspaceSnapshot();
    snapshot = JSON.parse(JSON.stringify(raw)) as WorkspaceSnapshotDto;
  } catch (err) {
    dbError =
      err instanceof Error ? err.message : "Erro ao conectar no banco PostgreSQL.";
  }

  return <ErpWorkspace initialData={snapshot} dbError={dbError} />;
}
