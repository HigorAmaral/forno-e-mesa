import { NextResponse } from "next/server";
import {
  getServerCustomerSession,
  getServerOperatorSession,
  recordAuditLog,
} from "@/lib/access-guard";
import { hasAnyRole } from "@/lib/rbac";
import { CreateOrderSchema } from "@/lib/schemas";
import { createOrAppendOrder } from "@/lib/workspace-service";

const PUBLIC_CHANNELS = new Set(["QR_MESA", "DELIVERY", "RETIRADA"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CreateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados do pedido inválidos.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const operatorSession = await getServerOperatorSession();
    const isOperator = operatorSession !== null;
    if (!isOperator && !PUBLIC_CHANNELS.has(parsed.data.channel)) {
      return NextResponse.json(
        { error: "Autenticação obrigatória para pedidos internos." },
        { status: 401 },
      );
    }
    if (
      isOperator &&
      !PUBLIC_CHANNELS.has(parsed.data.channel) &&
      !hasAnyRole(operatorSession.role, ["ADMIN", "GERENTE", "CAIXA", "GARCOM"])
    ) {
      return NextResponse.json(
        { error: "Seu perfil não possui permissão para criar pedidos neste canal." },
        { status: 403 },
      );
    }

    const customerSession = !isOperator ? await getServerCustomerSession() : null;

    const order = await createOrAppendOrder(parsed.data, {
      isPublic: !isOperator,
      customerSessionId: customerSession?.customerId ?? null,
      operatorName: operatorSession?.name ?? null,
    });

    if (isOperator) {
      await recordAuditLog({
        actorName: operatorSession.name,
        actorRole: operatorSession.role,
        action: "CRIAR_PEDIDO",
        entity: "Order",
        details: `${order.code} (${order.channel}) · R$ ${order.total.toFixed(2)}`,
      });
    }

    return NextResponse.json(
      {
        order,
        trackingUrl: order.trackingToken
          ? `/delivery/acompanhar/${order.code}?t=${order.trackingToken}`
          : null,
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao registrar pedido.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
