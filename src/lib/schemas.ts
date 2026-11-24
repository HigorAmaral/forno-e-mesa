import { z } from "zod";
import { isSafeProductImageUrl } from "./domain";

export { isSafeProductImageUrl };

export const ProductImageUrlSchema = z
  .string()
  .max(450_000)
  .refine(isSafeProductImageUrl, "URL ou formato de imagem inválido.")
  .nullable()
  .optional();

export const PaymentMethodEnum = z.enum([
  "DINHEIRO",
  "PIX",
  "CREDITO",
  "DEBITO",
]);

export const SplitPaymentPartSchema = z.object({
  method: PaymentMethodEnum,
  amount: z.number().positive().max(500000),
});

export const CreateOrderSchema = z.object({
  channel: z.enum(["PDV_BALCAO", "MESA", "QR_MESA", "ENCOMENDA", "DELIVERY", "RETIRADA"]),
  tableNumber: z.number().int().positive().optional(),
  qrToken: z.string().min(4).optional(),
  customerId: z.number().int().positive().optional(),
  customerName: z.string().max(120).optional(),
  customerPhone: z.string().max(40).optional(),
  redeemLoyaltyPoints: z.boolean().optional(),
  discount: z.number().min(0).max(50000).optional(),
  couponCode: z.string().max(32).optional(),
  applyServiceFee: z.boolean().optional(),
  notes: z.string().max(500).optional(),
  scheduledFor: z.string().max(40).optional(),
  payNow: z.boolean().optional(),
  paymentMethod: z.enum(["DINHEIRO", "PIX", "CREDITO", "DEBITO", "MISTO"]).optional(),
  splitPayments: z.array(SplitPaymentPartSchema).min(1).max(6).optional(),
  delivery: z
    .object({
      zoneId: z.number().int().positive().optional(),
      address: z.string().max(240).optional(),
      neighborhood: z.string().max(120).optional(),
      reference: z.string().max(240).optional(),
      changeFor: z.number().min(0).max(10000).optional(),
    })
    .optional(),
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

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const CheckoutOrderSchema = z.object({
  paymentMethod: z.enum(["DINHEIRO", "PIX", "CREDITO", "DEBITO", "MISTO"]),
  splitPayments: z.array(SplitPaymentPartSchema).min(1).max(6).optional(),
  discount: z.number().min(0).max(50000).optional(),
  applyServiceFee: z.boolean().optional(),
});

export const UpdateOrderItemStatusSchema = z.object({
  itemStatus: z.enum(["PENDENTE", "PREPARANDO", "PRONTO", "ENTREGUE"]),
});

export const UpdateDeliverySchema = z.object({
  deliveryStatus: z
    .enum(["RECEBIDO", "EM_PREPARO", "PRONTO", "SAIU_ENTREGA", "ENTREGUE", "CANCELADO"])
    .optional(),
  courierName: z.string().max(80).optional(),
  advance: z.boolean().optional(),
});

export const DeliveryZoneSchema = z.object({
  name: z.string().min(2).max(80),
  fee: z.number().min(0).max(500),
  etaMinutes: z.number().int().min(5).max(240),
  minOrder: z.number().min(0).max(5000),
});

export const UpdateDeliveryZoneSchema = DeliveryZoneSchema.partial().extend({
  id: z.number().int().positive(),
  isActive: z.boolean().optional(),
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
  imageUrl: ProductImageUrlSchema,
  price: z.number().positive().max(50000),
  unit: z.enum(["UN", "KG", "FATIA", "PORCAO"]),
  prepStation: z.enum(["BALCAO", "FORNO", "CONFEITARIA", "COZINHA", "BAR"]),
  prepTimeMinutes: z.number().int().min(1).max(180).default(8),
  categoryId: z.number().int().positive(),
  isFeatured: z.boolean().optional(),
  stockQty: z.number().min(0).max(10000).default(20),
  minStockQty: z.number().min(0).max(1000).default(5),
});

export const ToggleProductSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().min(2).max(300).optional(),
  imageUrl: ProductImageUrlSchema,
  price: z.number().positive().max(50000).optional(),
  unit: z.enum(["UN", "KG", "FATIA", "PORCAO"]).optional(),
  prepStation: z.enum(["BALCAO", "FORNO", "CONFEITARIA", "COZINHA", "BAR"]).optional(),
  prepTimeMinutes: z.number().int().min(1).max(180).optional(),
  categoryId: z.number().int().positive().optional(),
  isAvailable: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  trackStock: z.boolean().optional(),
  stockQty: z.number().min(0).max(10000).optional(),
  minStockQty: z.number().min(0).max(1000).optional(),
});

export const CreateCategorySchema = z.object({
  kind: z.literal("category"),
  name: z.string().min(2).max(80),
  sector: z.enum(["PADARIA", "CONFEITARIA", "RESTAURANTE", "BEBIDAS"]),
});

export const UpsertRecipeSchema = z.object({
  kind: z.literal("recipe"),
  productId: z.number().int().positive(),
  items: z
    .array(
      z.object({
        ingredientId: z.number().int().positive(),
        qtyRequired: z.number().positive().max(1000),
      }),
    )
    .max(30),
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
  status: z.enum(["LIVRE", "OCUPADA", "RESERVADA", "CONTA"]).optional(),
  action: z.enum(["CALL_WAITER", "DISMISS_WAITER", "ROTATE_QR"]).optional(),
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

export const CreateStaffUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(120),
  role: z.enum(["ADMIN", "GERENTE", "CAIXA", "GARCOM", "COZINHA"]),
  password: z.string().min(4).max(80),
  pin: z.string().min(4).max(16).optional(),
});

export const UpdateStaffUserSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(2).max(100).optional(),
  role: z.enum(["ADMIN", "GERENTE", "CAIXA", "GARCOM", "COZINHA"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(4).max(80).optional(),
  pin: z.string().min(4).max(16).optional(),
});

export const UpdateStoreSettingsSchema = z.object({
  storeName: z.string().min(2).max(120).optional(),
  slogan: z.string().min(2).max(180).optional(),
  phone: z.string().min(6).max(40).optional(),
  address: z.string().min(4).max(200).optional(),
  openingHours: z.string().min(2).max(120).optional(),
  isDeliveryOpen: z.boolean().optional(),
  dailyGoal: z.number().min(100).max(1000000).optional(),
  defaultServiceFeePct: z.number().min(0).max(30).optional(),
  freeDeliveryAbove: z.number().min(0).max(5000).optional(),
  creditCardFeePct: z.number().min(0).max(15).optional(),
  debitCardFeePct: z.number().min(0).max(15).optional(),
});

export const PromoCouponSchema = z.object({
  code: z.string().min(3).max(32),
  label: z.string().min(2).max(120),
  type: z.enum(["PERCENT", "FIXED", "FREE_DELIVERY"]),
  value: z.number().min(0).max(50000),
  maxDiscount: z.number().min(0).max(50000).nullable().optional(),
  minOrder: z.number().min(0).max(50000).default(0),
});

export const UpdatePromoCouponSchema = z.object({
  id: z.number().int().positive(),
  isActive: z.boolean().optional(),
  label: z.string().min(2).max(120).optional(),
  value: z.number().min(0).max(50000).optional(),
  minOrder: z.number().min(0).max(50000).optional(),
});

export const CreateReservationSchema = z.object({
  tableId: z.number().int().positive().nullable().optional(),
  customerName: z.string().min(2).max(120),
  customerPhone: z.string().min(6).max(40),
  partySize: z.number().int().min(1).max(40),
  reservedFor: z.string().min(5).max(40),
  notes: z.string().max(300).optional(),
});

export const UpdateReservationSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(["CONFIRMADA", "SENTADA", "CANCELADA", "CONCLUIDA"]).optional(),
  tableId: z.number().int().positive().nullable().optional(),
});

export const CreateOrderReviewSchema = z.object({
  code: z.string().min(3).max(32),
  token: z.string().min(4).max(128),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(400).optional(),
});
