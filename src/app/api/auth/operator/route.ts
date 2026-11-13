import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildOperatorToken,
  getOperatorPin,
  OPERATOR_COOKIE_NAME,
} from "@/lib/access-guard";

const PinSchema = z.object({
  pin: z.string().min(2).max(32),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = PinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "PIN inválido." }, { status: 400 });
    }

    const expectedPin = getOperatorPin();
    if (parsed.data.pin.trim() !== expectedPin) {
      return NextResponse.json(
        { error: "PIN de operador incorreto." },
        { status: 401 },
      );
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(OPERATOR_COOKIE_NAME, buildOperatorToken(expectedPin), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return res;
  } catch {
    return NextResponse.json(
      { error: "Erro ao validar operador." },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OPERATOR_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
