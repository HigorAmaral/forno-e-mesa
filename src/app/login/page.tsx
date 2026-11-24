import { redirect } from "next/navigation";
import { OperatorLockScreen } from "@/components/OperatorLockScreen";
import { getServerOperatorSession } from "@/lib/access-guard";
import { prisma } from "@/lib/prisma";
import { sanitizeNextPath } from "@/lib/route-auth";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;
  const safeNext = sanitizeNextPath(next);

  const session = await getServerOperatorSession();
  if (session) {
    redirect(safeNext);
  }

  let storeName = "Forno & Mesa";
  let slogan = "Padaria Artesanal, Cafeteria & Bistrô";
  let openingHours = "Ter–Dom · 07:00 às 22:00";
  let isDeliveryOpen = true;

  try {
    await ensureSeeded();
    const s = await prisma.storeSettings.findUnique({ where: { id: 1 } });
    if (s) {
      storeName = s.storeName;
      slogan = s.slogan;
      openingHours = s.openingHours;
      isDeliveryOpen = s.isDeliveryOpen;
    }
  } catch {
    // Fallback to defaults if DB is temporarily unavailable
  }

  const authNotice =
    reason === "expired"
      ? "Sua sessão de operador expirou. Faça login novamente para continuar."
      : reason === "auth"
        ? "Autenticação obrigatória. Entre com seu PIN ou e-mail corporativo para acessar esta rota."
        : null;

  return (
    <OperatorLockScreen
      storeName={storeName}
      slogan={slogan}
      openingHours={openingHours}
      isDeliveryOpen={isDeliveryOpen}
      defaultShowStaffPanel
      nextPath={safeNext}
      authNotice={authNotice}
    />
  );
}
