import { z } from "zod";

export const CreateOrderSchema = z.object({
  channel: z.enum(["PDV_BALCAO", "MESA", "QR_MESA", "ENCOMENDA"]),
  tableNumber: z.number().int().positive().optional(),
  qrToken: z.string().min(4).optional(),
  customerId: z.number().int().positive().optional(),
  customerName: z.string().max(120).optional(),
  customerPhone: z.string().max(40).optional(),
  redeemLoyaltyPoints: z.boolean().optional(),
  discount: z.number().min(0).max(50000).optional(),
  applyServiceFee: z.boolean().optional(),
  notes: z.string().max(500).optional(),
  payNow: z.boolean().optional(),
  paymentMethod: z.enum(["DINHEIRO", "PIX", "CREDITO", "DEBITO"]).optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        qty: z.number().positive().max(1000),
        notes: z.string().max(240).optional(),
      }),
    )
    .min(1),
});

export const CheckoutOrderSchema = z.object({
  paymentMethod: z.enum(["DINHEIRO", "PIX", "CREDITO", "DEBITO"]),
  discount: z.number().min(0).max(50000).optional(),
  applyServiceFee: z.boolean().optional(),
});

export const UpdateOrderItemStatusSchema = z.object({
  itemStatus: z.enum(["PENDENTE", "PREPARANDO", "PRONTO", "ENTREGUE"]),
});

export const CreateCakeOrderSchema = z.object({
  customerName: z.string().min(2).max(120),
  customerPhone: z.string().min(6).max(40),
  title: z.string().min(3).max(160),
  weightKg: z.number().positive().max(100),
  flavor: z.string().min(2).max(120),
  filling: z.string().min(2).max(120),
  themeNotes: z.string().max(400).optional(),
  deliveryDate: z.string().min(8).max(30),
  deliverySlot: z.string().min(3).max(20).optional(),
  totalPrice: z.number().positive().max(100000),
  depositPaid: z.number().min(0).max(100000).optional(),
});

export const UpdateCakeStatusSchema = z.object({
  status: z.enum(["ORCAMENTO", "CONFIRMADA", "PRODUCAO", "PRONTA", "ENTREGUE"]),
  depositPaid: z.number().min(0).max(100000).optional(),
});

export const CreateBatchSchema = z.object({
  productId: z.number().int().positive(),
  plannedQty: z.number().positive().max(5000),
  bakeTime: z.string().min(3).max(20),
  notes: z.string().max(240).optional(),
});

export const UpdateBatchSchema = z.object({
  status: z.enum(["AGENDADA", "NO_FORNO", "PRONTA"]),
  producedQty: z.number().min(0).max(5000).optional(),
});

export const IngredientAdjustSchema = z.object({
  deltaQty: z.number().min(-10000).max(10000),
});

export const CreateProductSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().min(2).max(300),
  price: z.number().positive().max(50000),
  unit: z.enum(["UN", "KG", "FATIA", "PORCAO"]),
  prepStation: z.enum(["BALCAO", "FORNO", "CONFEITARIA", "COZINHA", "BAR"]),
  prepTimeMinutes: z.number().int().min(1).max(180).default(8),
  categoryId: z.number().int().positive(),
  stockQty: z.number().min(0).max(10000).default(20),
  minStockQty: z.number().min(0).max(1000).default(5),
});

export const ToggleProductSchema = z.object({
  isAvailable: z.boolean().optional(),
  stockQty: z.number().min(0).max(10000).optional(),
  price: z.number().positive().max(50000).optional(),
});

export const CashActionSchema = z.object({
  action: z.enum(["OPEN", "CLOSE", "MOVEMENT"]),
  openedBy: z.string().min(2).max(80).optional(),
  openingAmount: z.number().min(0).max(100000).optional(),
  closingAmount: z.number().min(0).max(500000).optional(),
  movementType: z.enum(["SANGRIA", "SUPRIMENTO"]).optional(),
  amount: z.number().positive().max(100000).optional(),
  description: z.string().max(240).optional(),
});

export const TableActionSchema = z.object({
  status: z.enum(["LIVRE", "OCUPADA", "RESERVADA", "CONTA"]),
  qrToken: z.string().min(4).optional(),
});

export const OrderManageSchema = z.object({
  action: z.enum(["CANCEL", "TRANSFER"]),
  targetTableNumber: z.number().int().positive().optional(),
});

export const CreateIngredientSchema = z.object({
  kind: z.literal("ingredient"),
  name: z.string().min(2).max(120),
  unit: z.enum(["KG", "L", "UN", "G", "ML"]),
  currentQty: z.number().min(0).max(50000),
  minQty: z.number().min(0).max(10000),
  costPerUnit: z.number().min(0).max(50000),
  supplierName: z.string().max(120).optional(),
});

export const CreateCustomerSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().min(6).max(40),
  email: z.string().max(120).optional(),
  favoriteItem: z.string().max(120).optional(),
  notes: z.string().max(300).optional(),
});

export const CreateTableSchema = z.object({
  number: z.number().int().positive().max(200),
  name: z.string().min(2).max(60),
  area: z.enum(["SALAO", "VARANDA", "BALCAO"]),
  capacity: z.number().int().min(1).max(30),
});

export const CreateShiftNoteSchema = z.object({
  author: z.string().min(2).max(60),
  content: z.string().min(2).max(280),
  priority: z.enum(["NORMAL", "IMPORTANTE"]).default("NORMAL"),
});

export const CreateFinancialEntrySchema = z.object({
  type: z.enum(["RECEITA", "DESPESA"]),
  category: z.enum([
    "FORNECEDOR",
    "ALUGUEL",
    "FOLHA",
    "ENERGIA",
    "IMPOSTOS",
    "VENDAS_EXTRA",
    "OUTROS",
  ]),
  description: z.string().min(2).max(200),
  counterparty: z.string().max(120).optional(),
  amount: z.number().positive().max(1000000),
  dueDate: z.string().min(8).max(20),
  status: z.enum(["PENDENTE", "PAGO", "ATRASADO"]).default("PENDENTE"),
  paymentMethod: z
    .enum(["PIX", "BOLETO", "TRANSFERENCIA", "DINHEIRO", "CREDITO", "DEBITO"])
    .optional(),
  notes: z.string().max(300).optional(),
});

export const UpdateFinancialEntrySchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(["PENDENTE", "PAGO", "ATRASADO"]),
  paymentMethod: z
    .enum(["PIX", "BOLETO", "TRANSFERENCIA", "DINHEIRO", "CREDITO", "DEBITO"])
    .optional(),
});
