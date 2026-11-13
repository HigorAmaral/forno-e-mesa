import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateCakeOrderSchema } from "@/lib/schemas";
import { generateCakeCode } from "@/lib/workspace-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CreateCakeOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados da encomenda inválidos." }, { status: 400 });
    }

    const code = await generateCakeCode();
    const cake = await prisma.cakeCustomOrder.create({
      data: {
        code,
        customerName: parsed.data.customerName.trim(),
        customerPhone: parsed.data.customerPhone.trim(),
        title: parsed.data.title.trim(),
        weightKg: parsed.data.weightKg,
        flavor: parsed.data.flavor.trim(),
        filling: parsed.data.filling.trim(),
        themeNotes: parsed.data.themeNotes?.trim() || null,
        deliveryDate: parsed.data.deliveryDate,
        deliverySlot: parsed.data.deliverySlot ?? "14:00",
        totalPrice: parsed.data.totalPrice,
        depositPaid: parsed.data.depositPaid ?? 0,
        status: "CONFIRMADA",
      },
    });

    return NextResponse.json({ cake }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao criar encomenda.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
