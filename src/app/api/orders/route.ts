import { NextResponse } from "next/server";
import { forbiddenIfNotErpOperator } from "@/lib/access-guard";
import { CreateOrderSchema } from "@/lib/schemas";
import { createOrAppendOrder } from "@/lib/workspace-service";

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

    if (parsed.data.channel !== "QR_MESA") {
      const forbidden = await forbiddenIfNotErpOperator();
      if (forbidden) return forbidden;
    }

    const order = await createOrAppendOrder(parsed.data);
    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao registrar pedido.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
