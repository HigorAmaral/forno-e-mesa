import { NextResponse } from "next/server";
import { forbiddenIfNotErpOperator } from "@/lib/access-guard";
import { prisma } from "@/lib/prisma";
import {
  CreateIngredientSchema,
  CreateProductSchema,
  IngredientAdjustSchema,
  ToggleProductSchema,
} from "@/lib/schemas";

export async function POST(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator();
  if (forbidden) return forbidden;
  try {
    const body = await request.json();

    if (body.kind === "ingredient") {
      const parsedIng = CreateIngredientSchema.safeParse(body);
      if (!parsedIng.success) {
        return NextResponse.json({ error: "Dados do insumo inválidos." }, { status: 400 });
      }
      const ingredient = await prisma.ingredient.create({
        data: {
          name: parsedIng.data.name.trim(),
          unit: parsedIng.data.unit,
          currentQty: parsedIng.data.currentQty,
          minQty: parsedIng.data.minQty,
          costPerUnit: parsedIng.data.costPerUnit,
          supplierName: parsedIng.data.supplierName?.trim() || null,
        },
      });
      return NextResponse.json({ ingredient }, { status: 201 });
    }

    const parsed = CreateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados do produto inválidos." }, { status: 400 });
    }

    const count = await prisma.product.count();
    const sku = `PRD-${String(count + 1).padStart(3, "0")}`;

    const product = await prisma.product.create({
      data: {
        sku,
        name: parsed.data.name.trim(),
        description: parsed.data.description.trim(),
        price: parsed.data.price,
        unit: parsed.data.unit,
        prepStation: parsed.data.prepStation,
        prepTimeMinutes: parsed.data.prepTimeMinutes,
        categoryId: parsed.data.categoryId,
        stockQty: parsed.data.stockQty,
        minStockQty: parsed.data.minStockQty,
      },
      include: { category: true },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao cadastrar produto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator();
  if (forbidden) return forbidden;
  try {
    const body = await request.json();

    if (body.kind === "ingredient" && Number.isInteger(body.id)) {
      const parsed = IngredientAdjustSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Ajuste de insumo inválido." }, { status: 400 });
      }
      const existing = await prisma.ingredient.findUnique({ where: { id: body.id } });
      if (!existing) {
        return NextResponse.json({ error: "Insumo não encontrado." }, { status: 404 });
      }
      const updated = await prisma.ingredient.update({
        where: { id: body.id },
        data: {
          currentQty: Math.max(0, Number((existing.currentQty + parsed.data.deltaQty).toFixed(3))),
        },
      });
      return NextResponse.json({ ingredient: updated });
    }

    if (body.kind === "product" && Number.isInteger(body.id)) {
      const parsed = ToggleProductSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Atualização de produto inválida." }, { status: 400 });
      }
      const updated = await prisma.product.update({
        where: { id: body.id },
        data: parsed.data,
      });
      return NextResponse.json({ product: updated });
    }

    return NextResponse.json({ error: "Tipo de atualização não suportado." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao atualizar estoque.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
