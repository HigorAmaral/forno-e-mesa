import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateBatchSchema } from "@/lib/schemas";
import { roundMoney } from "@/lib/domain";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const batchId = Number(id);
    const body = await request.json();
    const parsed = UpdateBatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos para fornada." }, { status: 400 });
    }

    const existing = await prisma.bakeryBatch.findUnique({ where: { id: batchId } });
    if (!existing) {
      return NextResponse.json({ error: "Fornada não encontrada." }, { status: 404 });
    }

    const producedQty =
      parsed.data.status === "PRONTA"
        ? parsed.data.producedQty ?? existing.plannedQty
        : existing.producedQty;

    const updated = await prisma.bakeryBatch.update({
      where: { id: batchId },
      data: {
        status: parsed.data.status,
        producedQty,
      },
    });

    // When transitioning to PRONTA for the first time, add produced quantity to product stock
    if (existing.status !== "PRONTA" && parsed.data.status === "PRONTA") {
      const product = await prisma.product.findUnique({ where: { id: existing.productId } });
      if (product) {
        await prisma.product.update({
          where: { id: product.id },
          data: { stockQty: roundMoney(product.stockQty + producedQty) },
        });
      }
    }

    return NextResponse.json({ batch: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao atualizar fornada.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
