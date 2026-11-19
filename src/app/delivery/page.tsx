import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import { DeliveryStorefrontClient } from "@/components/DeliveryStorefrontClient";

export const dynamic = "force-dynamic";

export default async function DeliveryPage() {
  await ensureSeeded();

  const [categories, zones] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        products: {
          where: { isAvailable: true },
          orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
        },
      },
    }),
    prisma.deliveryZone.findMany({
      where: { isActive: true },
      orderBy: { fee: "asc" },
    }),
  ]);

  return (
    <DeliveryStorefrontClient
      categories={JSON.parse(JSON.stringify(categories))}
      zones={JSON.parse(JSON.stringify(zones))}
    />
  );
}
