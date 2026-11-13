import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateBatchSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CreateBatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados da fornada inválidos." }, { status: 400 });
    }

    const product = await prisma.product.findUnique({ where: { id: parsed.data.productId } });
    if (!product) {
      return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
    }

    const batch = await prisma.bakeryBatch.create({
      data: {
        productId: product.id,
        productName: product.name,
        plannedQty: parsed.data.plannedQty,
        bakeTime: parsed.data.bakeTime,
        notes: parsed.data.notes?.trim() || null,
        status: "AGENDADA",
      },
    });

    return NextResponse.json({ batch }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao criar fornada.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
