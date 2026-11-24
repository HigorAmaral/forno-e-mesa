import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeeded();

    const [categories, zones, coupons, settings, reviewAgg] = await Promise.all([
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
      prisma.promoCoupon.findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
      }),
      prisma.storeSettings.findUnique({ where: { id: 1 } }),
      prisma.orderReview.aggregate({
        _avg: { rating: true },
        _count: { id: true },
      }),
    ]);

    return NextResponse.json({
      categories,
      zones,
      coupons,
      storeSettings: settings
        ? {
            storeName: settings.storeName,
            slogan: settings.slogan,
            phone: settings.phone,
            address: settings.address,
            openingHours: settings.openingHours,
            isDeliveryOpen: settings.isDeliveryOpen,
            freeDeliveryAbove: settings.freeDeliveryAbove,
          }
        : null,
      averageRating: reviewAgg._avg.rating ?? 4.9,
      reviewsCount: reviewAgg._count.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao carregar cardápio.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
