import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { isErpAllowedContext, OPERATOR_COOKIE_NAME } from "./access-policy";

export {
  buildOperatorToken,
  getOperatorPin,
  OPERATOR_COOKIE_NAME,
} from "./access-policy";

export async function isServerErpAuthorized(): Promise<boolean> {
  const hdrs = await headers();
  const cookieStore = await cookies();
  return isErpAllowedContext({
    host: hdrs.get("x-forwarded-host") ?? hdrs.get("host"),
    userAgent: hdrs.get("user-agent"),
    cookieToken: cookieStore.get(OPERATOR_COOKIE_NAME)?.value,
  });
}

export async function forbiddenIfNotErpOperator(): Promise<NextResponse | null> {
  const allowed = await isServerErpAuthorized();
  if (!allowed) {
    return NextResponse.json(
      { error: "Acesso restrito ao painel interno." },
      { status: 403 },
    );
  }
  return null;
}
