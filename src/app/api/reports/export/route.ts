import { NextResponse } from "next/server";
import { forbiddenIfNotErpOperator } from "@/lib/access-guard";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

function csvCell(value: string | number | null | undefined): string {
  const str = String(value ?? "").replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(request: Request) {
  const forbidden = await forbiddenIfNotErpOperator(["ADMIN", "GERENTE", "CAIXA"]);
  if (forbidden) return forbidden;
  try {
    await ensureSeeded();
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");

    if (scope === "finance") {
      const entries = await prisma.financialEntry.findMany({
        orderBy: [{ dueDate: "asc" }, { id: "desc" }],
      });

      const header = [
        "ID",
        "Tipo",
        "Categoria",
        "Descricao",
        "Fornecedor_Cliente",
        "Vencimento",
        "Status",
        "Pagamento",
        "Valor",
        "Pago_Em",
      ].join(";");

      const rows = entries.map((e) =>
        [
          csvCell(e.id),
          csvCell(e.type),
          csvCell(e.category),
          csvCell(e.description),
          csvCell(e.counterparty ?? "-"),
          csvCell(e.dueDate),
          csvCell(e.status),
          csvCell(e.paymentMethod ?? "-"),
          csvCell(e.amount.toFixed(2).replace(".", ",")),
          csvCell(e.paidAt ? e.paidAt.toISOString() : "-"),
        ].join(";"),
      );

      const csv = `\uFEFF${[header, ...rows].join("\n")}`;
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="forno-e-mesa-financeiro.csv"',
        },
      });
    }

    if (scope === "inventory") {
      const [products, ingredients] = await Promise.all([
        prisma.product.findMany({ include: { category: true }, orderBy: { name: "asc" } }),
        prisma.ingredient.findMany({ orderBy: { name: "asc" } }),
      ]);

      const header = [
        "Tipo",
        "SKU_ou_ID",
        "Nome",
        "Categoria_Fornecedor",
        "Unidade",
        "Estoque_Atual",
        "Estoque_Minimo",
        "Preco_ou_Custo",
        "Status",
      ].join(";");

      const prodRows = products.map((p) =>
        [
          csvCell("PRODUTO"),
          csvCell(p.sku),
          csvCell(p.name),
          csvCell(p.category.name),
          csvCell(p.unit),
          csvCell(p.stockQty.toFixed(2).replace(".", ",")),
          csvCell(p.minStockQty.toFixed(2).replace(".", ",")),
          csvCell(p.price.toFixed(2).replace(".", ",")),
          csvCell(p.isAvailable ? "Disponível" : "Pausado"),
        ].join(";"),
      );

      const ingRows = ingredients.map((i) =>
        [
          csvCell("INSUMO"),
          csvCell(`ING-${i.id}`),
          csvCell(i.name),
          csvCell(i.supplierName ?? "-"),
          csvCell(i.unit),
          csvCell(i.currentQty.toFixed(3).replace(".", ",")),
          csvCell(i.minQty.toFixed(3).replace(".", ",")),
          csvCell(i.costPerUnit.toFixed(2).replace(".", ",")),
          csvCell(i.currentQty <= i.minQty ? "Baixo" : "OK"),
        ].join(";"),
      );

      const csv = `\uFEFF${[header, ...prodRows, ...ingRows].join("\n")}`;
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="forno-e-mesa-estoque.csv"',
        },
      });
    }

    if (scope === "customers") {
      const customers = await prisma.customerProfile.findMany({
        orderBy: { totalSpent: "desc" },
      });
      const header = [
        "ID",
        "Nome",
        "Telefone",
        "Email",
        "Pontos",
        "Total_Gasto",
        "Visitas",
        "Item_Favorito",
      ].join(";");
      const rows = customers.map((c) =>
        [
          csvCell(c.id),
          csvCell(c.name),
          csvCell(c.phone),
          csvCell(c.email ?? "-"),
          csvCell(c.loyaltyPoints),
          csvCell(c.totalSpent.toFixed(2).replace(".", ",")),
          csvCell(c.visitsCount),
          csvCell(c.favoriteItem ?? "-"),
        ].join(";"),
      );
      const csv = `\uFEFF${[header, ...rows].join("\n")}`;
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="forno-e-mesa-clientes.csv"',
        },
      });
    }

    const orders = await prisma.order.findMany({
      include: { table: true, items: true },
      orderBy: { createdAt: "desc" },
    });

    const header = [
      "Codigo",
      "Data",
      "Canal",
      "Mesa",
      "Cliente",
      "Status",
      "Pagamento",
      "Cupom",
      "Itens",
      "Subtotal",
      "Desconto",
      "Taxa_Servico",
      "Taxa_Entrega",
      "Bairro_Entrega",
      "Total",
    ].join(";");

    const rows = orders.map((o) =>
      [
        csvCell(o.code),
        csvCell(o.createdAt.toISOString()),
        csvCell(o.channel),
        csvCell(o.table?.name ?? "-"),
        csvCell(o.customerName ?? "-"),
        csvCell(o.status),
        csvCell(o.paymentMethod ?? "-"),
        csvCell(o.couponCode ?? "-"),
        csvCell(o.items.map((i) => `${i.qty}x ${i.productName}`).join(" | ")),
        csvCell(o.subtotal.toFixed(2).replace(".", ",")),
        csvCell(o.discount.toFixed(2).replace(".", ",")),
        csvCell(o.serviceFee.toFixed(2).replace(".", ",")),
        csvCell(o.deliveryFee.toFixed(2).replace(".", ",")),
        csvCell(o.deliveryNeighborhood ?? "-"),
        csvCell(o.total.toFixed(2).replace(".", ",")),
      ].join(";"),
    );

    const csv = `\uFEFF${[header, ...rows].join("\n")}`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="forno-e-mesa-pedidos.csv"',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao exportar CSV.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
