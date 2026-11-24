import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { safeEqualString } from "@/lib/auth-crypto";
import { prisma } from "@/lib/prisma";
import { hasAnyRole } from "@/lib/rbac";
import { ensureSeeded } from "@/lib/seed";
import { TableActionSchema } from "@/lib/schemas";
import {
  forbiddenIfNotErpOperator,
  getServerOperatorSession,
  isServerErpAuthorized,
  recordAuditLog,
} from "@/lib/access-guard";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ number: string }> },
) {
  try {
    await ensureSeeded();
    const { number } = await context.params;
    const tableNumber = Number(number);
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    const table = await prisma.diningTable.findUnique({
      where: { number: tableNumber },
      include: {
        orders: {
          where: { status: { notIn: ["PAGO", "CANCELADO"] } },
          include: { items: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!table) {
      return NextResponse.json({ error: "Mesa não encontrada." }, { status: 404 });
    }

    const erpAuthorized = await isServerErpAuthorized();
    const tokenValid = Boolean(token && safeEqualString(token, table.qrToken));
    if (!erpAuthorized && !tokenValid) {
      return NextResponse.json(
        { error: "Token QR inválido para esta mesa." },
        { status: 403 },
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

    return NextResponse.json({
      table,
      tokenValid: true,
      categories,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao consultar mesa.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ number: string }> },
) {
  try {
    await ensureSeeded();
    const { number } = await context.params;
    const tableNumber = Number(number);
    const body = await request.json();
    const parsed = TableActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ação ou status da mesa inválido." }, { status: 400 });
    }

    const existing = await prisma.diningTable.findUnique({
      where: { number: tableNumber },
    });
    if (!existing) {
      return NextResponse.json({ error: "Mesa não encontrada." }, { status: 404 });
    }

    const session = await getServerOperatorSession();
    const erpAuthorized = session !== null;
    const validQr = Boolean(
      parsed.data.qrToken && safeEqualString(parsed.data.qrToken, existing.qrToken),
    );

    if (parsed.data.action === "CALL_WAITER") {
      if (!erpAuthorized && !validQr) {
        return NextResponse.json({ error: "Token QR inválido." }, { status: 403 });
      }
      const table = await prisma.diningTable.update({
        where: { number: tableNumber },
        data: { waiterCalledAt: new Date() },
      });
      return NextResponse.json({ table });
    }

    if (parsed.data.action === "DISMISS_WAITER") {
      if (!session) {
        return NextResponse.json(
          { error: "Autenticação obrigatória para esta ação." },
          { status: 401 },
        );
      }
      if (!hasAnyRole(session.role, ["ADMIN", "GERENTE", "CAIXA", "GARCOM"])) {
        return NextResponse.json(
          { error: "Seu perfil não possui permissão para atender chamados de mesa." },
          { status: 403 },
        );
      }
      const table = await prisma.diningTable.update({
        where: { number: tableNumber },
        data: { waiterCalledAt: null },
      });
      return NextResponse.json({ table });
    }

    if (parsed.data.action === "ROTATE_QR") {
      if (!session) {
        return NextResponse.json(
          { error: "Autenticação obrigatória para esta ação." },
          { status: 401 },
        );
      }
      if (!hasAnyRole(session.role, ["ADMIN", "GERENTE"])) {
        return NextResponse.json(
          { error: "Apenas gerência ou administração pode rotacionar o QR Code." },
          { status: 403 },
        );
      }
      const tokenSuffix = crypto.randomBytes(3).toString("hex");
      const newToken = `fm-mesa-${String(tableNumber).padStart(2, "0")}-${tokenSuffix}`;
      const table = await prisma.diningTable.update({
        where: { number: tableNumber },
        data: { qrToken: newToken },
      });
      await recordAuditLog({
        actorName: session.name,
        actorRole: session.role,
        action: "ROTACIONAR_QR_MESA",
        entity: "DiningTable",
        details: `${table.name} (novo token gerado)`,
      });
      return NextResponse.json({ table });
    }

    if (!parsed.data.status) {
      return NextResponse.json({ error: "Informe o novo status da mesa." }, { status: 400 });
    }

    if (!session) {
      if (parsed.data.status !== "CONTA" || !validQr) {
        return NextResponse.json(
          { error: "Operação restrita ao painel interno." },
          { status: 401 },
        );
      }
    } else if (!hasAnyRole(session.role, ["ADMIN", "GERENTE", "CAIXA", "GARCOM"])) {
      return NextResponse.json(
        { error: "Seu perfil não possui permissão para alterar status da mesa." },
        { status: 403 },
      );
    }

    const table = await prisma.diningTable.update({
      where: { number: tableNumber },
      data: {
        status: parsed.data.status,
        ...(parsed.data.status === "LIVRE" ? { waiterCalledAt: null } : {}),
      },
    });
    return NextResponse.json({ table });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao atualizar mesa.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ number: string }> },
) {
  const forbidden = await forbiddenIfNotErpOperator(["ADMIN", "GERENTE"]);
  if (forbidden) return forbidden;
  try {
    const { number } = await context.params;
    const tableNumber = Number(number);
    const table = await prisma.diningTable.findUnique({
      where: { number: tableNumber },
      include: {
        orders: { where: { status: { notIn: ["PAGO", "CANCELADO"] } } },
      },
    });
    if (!table) {
      return NextResponse.json({ error: "Mesa não encontrada." }, { status: 404 });
    }
    if (table.orders.length > 0) {
      return NextResponse.json(
        { error: "Feche ou transfira a comanda aberta antes de remover a mesa." },
        { status: 400 },
      );
    }
    await prisma.diningTable.delete({ where: { id: table.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao remover mesa.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
