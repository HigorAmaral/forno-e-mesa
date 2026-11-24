import { NextResponse } from "next/server";
import {
  forbiddenIfNotErpOperator,
  getServerOperatorSession,
  recordAuditLog,
} from "@/lib/access-guard";
import { prisma } from "@/lib/prisma";
import { hasAnyRole } from "@/lib/rbac";
import {
  CreateCategorySchema,
  CreateIngredientSchema,
  CreateProductSchema,
  IngredientAdjustSchema,
  ToggleProductSchema,
  UpsertRecipeSchema,
} from "@/lib/schemas";

function slugifyCategory(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator(["ADMIN", "GERENTE", "CAIXA"]);
  if (forbidden) return forbidden;
  try {
    const session = await getServerOperatorSession();
    const body = await request.json();

    if (body.kind === "category") {
      const parsedCat = CreateCategorySchema.safeParse(body);
      if (!parsedCat.success) {
        return NextResponse.json({ error: "Dados da categoria inválidos." }, { status: 400 });
      }
      const baseSlug = slugifyCategory(parsedCat.data.name) || "categoria";
      const count = await prisma.category.count();
      const existingSlug = await prisma.category.findUnique({ where: { slug: baseSlug } });
      const slug = existingSlug ? `${baseSlug}-${count + 1}` : baseSlug;
      const category = await prisma.category.create({
        data: {
          name: parsedCat.data.name.trim(),
          slug,
          sector: parsedCat.data.sector,
          sortOrder: count + 1,
        },
      });
      return NextResponse.json({ category }, { status: 201 });
    }

    if (body.kind === "recipe") {
      const parsedRecipe = UpsertRecipeSchema.safeParse(body);
      if (!parsedRecipe.success) {
        return NextResponse.json({ error: "Ficha técnica inválida." }, { status: 400 });
      }
      const product = await prisma.product.findUnique({
        where: { id: parsedRecipe.data.productId },
      });
      if (!product) {
        return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
      }

      await prisma.$transaction(async (tx) => {
        await tx.recipeItem.deleteMany({
          where: { productId: parsedRecipe.data.productId },
        });
        if (parsedRecipe.data.items.length > 0) {
          await tx.recipeItem.createMany({
            data: parsedRecipe.data.items.map((item) => ({
              productId: parsedRecipe.data.productId,
              ingredientId: item.ingredientId,
              qtyRequired: item.qtyRequired,
            })),
          });
        }
      });

      const updatedProduct = await prisma.product.findUnique({
        where: { id: parsedRecipe.data.productId },
        include: {
          category: true,
          recipeItems: { include: { ingredient: true } },
        },
      });
      await recordAuditLog({
        actorName: session?.name ?? "Operador",
        actorRole: session?.role ?? "ADMIN",
        action: "ATUALIZAR_FICHA_TECNICA",
        entity: "Product",
        details: `${product.name} (${parsedRecipe.data.items.length} insumos)`,
      });
      return NextResponse.json({ product: updatedProduct });
    }

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

    if (!hasAnyRole(session?.role, ["ADMIN", "GERENTE"])) {
      return NextResponse.json(
        { error: "Apenas administradores ou gerentes podem cadastrar produtos no cardápio." },
        { status: 403 },
      );
    }

    const parsed = CreateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados do produto inválidos." }, { status: 400 });
    }

    const lastProduct = await prisma.product.findFirst({
      orderBy: { id: "desc" },
      select: { id: true },
    });
    const sku = `PRD-${String((lastProduct?.id ?? 0) + 1).padStart(3, "0")}`;

    const product = await prisma.product.create({
      data: {
        sku,
        name: parsed.data.name.trim(),
        description: parsed.data.description.trim(),
        imageUrl: parsed.data.imageUrl?.trim() || null,
        price: parsed.data.price,
        unit: parsed.data.unit,
        prepStation: parsed.data.prepStation,
        prepTimeMinutes: parsed.data.prepTimeMinutes,
        categoryId: parsed.data.categoryId,
        isFeatured: parsed.data.isFeatured ?? false,
        stockQty: parsed.data.stockQty,
        minStockQty: parsed.data.minStockQty,
      },
      include: { category: true, recipeItems: { include: { ingredient: true } } },
    });

    await recordAuditLog({
      actorName: session?.name ?? "Operador",
      actorRole: session?.role ?? "ADMIN",
      action: "CRIAR_PRODUTO",
      entity: "Product",
      details: `${product.name} (${product.sku})`,
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao cadastrar produto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator(["ADMIN", "GERENTE", "CAIXA"]);
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
      const session = await getServerOperatorSession();
      const parsed = ToggleProductSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Atualização de produto inválida." }, { status: 400 });
      }
      const touchesCatalog =
        parsed.data.name !== undefined ||
        parsed.data.description !== undefined ||
        parsed.data.imageUrl !== undefined ||
        parsed.data.price !== undefined ||
        parsed.data.categoryId !== undefined ||
        parsed.data.unit !== undefined ||
        parsed.data.prepStation !== undefined ||
        parsed.data.prepTimeMinutes !== undefined ||
        parsed.data.isFeatured !== undefined;

      if (touchesCatalog && !hasAnyRole(session?.role, ["ADMIN", "GERENTE"])) {
        return NextResponse.json(
          { error: "Apenas administradores ou gerentes podem alterar dados de catálogo do produto." },
          { status: 403 },
        );
      }

      const updateData = {
        ...parsed.data,
        ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.description !== undefined
          ? { description: parsed.data.description.trim() }
          : {}),
        ...(parsed.data.imageUrl !== undefined
          ? { imageUrl: parsed.data.imageUrl?.trim() || null }
          : {}),
      };

      const updated = await prisma.product.update({
        where: { id: body.id },
        data: updateData,
        include: { category: true, recipeItems: { include: { ingredient: true } } },
      });

      await recordAuditLog({
        actorName: session?.name ?? "Operador",
        actorRole: session?.role ?? "ADMIN",
        action: "EDITAR_PRODUTO",
        entity: "Product",
        details: `${updated.name} (${updated.sku})`,
      });

      return NextResponse.json({ product: updated });
    }

    return NextResponse.json({ error: "Tipo de atualização não suportado." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao atualizar estoque.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator(["ADMIN", "GERENTE"]);
  if (forbidden) return forbidden;
  try {
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }

    if (kind === "ingredient") {
      await prisma.ingredient.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }
    if (kind === "product") {
      await prisma.product.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Tipo para exclusão inválido." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao remover item.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
