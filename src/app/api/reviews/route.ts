import { NextResponse } from "next/server";
import { forbiddenIfNotErpOperator } from "@/lib/access-guard";
import { safeEqualString } from "@/lib/auth-crypto";
import { prisma } from "@/lib/prisma";
import { CreateOrderReviewSchema } from "@/lib/schemas";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  const forbidden = await forbiddenIfNotErpOperator(["ADMIN", "GERENTE"]);
  if (forbidden) return forbidden;

  await ensureSeeded();
  const reviews = await prisma.orderReview.findMany({
    include: { order: { select: { code: true, channel: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ reviews });
}

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const parsed = CreateOrderReviewSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Avaliação inválida. Escolha de 1 a 5 estrelas." },
        { status: 400 },
      );
    }

    const order = await prisma.order.findUnique({
      where: { code: parsed.data.code.trim() },
      include: { review: true },
    });

    if (
      !order ||
      !order.trackingToken ||
      !safeEqualString(order.trackingToken, parsed.data.token.trim())
    ) {
      return NextResponse.json(
        { error: "Pedido não encontrado ou token inválido." },
        { status: 404 },
      );
    }

    if (order.deliveryStatus !== "ENTREGUE") {
      return NextResponse.json(
        { error: "Avaliação disponível após a entrega do pedido." },
        { status: 400 },
      );
    }

    if (order.review) {
      return NextResponse.json(
        { error: "Este pedido já foi avaliado. Obrigado!" },
        { status: 400 },
      );
    }

    const review = await prisma.orderReview.create({
      data: {
        orderId: order.id,
        rating: parsed.data.rating,
        comment: parsed.data.comment?.trim() || null,
        customerName: order.customerName ?? "Cliente",
      },
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao registrar avaliação.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
