import Link from "next/link";
import { safeEqualString } from "@/lib/auth-crypto";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import { MesaMenuClient } from "@/components/MesaMenuClient";

export const dynamic = "force-dynamic";

export default async function MesaQrPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  await ensureSeeded();
  const { number } = await params;
  const { token } = await searchParams;
  const tableNumber = Number(number);

  const table = Number.isInteger(tableNumber)
    ? await prisma.diningTable.findUnique({
        where: { number: tableNumber },
        include: {
          orders: {
            where: { status: { notIn: ["PAGO", "CANCELADO"] } },
            include: { items: true },
            orderBy: { createdAt: "desc" },
          },
        },
      })
    : null;

  if (!table || !token || !safeEqualString(token, table.qrToken)) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-canvas)] p-6 text-center">
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
          {!table ? "Mesa não encontrada" : "QR Code inválido ou expirado"}
        </h1>
        <p className="mt-2 max-w-sm text-sm text-[var(--text-secondary)]">
          Por favor, escaneie novamente o QR Code impresso na sua mesa ou peça
          auxílio a um atendente.
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

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        where: { isAvailable: true },
        orderBy: { name: "asc" },
      },
    },
  });

  return (
    <MesaMenuClient
      tableNumber={table.number}
      tableName={table.name}
      area={table.area}
      qrToken={token ?? table.qrToken}
      initialCategories={JSON.parse(JSON.stringify(categories))}
      initialOrders={JSON.parse(
        JSON.stringify(
          table.orders.map((o) => ({
            id: o.id,
            code: o.code,
            status: o.status,
            subtotal: o.subtotal,
            serviceFee: o.serviceFee,
            total: o.total,
            items: o.items,
          })),
        ),
      )}
    />
  );
}
