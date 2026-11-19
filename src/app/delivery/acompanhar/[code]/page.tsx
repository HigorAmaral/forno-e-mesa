import { prisma } from "@/lib/prisma";
import { DeliveryTrackerClient } from "@/components/DeliveryTrackerClient";

export const dynamic = "force-dynamic";

export default async function TrackDeliveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { code } = await params;
  const { t } = await searchParams;

  const order = await prisma.order.findUnique({
    where: { code },
    include: { items: true },
  });

  if (!order || !t || !order.trackingToken || order.trackingToken !== t) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#f8fafc] p-6 text-center">
        <h1 className="font-display text-2xl font-bold text-[#0f172a]">
          Pedido não encontrado
        </h1>
        <p className="mt-2 max-w-sm text-sm text-[#475569]">
          Verifique o link de acompanhamento enviado no momento do seu pedido.
        </p>
      </main>
    );
  }

  return (
    <DeliveryTrackerClient
      initialOrder={JSON.parse(JSON.stringify(order))}
      token={t}
    />
  );
}
