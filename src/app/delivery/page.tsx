import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import { getServerCustomerSession } from "@/lib/access-guard";
import { DeliveryStorefrontClient } from "@/components/DeliveryStorefrontClient";

export const dynamic = "force-dynamic";

export default async function DeliveryPage() {
  await ensureSeeded();

  const [categories, zones, settings, activeCoupons, reviewAgg, customerSession] =
    await Promise.all([
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
      prisma.storeSettings.findUnique({ where: { id: 1 } }),
      prisma.promoCoupon.findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
      }),
      prisma.orderReview.aggregate({
        _avg: { rating: true },
        _count: { id: true },
      }),
      getServerCustomerSession(),
    ]);

  const loggedCustomer = customerSession
    ? await prisma.customerProfile.findUnique({
        where: { id: customerSession.customerId },
        select: {
          id: true,
          name: true,
          phone: true,
          loyaltyPoints: true,
          defaultAddress: true,
          defaultNeighborhood: true,
          defaultReference: true,
        },
      })
    : null;

  return (
    <DeliveryStorefrontClient
      categories={JSON.parse(JSON.stringify(categories))}
      zones={JSON.parse(JSON.stringify(zones))}
      storeSettings={JSON.parse(JSON.stringify(settings))}
      coupons={JSON.parse(JSON.stringify(activeCoupons))}
      averageRating={reviewAgg._avg.rating ?? 4.9}
      reviewsCount={reviewAgg._count.id}
      loggedCustomer={JSON.parse(JSON.stringify(loggedCustomer))}
    />
  );
}
