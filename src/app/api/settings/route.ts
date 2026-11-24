import { NextResponse } from "next/server";
import {
  forbiddenIfNotErpOperator,
  getServerOperatorSession,
  isServerErpAuthorized,
  recordAuditLog,
} from "@/lib/access-guard";
import { prisma } from "@/lib/prisma";
import { UpdateStoreSettingsSchema } from "@/lib/schemas";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  const isOperator = await isServerErpAuthorized();
  const settings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
  if (!settings || isOperator) {
    return NextResponse.json({ settings });
  }
  return NextResponse.json({
    settings: {
      storeName: settings.storeName,
      slogan: settings.slogan,
      phone: settings.phone,
      address: settings.address,
      openingHours: settings.openingHours,
      isDeliveryOpen: settings.isDeliveryOpen,
      freeDeliveryAbove: settings.freeDeliveryAbove,
    },
  });
}

export async function PATCH(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator(["ADMIN", "GERENTE"]);
  if (forbidden) return forbidden;

  try {
    await ensureSeeded();
    const session = await getServerOperatorSession();
    const parsed = UpdateStoreSettingsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Configurações inválidas." },
        { status: 400 },
      );
    }

    const updated = await prisma.storeSettings.upsert({
      where: { id: 1 },
      update: parsed.data,
      create: { id: 1, ...parsed.data },
    });

    await recordAuditLog({
      actorName: session?.name ?? "Admin",
      actorRole: session?.role ?? "ADMIN",
      action: "ATUALIZAR_CONFIGURACOES",
      entity: "StoreSettings",
      details: `Delivery=${updated.isDeliveryOpen ? "Aberto" : "Pausado"}, Meta=R$${updated.dailyGoal}`,
    });

    return NextResponse.json({ settings: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao salvar configurações.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
