import { redirect } from "next/navigation";
import { getServerOperatorSession } from "@/lib/access-guard";

export const dynamic = "force-dynamic";

export default async function ErpAliasPage() {
  const session = await getServerOperatorSession();
  if (!session) {
    redirect("/login?next=/&reason=auth");
  }
  redirect("/");
}
