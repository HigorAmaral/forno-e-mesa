"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Download, ExternalLink, QrCode, Smartphone, X } from "lucide-react";

interface QrModalProps {
  tableNumber: number | null;
  onClose: () => void;
}

interface QrResponse {
  tableNumber: number;
  tableName: string;
  qrPath: string;
  targetUrl: string;
  requestOrigin: string;
  lanOrigin: string | null;
  pngDataUrl: string;
  svg: string;
}

export function QrModal({ tableNumber, onClose }: QrModalProps) {
  const [data, setData] = useState<QrResponse | null>(null);
  const [customBaseUrl, setCustomBaseUrl] = useState<string>("");
  const [appliedBaseUrl, setAppliedBaseUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!tableNumber) {
      setData(null);
      setError(null);
      setCustomBaseUrl("");
      setAppliedBaseUrl("");
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    const qs = appliedBaseUrl
      ? `?baseUrl=${encodeURIComponent(appliedBaseUrl)}`
      : "";

    fetch(`/api/tables/${tableNumber}/qr${qs}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error ?? "Não foi possível gerar o QR Code.");
        }
        return json as QrResponse;
      })
      .then((json) => {
        if (active) {
          setData(json);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Erro ao gerar QR Code.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [tableNumber, appliedBaseUrl]);

  if (!tableNumber) return null;

  function handleDownloadSvg() {
    if (!data) return;
    const blob = new Blob([data.svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qrcode-mesa-${data.tableNumber}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopy() {
    if (!data) return;
    await navigator.clipboard.writeText(data.targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[#2563eb]" />
            <h3 className="font-display text-lg font-bold text-[#0f172a]">
              QR Code · {data?.tableName ?? `Mesa ${tableNumber}`}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#475569] hover:bg-[#f1f5f9]"
            aria-label="Fechar QR Code"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-xs leading-relaxed text-[#475569]">
          Para testar no celular conectado ao mesmo Wi-Fi, o QR usa automaticamente o IP
          da rede local em vez de <code className="rounded bg-[#f1f5f9] px-1">localhost</code>.
        </p>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
            {error}
          </div>
        ) : loading || !data ? (
          <div className="flex h-64 items-center justify-center rounded-xl bg-[#f8fafc] text-sm text-[#475569]">
            Gerando QR Code...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
              <div className="overflow-hidden rounded-xl bg-white p-2 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={data.pngDataUrl}
                  alt={`QR Code ${data.tableName}`}
                  width={220}
                  height={220}
                  className="h-52 w-52 object-contain"
                />
              </div>
              <span className="mt-2.5 text-xs font-semibold uppercase tracking-wider text-[#2563eb]">
                {data.tableName} · Cardápio Digital
              </span>
              <div className="mt-1.5 flex w-full items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5">
                <code className="flex-1 truncate text-[11px] text-[#0f172a]">
                  {data.targetUrl}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 rounded p-1 text-[#475569] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
                  title="Copiar link"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-[#15803d]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Host / Network selector */}
            <div className="space-y-2 rounded-xl border border-[#f1f5f9] bg-[#f8fafc] p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {data.lanOrigin && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomBaseUrl("");
                      setAppliedBaseUrl(data.lanOrigin!);
                    }}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                      data.targetUrl.startsWith(data.lanOrigin)
                        ? "bg-[#0f172a] text-white"
                        : "bg-white text-[#475569]"
                    }`}
                  >
                    <Smartphone className="h-3 w-3" /> Wi-Fi ({data.lanOrigin.replace(/^https?:\/\//, "")})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setCustomBaseUrl("");
                    setAppliedBaseUrl(data.requestOrigin);
                  }}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                    data.targetUrl.startsWith(data.requestOrigin)
                      ? "bg-[#0f172a] text-white"
                      : "bg-white text-[#475569]"
                  }`}
                >
                  Este PC
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (customBaseUrl.trim()) setAppliedBaseUrl(customBaseUrl.trim());
                }}
                className="flex gap-1.5"
              >
                <input
                  type="url"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  placeholder="Ou cole URL pública (ex: https://seu-site.vercel.app)"
                  className="flex-1 rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1 text-[11px] outline-none focus:border-[#2563eb]"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#0f172a] px-2.5 py-1 text-[11px] font-semibold text-white"
                >
                  Aplicar
                </button>
              </form>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={data.qrPath}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir Cardápio da Mesa
              </a>
              <button
                type="button"
                onClick={handleDownloadSvg}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-sm font-semibold text-[#0f172a] hover:bg-[#f1f5f9]"
              >
                <Download className="h-4 w-4" />
                SVG
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
