import { NextResponse } from "next/server";
import {
  forbiddenIfNotErpOperator,
  getServerOperatorSession,
  recordAuditLog,
} from "@/lib/access-guard";
import { hashSecret } from "@/lib/auth-crypto";
import { prisma } from "@/lib/prisma";
import { CreateStaffUserSchema, UpdateStaffUserSchema } from "@/lib/schemas";
import { ensureSeeded } from "@/lib/seed";

export async function GET() {
  const forbidden = await forbiddenIfNotErpOperator(["ADMIN", "GERENTE"]);
  if (forbidden) return forbidden;

  await ensureSeeded();
  const users = await prisma.staffUser.findMany({
    orderBy: [{ isActive: "desc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      pinHash: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    staffUsers: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      hasPin: Boolean(u.pinHash),
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator(["ADMIN", "GERENTE"]);
  if (forbidden) return forbidden;

  try {
    await ensureSeeded();
    const session = await getServerOperatorSession();
    const parsed = CreateStaffUserSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados do colaborador inválidos." },
        { status: 400 },
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const exists = await prisma.staffUser.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json(
        { error: "Já existe um colaborador com este e-mail." },
        { status: 400 },
      );
    }

    const created = await prisma.staffUser.create({
      data: {
        name: parsed.data.name.trim(),
        email,
        role: parsed.data.role,
        passwordHash: hashSecret(parsed.data.password),
        pinHash: parsed.data.pin ? hashSecret(parsed.data.pin.trim()) : null,
        isActive: true,
      },
    });

    await recordAuditLog({
      actorName: session?.name ?? "Admin",
      actorRole: session?.role ?? "ADMIN",
      action: "CRIAR_COLABORADOR",
      entity: "StaffUser",
      details: `${created.name} (${created.role})`,
    });

    return NextResponse.json(
      {
        user: {
          id: created.id,
          name: created.name,
          email: created.email,
          role: created.role,
          isActive: created.isActive,
          hasPin: Boolean(created.pinHash),
          lastLoginAt: created.lastLoginAt,
          createdAt: created.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao cadastrar colaborador.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator(["ADMIN", "GERENTE"]);
  if (forbidden) return forbidden;

  try {
    const session = await getServerOperatorSession();
    const parsed = UpdateStaffUserSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Atualização de colaborador inválida." },
        { status: 400 },
      );
    }

    const target = await prisma.staffUser.findUnique({
      where: { id: parsed.data.id },
    });
    if (!target) {
      return NextResponse.json(
        { error: "Colaborador não encontrado." },
        { status: 404 },
      );
    }

    if (
      target.role === "ADMIN" &&
      (parsed.data.isActive === false ||
        (parsed.data.role && parsed.data.role !== "ADMIN"))
    ) {
      const otherAdmins = await prisma.staffUser.count({
        where: { role: "ADMIN", isActive: true, id: { not: target.id } },
      });
      if (otherAdmins === 0) {
        return NextResponse.json(
          { error: "Não é possível desativar ou rebaixar o último administrador ativo." },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.staffUser.update({
      where: { id: target.id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.role ? { role: parsed.data.role } : {}),
        ...(parsed.data.isActive !== undefined
          ? { isActive: parsed.data.isActive }
          : {}),
        ...(parsed.data.password
          ? { passwordHash: hashSecret(parsed.data.password) }
          : {}),
        ...(parsed.data.pin
          ? { pinHash: hashSecret(parsed.data.pin.trim()) }
          : {}),
      },
    });

    await recordAuditLog({
      actorName: session?.name ?? "Admin",
      actorRole: session?.role ?? "ADMIN",
      action: "ATUALIZAR_COLABORADOR",
      entity: "StaffUser",
      details: `${updated.name} · ativo=${updated.isActive} · perfil=${updated.role}`,
    });

    return NextResponse.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        isActive: updated.isActive,
        hasPin: Boolean(updated.pinHash),
        lastLoginAt: updated.lastLoginAt,
        createdAt: updated.createdAt,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao atualizar colaborador.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator(["ADMIN", "GERENTE"]);
  if (forbidden) return forbidden;

  try {
    const session = await getServerOperatorSession();
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }

    const target = await prisma.staffUser.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404 });
    }

    if (target.role === "ADMIN") {
      const otherAdmins = await prisma.staffUser.count({
        where: { role: "ADMIN", isActive: true, id: { not: target.id } },
      });
      if (otherAdmins === 0) {
        return NextResponse.json(
          { error: "Não é possível remover o último administrador ativo." },
          { status: 400 },
        );
      }
    }

    await prisma.staffUser.delete({ where: { id } });
    await recordAuditLog({
      actorName: session?.name ?? "Admin",
      actorRole: session?.role ?? "ADMIN",
      action: "REMOVER_COLABORADOR",
      entity: "StaffUser",
      details: `${target.name} (${target.email})`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao remover colaborador.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
