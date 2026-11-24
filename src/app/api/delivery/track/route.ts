import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Public order tracking — requires the secret tracking token issued at checkout. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim();
  const token = url.searchParams.get("t")?.trim();
  if (!code || !token) {
    return NextResponse.json({ error: "Código e token são obrigatórios." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { code },
    include: { items: true, review: true },
  });
  if (!order || !order.trackingToken || order.trackingToken !== token) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    order: {
      code: order.code,
      channel: order.channel,
      status: order.status,
      deliveryStatus: order.deliveryStatus,
      customerName: order.customerName,
      deliveryAddress: order.deliveryAddress,
      deliveryNeighborhood: order.deliveryNeighborhood,
      courierName: order.courierName,
      paymentMethod: order.paymentMethod,
      changeFor: order.changeFor,
      subtotal: order.subtotal,
      discount: order.discount,
      deliveryFee: order.deliveryFee,
      total: order.total,
      estimatedMinutes: order.estimatedMinutes,
      scheduledFor: order.scheduledFor,
      createdAt: order.createdAt,
      dispatchedAt: order.dispatchedAt,
      deliveredAt: order.deliveredAt,
      review: order.review,
      items: order.items.map((i) => ({
        id: i.id,
        productName: i.productName,
        qty: i.qty,
        totalPrice: i.totalPrice,
        notes: i.notes,
      })),
    },
  });
}
