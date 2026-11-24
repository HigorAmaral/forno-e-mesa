import { NextResponse } from "next/server";
import {
  forbiddenIfNotErpOperator,
  getServerOperatorSession,
} from "@/lib/access-guard";
import { getWorkspaceSnapshot } from "@/lib/workspace-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const forbidden = await forbiddenIfNotErpOperator();
  if (forbidden) return forbidden;
  try {
    const session = await getServerOperatorSession();
    if (!session) {
      return NextResponse.json(
        { error: "Autenticação obrigatória." },
        { status: 401 },
      );
    }
    const snapshot = await getWorkspaceSnapshot(session.role);
    return NextResponse.json(snapshot);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao carregar workspace.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
