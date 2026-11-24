"use client";

import { useEffect } from "react";
import { Printer, X } from "lucide-react";
import { channelLabel, formatBRL } from "@/lib/domain";
import type { OrderDto, SplitPaymentPart } from "@/types/erp";

interface ReceiptModalProps {
  order: OrderDto | null;
  onClose: () => void;
}

function parseSplitParts(raw: string | null | undefined): SplitPaymentPart[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SplitPaymentPart[]) : [];
  } catch {
    return [];
  }
}

export function ReceiptModal({ order, onClose }: ReceiptModalProps) {
  useEffect(() => {
    if (!order) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [order, onClose]);

  if (!order) return null;

  const splitParts = parseSplitParts(order.splitPayments);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={`Cupom ${order.code}`}
      onClick={onClose}
    >
      <div
        className="card-bistro animate-scale-in max-h-[92vh] w-full max-w-sm overflow-y-auto p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
            Comanda / Cupom 80mm
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn"
            aria-label="Fechar cupom"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          id="thermal-receipt-print"
          className="font-mono-num mx-auto rounded-lg border border-dashed border-stone-300 bg-[#FAF9F6] p-4 text-xs text-stone-900"
        >
          <div className="border-b border-dashed border-stone-300 pb-2 text-center">
            <p className="text-sm font-bold tracking-wide">FORNO &amp; MESA GASTRONOMIA</p>
            <p className="text-[11px] text-stone-600">
              Padaria · Confeitaria · Restaurante
            </p>
            <p className="mt-1 text-[11px]">DOCUMENTO NÃO FISCAL</p>
          </div>

          <div className="my-2 space-y-0.5 border-b border-dashed border-stone-300 pb-2 text-[11px]">
            <div className="flex justify-between">
              <span>Pedido:</span>
              <span className="font-bold">{order.code}</span>
            </div>
            <div className="flex justify-between">
              <span>Canal:</span>
              <span>
                {order.table ? `${order.table.name} (${order.channel})` : channelLabel(order.channel)}
              </span>
            </div>
            {order.customerName && (
              <div className="flex justify-between">
                <span>Cliente:</span>
                <span>{order.customerName}</span>
              </div>
            )}
            {order.customerPhone && (
              <div className="flex justify-between">
                <span>Telefone:</span>
                <span>{order.customerPhone}</span>
              </div>
            )}
            {order.operatorName && (
              <div className="flex justify-between">
                <span>Operador:</span>
                <span>{order.operatorName}</span>
              </div>
            )}
            {order.scheduledFor && (
              <div className="flex justify-between">
                <span>Agendado:</span>
                <span>{order.scheduledFor}</span>
              </div>
            )}
            {order.deliveryAddress && (
              <div className="pt-1 text-[10px]">
                <span className="font-bold">Entrega: </span>
                <span>
                  {order.deliveryAddress}
                  {order.deliveryNeighborhood ? ` · ${order.deliveryNeighborhood}` : ""}
                </span>
                {order.deliveryReference && (
                  <p className="text-stone-600">Ref: {order.deliveryReference}</p>
                )}
              </div>
            )}
            {order.courierName && (
              <div className="flex justify-between">
                <span>Entregador:</span>
                <span>{order.courierName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Data:</span>
              <span>{new Date(order.createdAt).toLocaleString("pt-BR")}</span>
            </div>
          </div>

          <div className="my-2 space-y-1.5 border-b border-dashed border-stone-300 pb-2">
            <div className="flex justify-between text-[10px] font-bold uppercase text-stone-600">
              <span>Item / Qtd</span>
              <span>Total</span>
            </div>
            {order.items.map((item) => (
              <div key={item.id} className="space-y-0.5">
                <div className="flex justify-between gap-2">
                  <span className="truncate font-medium">{item.productName}</span>
                  <span>{formatBRL(item.totalPrice)}</span>
                </div>
                <div className="text-[10px] text-stone-600">
                  {item.qty} × {formatBRL(item.unitPrice)}
                  {item.notes ? ` · Obs: ${item.notes}` : ""}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatBRL(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Desconto{order.couponCode ? ` (${order.couponCode})` : ""}</span>
                <span>- {formatBRL(order.discount)}</span>
              </div>
            )}
            {order.serviceFee > 0 && (
              <div className="flex justify-between">
                <span>Serviço</span>
                <span>{formatBRL(order.serviceFee)}</span>
              </div>
            )}
            {order.deliveryFee > 0 && (
              <div className="flex justify-between">
                <span>Taxa de Entrega</span>
                <span>{formatBRL(order.deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-dashed border-stone-300 pt-1.5 text-sm font-bold">
              <span>TOTAL</span>
              <span>{formatBRL(order.total)}</span>
            </div>
            <div className="flex justify-between pt-1 text-[11px] text-stone-600">
              <span>Pagamento:</span>
              <span>{order.paymentMethod ?? order.status}</span>
            </div>
            {splitParts.length > 0 && (
              <div className="space-y-0.5 rounded bg-stone-100 p-1.5 text-[10px] text-stone-700">
                {splitParts.map((part, idx) => (
                  <div key={`${part.method}-${idx}`} className="flex justify-between">
                    <span>{part.method}</span>
                    <span>{formatBRL(part.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            {order.changeFor && (
              <div className="flex justify-between text-[11px] text-stone-600">
                <span>Troco para:</span>
                <span>{formatBRL(order.changeFor)}</span>
              </div>
            )}
          </div>

          <p className="mt-3 border-t border-dashed border-stone-300 pt-2 text-center text-[10px] text-stone-600">
            Obrigado pela preferência! Volte sempre.
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-primary flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
          >
            <Printer className="h-4 w-4" />
            Imprimir 80mm
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--border-warm)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-canvas)]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
