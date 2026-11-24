import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { forbiddenIfNotErpOperator } from "@/lib/access-guard";
import { prisma } from "@/lib/prisma";
import { CreateTableSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator(["ADMIN", "GERENTE"]);
  if (forbidden) return forbidden;
  try {
    const body = await request.json();
    const parsed = CreateTableSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados da mesa inválidos." }, { status: 400 });
    }

    const exists = await prisma.diningTable.findUnique({
      where: { number: parsed.data.number },
    });
    if (exists) {
      return NextResponse.json(
        { error: `Já existe uma mesa com o número ${parsed.data.number}.` },
        { status: 400 },
      );
    }

    const tokenSuffix = crypto.randomBytes(2).toString("hex");
    const table = await prisma.diningTable.create({
      data: {
        number: parsed.data.number,
        name: parsed.data.name.trim(),
        area: parsed.data.area,
        capacity: parsed.data.capacity,
        status: "LIVRE",
        qrToken: `fm-mesa-${String(parsed.data.number).padStart(2, "0")}-${tokenSuffix}`,
      },
    });
    return NextResponse.json({ table }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao cadastrar mesa.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
