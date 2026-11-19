import { NextResponse } from "next/server";
import { forbiddenIfNotErpOperator } from "@/lib/access-guard";
import { UpdateDeliverySchema } from "@/lib/schemas";
import { updateDeliveryOrder } from "@/lib/workspace-service";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const forbidden = await forbiddenIfNotErpOperator();
    if (forbidden) return forbidden;

    const { id } = await context.params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "ID do pedido inválido." }, { status: 400 });
    }

    const parsed = UpdateDeliverySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados de entrega inválidos." }, { status: 400 });
    }

    const order = await updateDeliveryOrder(orderId, parsed.data);
    return NextResponse.json({ order });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao atualizar entrega.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
