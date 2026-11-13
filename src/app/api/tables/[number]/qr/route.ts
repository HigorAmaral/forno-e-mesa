import os from "node:os";
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import { buildTableQrPath, resolveQrOrigin } from "@/lib/domain";

export const dynamic = "force-dynamic";

function detectLanIpv4(): string | null {
  const interfaces = os.networkInterfaces();
  const candidates: string[] = [];

  for (const entries of Object.values(interfaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family === "IPv4" && !entry.internal) {
        candidates.push(entry.address);
      }
    }
  }

  const privateLan = candidates.find(
    (ip) =>
      ip.startsWith("192.168.") ||
      ip.startsWith("10.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip),
  );
  return privateLan ?? candidates[0] ?? null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ number: string }> },
) {
  try {
    await ensureSeeded();
    const { number } = await context.params;
    const tableNumber = Number(number);
    const table = await prisma.diningTable.findUnique({ where: { number: tableNumber } });
    if (!table) {
      return NextResponse.json({ error: "Mesa não encontrada." }, { status: 404 });
    }

    const url = new URL(request.url);
    const lanIp = detectLanIpv4();
    const portPart = url.port ? `:${url.port}` : "";
    const lanOrigin = lanIp ? `${url.protocol}//${lanIp}${portPart}` : null;
    const customBaseUrl = url.searchParams.get("baseUrl");
    const chosenOrigin = resolveQrOrigin({
      requestOrigin: url.origin,
      lanIp,
      customBaseUrl,
    });

    const qrPath = buildTableQrPath(table.number, table.qrToken);
    const targetUrl = `${chosenOrigin}${qrPath}`;

    const [pngDataUrl, svg] = await Promise.all([
      QRCode.toDataURL(targetUrl, {
        width: 320,
        margin: 3,
        errorCorrectionLevel: "M",
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      }),
      QRCode.toString(targetUrl, {
        type: "svg",
        width: 320,
        margin: 3,
        errorCorrectionLevel: "M",
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      }),
    ]);

    return NextResponse.json({
      tableNumber: table.number,
      tableName: table.name,
      qrPath,
      targetUrl,
      requestOrigin: url.origin,
      lanOrigin,
      pngDataUrl,
      svg,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao gerar QR Code.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
