import { NextResponse } from "next/server";
import { forbiddenIfNotErpOperator } from "@/lib/access-guard";
import { prisma } from "@/lib/prisma";
import { CreateShiftNoteSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator();
  if (forbidden) return forbidden;
  try {
    const body = await request.json();
    const parsed = CreateShiftNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Recado inválido." }, { status: 400 });
    }
    const note = await prisma.shiftNote.create({
      data: {
        author: parsed.data.author.trim(),
        content: parsed.data.content.trim(),
        priority: parsed.data.priority,
      },
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao salvar recado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator();
  if (forbidden) return forbidden;
  try {
    const body = (await request.json()) as { id?: number; isDone?: boolean };
    if (!body.id || typeof body.isDone !== "boolean") {
      return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
    }
    const note = await prisma.shiftNote.update({
      where: { id: body.id },
      data: { isDone: body.isDone },
    });
    return NextResponse.json({ note });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao atualizar recado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator();
  if (forbidden) return forbidden;
  try {
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    await prisma.shiftNote.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao excluir recado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
