import { ensureSeeded } from "@/lib/seed";
import { prisma } from "@/lib/prisma";
import { CustomerPortalClient } from "@/components/CustomerPortalClient";

export const dynamic = "force-dynamic";

export default async function CustomerAccountPage() {
  await ensureSeeded();
  const [zones, settings] = await Promise.all([
    prisma.deliveryZone.findMany({
      where: { isActive: true },
      orderBy: { fee: "asc" },
    }),
    prisma.storeSettings.findUnique({ where: { id: 1 } }),
  ]);

  return (
    <CustomerPortalClient
      zones={JSON.parse(JSON.stringify(zones))}
      storeName={settings?.storeName ?? "Forno & Mesa"}
    />
  );
}
