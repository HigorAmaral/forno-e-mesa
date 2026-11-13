import { NextResponse } from "next/server";
import { forbiddenIfNotErpOperator } from "@/lib/access-guard";
import { prisma } from "@/lib/prisma";
import { CashActionSchema } from "@/lib/schemas";
import { roundMoney } from "@/lib/domain";

export async function POST(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator();
  if (forbidden) return forbidden;
  try {
    const body = await request.json();
    const parsed = CashActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Operação de caixa inválida." }, { status: 400 });
    }

    const { action } = parsed.data;

    if (action === "OPEN") {
      const alreadyOpen = await prisma.cashRegisterSession.findFirst({ where: { status: "ABERTO" } });
      if (alreadyOpen) {
        return NextResponse.json({ error: "Já existe um caixa aberto." }, { status: 400 });
      }
      const opening = parsed.data.openingAmount ?? 200;
      const session = await prisma.cashRegisterSession.create({
        data: {
          openedBy: parsed.data.openedBy?.trim() || "Operador Caixa",
          openingAmount: opening,
          expectedAmount: opening,
          status: "ABERTO",
        },
        include: { movements: true },
      });
      return NextResponse.json({ session }, { status: 201 });
    }

    const openSession = await prisma.cashRegisterSession.findFirst({
      where: { status: "ABERTO" },
      orderBy: { openedAt: "desc" },
    });
    if (!openSession) {
      return NextResponse.json({ error: "Nenhum caixa aberto no momento." }, { status: 400 });
    }

    if (action === "MOVEMENT") {
      if (!parsed.data.movementType || !parsed.data.amount) {
        return NextResponse.json({ error: "Informe tipo e valor da movimentação." }, { status: 400 });
      }
      const delta = parsed.data.movementType === "SUPRIMENTO" ? parsed.data.amount : -parsed.data.amount;
      await prisma.cashMovement.create({
        data: {
          sessionId: openSession.id,
          type: parsed.data.movementType,
          paymentMethod: "DINHEIRO",
          amount: parsed.data.amount,
          description:
            parsed.data.description?.trim() ||
            (parsed.data.movementType === "SANGRIA" ? "Sangria de caixa" : "Suprimento de troco"),
        },
      });
      const updated = await prisma.cashRegisterSession.update({
        where: { id: openSession.id },
        data: { expectedAmount: Math.max(0, roundMoney(openSession.expectedAmount + delta)) },
        include: { movements: { orderBy: { createdAt: "desc" } } },
      });
      return NextResponse.json({ session: updated });
    }

    if (action === "CLOSE") {
      const closed = await prisma.cashRegisterSession.update({
        where: { id: openSession.id },
        data: {
          status: "FECHADO",
          closingAmount: parsed.data.closingAmount ?? openSession.expectedAmount,
          closedAt: new Date(),
        },
      });
      return NextResponse.json({ session: closed });
    }

    return NextResponse.json({ error: "Ação não suportada." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro na operação de caixa.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
