import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateCakeStatusSchema } from "@/lib/schemas";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const cakeId = Number(id);
    const body = await request.json();
    const parsed = UpdateCakeStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Status inválido para encomenda." }, { status: 400 });
    }

    const updated = await prisma.cakeCustomOrder.update({
      where: { id: cakeId },
      data: {
        status: parsed.data.status,
        ...(parsed.data.depositPaid !== undefined ? { depositPaid: parsed.data.depositPaid } : {}),
      },
    });

    return NextResponse.json({ cake: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao atualizar encomenda.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
