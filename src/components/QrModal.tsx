"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Printer,
  QrCode,
  RefreshCw,
  Smartphone,
  X,
} from "lucide-react";

interface QrModalProps {
  tableNumber: number | null;
  onClose: () => void;
  onRotated?: () => Promise<void>;
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

export function QrModal({ tableNumber, onClose, onRotated }: QrModalProps) {
  if (!tableNumber) return null;
  return (
    <QrModalInner
      key={tableNumber}
      tableNumber={tableNumber}
      onClose={onClose}
      onRotated={onRotated}
    />
  );
}

function QrModalInner({
  tableNumber,
  onClose,
  onRotated,
}: {
  tableNumber: number;
  onClose: () => void;
  onRotated?: () => Promise<void>;
}) {
  const [data, setData] = useState<QrResponse | null>(null);
  const [customBaseUrl, setCustomBaseUrl] = useState<string>("");
  const [appliedBaseUrl, setAppliedBaseUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let active = true;

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
        if (active) setData(json);
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
  }, [tableNumber, appliedBaseUrl, refreshKey]);

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

  async function handleRotateToken() {
    if (!tableNumber || rotating) return;
    setRotating(true);
    setError(null);
    try {
      const res = await fetch(`/api/tables/${tableNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ROTATE_QR" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao rotacionar token QR.");
        return;
      }
      setRefreshKey((k) => k + 1);
      if (onRotated) await onRotated();
    } finally {
      setRotating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={`QR Code Mesa ${tableNumber}`}
      onClick={onClose}
    >
      <div
        className="card-bistro animate-scale-in max-h-[92vh] w-full max-w-md overflow-y-auto p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[var(--accent-primary)]" />
            <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
              QR Code · {data?.tableName ?? `Mesa ${tableNumber}`}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn"
            aria-label="Fechar QR Code"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-xs leading-relaxed text-[var(--text-secondary)]">
          Escaneie pelo celular na mesma rede Wi-Fi ou configure sua URL pública.
        </p>

        {error ? (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs text-red-800">
            {error}
          </div>
        ) : loading || !data ? (
          <div className="flex h-64 items-center justify-center rounded-xl bg-[var(--bg-canvas)] text-sm text-[var(--text-secondary)]">
            Gerando QR Code...
          </div>
        ) : (
          <div className="space-y-4">
            <div
              id="qr-table-print"
              className="flex flex-col items-center rounded-2xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-4 text-center"
            >
              <p className="font-display text-sm font-bold text-[var(--text-primary)]">
                Forno & Mesa · Cardápio Digital
              </p>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
                {data.tableName}
              </p>
              <div className="overflow-hidden rounded-xl bg-white p-2 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={data.pngDataUrl}
                  alt={`QR Code ${data.tableName}`}
                  width={220}
                  height={220}
                  className="h-48 w-48 object-contain"
                />
              </div>
              <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
                Aponte a câmera do celular para fazer pedidos ou chamar o garçom.
              </p>
              <div className="mt-2 flex w-full items-center gap-1.5 rounded-lg border border-[var(--border-warm)] bg-[var(--bg-surface)] px-2.5 py-1.5 print:hidden">
                <code className="flex-1 truncate text-[11px] text-[var(--text-primary)]">
                  {data.targetUrl}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="icon-btn shrink-0 p-1"
                  title="Copiar link"
                  aria-label="Copiar link do QR Code"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3">
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
                        ? "bg-[var(--bg-shell)] text-[#FAF3E8]"
                        : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"
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
                      ? "bg-[var(--bg-shell)] text-[#FAF3E8]"
                      : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                  }`}
                >
                  Este PC
                </button>
                <button
                  type="button"
                  disabled={rotating}
                  onClick={handleRotateToken}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg border border-[var(--border-warm)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:border-[var(--accent-primary)] disabled:opacity-50"
                  title="Invalida o QR anterior e gera um novo token de segurança"
                >
                  <RefreshCw className={`h-3 w-3 ${rotating ? "animate-spin" : ""}`} />
                  Novo Token
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
                  className="input-field flex-1 py-1 text-[11px]"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[var(--bg-shell)] px-2.5 py-1 text-[11px] font-semibold text-[#FAF3E8]"
                >
                  Aplicar
                </button>
              </form>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex">
              <a
                href={data.qrPath}
                target="_blank"
                rel="noreferrer"
                className="btn-primary col-span-2 flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir Cardápio
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] px-3 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
              >
                <Printer className="h-4 w-4" />
                Imprimir Placa
              </button>
              <button
                type="button"
                onClick={handleDownloadSvg}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] px-3 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
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
