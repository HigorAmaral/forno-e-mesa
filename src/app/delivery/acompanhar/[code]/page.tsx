import Link from "next/link";
import { safeEqualString } from "@/lib/auth-crypto";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import { DeliveryTrackerClient } from "@/components/DeliveryTrackerClient";

export const dynamic = "force-dynamic";

export default async function TrackDeliveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  await ensureSeeded();
  const { code } = await params;
  const { t } = await searchParams;

  const [order, settings] = await Promise.all([
    prisma.order.findUnique({
      where: { code },
      include: { items: true, review: true },
    }),
    prisma.storeSettings.findUnique({ where: { id: 1 } }),
  ]);

  if (!order || !t || !order.trackingToken || !safeEqualString(order.trackingToken, t)) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-canvas)] p-6 text-center">
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
          Pedido não encontrado
        </h1>
        <p className="mt-2 max-w-sm text-sm text-[var(--text-secondary)]">
          Verifique o link de acompanhamento enviado no momento do seu pedido.
        </p>
        <Link
          href="/"
          className="btn-primary mt-5 inline-flex items-center rounded-xl px-4 py-2 text-xs font-bold"
        >
          Voltar ao início
        </Link>
      </main>
    );
  }

  return (
    <DeliveryTrackerClient
      initialOrder={JSON.parse(JSON.stringify(order))}
      token={t}
      storePhone={settings?.phone ?? "(11) 99999-0000"}
      storeName={settings?.storeName ?? "Forno & Mesa"}
    />
  );
}
