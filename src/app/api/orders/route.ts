import { NextResponse } from "next/server";
import { isServerErpAuthorized } from "@/lib/access-guard";
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

    const isOperator = await isServerErpAuthorized();
    if (!isOperator && !PUBLIC_CHANNELS.has(parsed.data.channel)) {
      return NextResponse.json(
        { error: "Acesso restrito ao painel interno." },
        { status: 403 },
      );
    }

    const order = await createOrAppendOrder(parsed.data, { isPublic: !isOperator });
    return NextResponse.json(
      { order, trackingUrl: order.trackingToken ? `/delivery/acompanhar/${order.code}?t=${order.trackingToken}` : null },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao registrar pedido.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
