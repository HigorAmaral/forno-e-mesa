"use client";

import { Printer, X } from "lucide-react";
import { channelLabel, formatBRL } from "@/lib/domain";
import type { OrderDto } from "@/types/erp";

interface ReceiptModalProps {
  order: OrderDto | null;
  onClose: () => void;
}

export function ReceiptModal({ order, onClose }: ReceiptModalProps) {
  if (!order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-[#0f172a]">
            Comanda / Cupom 80mm
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#475569] hover:bg-[#f1f5f9]"
            aria-label="Fechar cupom"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          id="thermal-receipt-print"
          className="font-mono-num mx-auto rounded-lg border border-dashed border-[#cbbba7] bg-[#fffdf7] p-4 text-xs text-[#0f172a]"
        >
          <div className="border-b border-dashed border-[#cbbba7] pb-2 text-center">
            <p className="text-sm font-bold tracking-wide">FORNO & MESA GASTRONOMIA</p>
            <p className="text-[11px] text-[#475569]">
              Padaria · Confeitaria · Restaurante
            </p>
            <p className="mt-1 text-[11px]">DOCUMENTO NÃO FISCAL</p>
          </div>

          <div className="my-2 space-y-0.5 border-b border-dashed border-[#cbbba7] pb-2 text-[11px]">
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
            {order.deliveryAddress && (
              <div className="pt-1 text-[10px]">
                <span className="font-bold">Entrega: </span>
                <span>
                  {order.deliveryAddress}
                  {order.deliveryNeighborhood ? ` · ${order.deliveryNeighborhood}` : ""}
                </span>
                {order.deliveryReference && (
                  <p className="text-[#475569]">Ref: {order.deliveryReference}</p>
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

          <div className="my-2 space-y-1.5 border-b border-dashed border-[#cbbba7] pb-2">
            <div className="flex justify-between text-[10px] font-bold uppercase text-[#475569]">
              <span>Item / Qtd</span>
              <span>Total</span>
            </div>
            {order.items.map((item) => (
              <div key={item.id} className="space-y-0.5">
                <div className="flex justify-between gap-2">
                  <span className="truncate font-medium">{item.productName}</span>
                  <span>{formatBRL(item.totalPrice)}</span>
                </div>
                <div className="text-[10px] text-[#475569]">
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
              <div className="flex justify-between text-[#15803d]">
                <span>Desconto</span>
                <span>- {formatBRL(order.discount)}</span>
              </div>
            )}
            {order.serviceFee > 0 && (
              <div className="flex justify-between">
                <span>Serviço (10%)</span>
                <span>{formatBRL(order.serviceFee)}</span>
              </div>
            )}
            {order.deliveryFee > 0 && (
              <div className="flex justify-between">
                <span>Taxa de Entrega</span>
                <span>{formatBRL(order.deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-dashed border-[#cbbba7] pt-1.5 text-sm font-bold">
              <span>TOTAL</span>
              <span>{formatBRL(order.total)}</span>
            </div>
            <div className="flex justify-between pt-1 text-[11px] text-[#475569]">
              <span>Pagamento:</span>
              <span>{order.paymentMethod ?? order.status}</span>
            </div>
            {order.changeFor && (
              <div className="flex justify-between text-[11px] text-[#475569]">
                <span>Troco para:</span>
                <span>{formatBRL(order.changeFor)}</span>
              </div>
            )}
          </div>

          <p className="mt-3 border-t border-dashed border-[#cbbba7] pt-2 text-center text-[10px] text-[#475569]">
            Obrigado pela preferência! Volte sempre.
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
          >
            <Printer className="h-4 w-4" />
            Imprimir 80mm
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-sm font-medium text-[#0f172a] hover:bg-[#f1f5f9]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
