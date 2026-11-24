export type StaffRole = "ADMIN" | "GERENTE" | "CAIXA" | "GARCOM" | "COZINHA";

export interface OperatorSessionDto {
  userId: number;
  name: string;
  email: string;
  role: StaffRole;
  isLocalAuto?: boolean;
}

export interface StaffUserDto {
  id: number;
  name: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  hasPin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface StoreSettingsDto {
  id: number;
  storeName: string;
  slogan: string;
  phone: string;
  address: string;
  openingHours: string;
  isDeliveryOpen: boolean;
  dailyGoal: number;
  defaultServiceFeePct: number;
  freeDeliveryAbove: number;
  creditCardFeePct: number;
  debitCardFeePct: number;
  updatedAt: string;
}

export interface PromoCouponDto {
  id: number;
  code: string;
  label: string;
  type: "PERCENT" | "FIXED" | "FREE_DELIVERY";
  value: number;
  maxDiscount: number | null;
  minOrder: number;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
}

export interface TableReservationDto {
  id: number;
  tableId: number | null;
  table: DiningTableSummary | null;
  customerName: string;
  customerPhone: string;
  partySize: number;
  reservedFor: string;
  status: string; // CONFIRMADA | SENTADA | CANCELADA | CONCLUIDA
  notes: string | null;
  createdAt: string;
}

export interface OrderReviewDto {
  id: number;
  orderId: number;
  rating: number;
  comment: string | null;
  customerName: string | null;
  createdAt: string;
  order?: {
    code: string;
    channel: string;
  };
}

export interface AuditLogDto {
  id: number;
  actorName: string;
  actorRole: string;
  action: string;
  entity: string | null;
  details: string | null;
  createdAt: string;
}

export interface SplitPaymentPart {
  method: "DINHEIRO" | "PIX" | "CREDITO" | "DEBITO";
  amount: number;
}

export interface CategoryDto {
  id: number;
  name: string;
  slug: string;
  sector: string;
  sortOrder: number;
}

export interface IngredientDto {
  id: number;
  name: string;
  unit: string;
  currentQty: number;
  minQty: number;
  costPerUnit: number;
  supplierName: string | null;
}

export interface RecipeItemDto {
  id: number;
  productId: number;
  ingredientId: number;
  qtyRequired: number;
  ingredient: IngredientDto;
}

export interface ProductDto {
  id: number;
  sku: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  price: number;
  unit: string;
  prepStation: string;
  prepTimeMinutes: number;
  isAvailable: boolean;
  isFeatured: boolean;
  trackStock: boolean;
  stockQty: number;
  minStockQty: number;
  categoryId: number;
  category: CategoryDto;
  recipeItems?: RecipeItemDto[];
}

export interface OrderItemDto {
  id: number;
  orderId: number;
  productId: number | null;
  productName: string;
  prepStation: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  itemStatus: string;
  notes: string | null;
}

export interface DiningTableSummary {
  id: number;
  number: number;
  name: string;
  area: string;
  capacity: number;
  status: string;
  qrToken: string;
  waiterCalledAt: string | null;
}

export interface OrderDto {
  id: number;
  code: string;
  channel: string;
  status: string;
  tableId: number | null;
  table: DiningTableSummary | null;
  customerName: string | null;
  customerPhone: string | null;
  paymentMethod: string | null;
  subtotal: number;
  discount: number;
  serviceFee: number;
  total: number;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
  items: OrderItemDto[];
  deliveryFee: number;
  deliveryStatus: string | null;
  deliveryAddress: string | null;
  deliveryNeighborhood: string | null;
  deliveryReference: string | null;
  deliveryZoneId: number | null;
  courierName: string | null;
  changeFor: number | null;
  estimatedMinutes: number | null;
  trackingToken: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  scheduledFor: string | null;
  couponCode: string | null;
  splitPayments: string | null;
  operatorName: string | null;
  review?: OrderReviewDto | null;
}

export interface DeliveryZoneDto {
  id: number;
  name: string;
  fee: number;
  etaMinutes: number;
  minOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface TableWithOrdersDto extends DiningTableSummary {
  orders: Array<{
    id: number;
    code: string;
    channel: string;
    status: string;
    customerName: string | null;
    subtotal: number;
    discount: number;
    serviceFee: number;
    total: number;
    createdAt: string;
    items: OrderItemDto[];
  }>;
}

export interface BakeryBatchDto {
  id: number;
  productId: number;
  productName: string;
  plannedQty: number;
  producedQty: number;
  status: string;
  bakeTime: string;
  notes: string | null;
  createdAt: string;
}

export interface CakeOrderDto {
  id: number;
  code: string;
  customerName: string;
  customerPhone: string;
  title: string;
  weightKg: number;
  flavor: string;
  filling: string;
  themeNotes: string | null;
  deliveryDate: string;
  deliverySlot: string;
  totalPrice: number;
  depositPaid: number;
  status: string;
  createdAt: string;
}

export interface CashMovementDto {
  id: number;
  sessionId: number;
  type: string;
  paymentMethod: string;
  amount: number;
  description: string;
  createdAt: string;
}

export interface CashSessionDto {
  id: number;
  openedBy: string;
  openingAmount: number;
  expectedAmount: number;
  closingAmount: number | null;
  status: string;
  openedAt: string;
  closedAt: string | null;
  movements: CashMovementDto[];
}

export interface CustomerProfileDto {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  favoriteItem: string | null;
  loyaltyPoints: number;
  totalSpent: number;
  visitsCount: number;
  notes: string | null;
  defaultAddress: string | null;
  defaultNeighborhood: string | null;
  defaultReference: string | null;
  createdAt: string;
}

export interface ShiftNoteDto {
  id: number;
  author: string;
  content: string;
  priority: string;
  isDone: boolean;
  createdAt: string;
}

export interface FinancialEntryDto {
  id: number;
  type: string;
  category: string;
  description: string;
  counterparty: string | null;
  amount: number;
  dueDate: string;
  status: string;
  paymentMethod: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface WorkspaceSnapshotDto {
  categories: CategoryDto[];
  products: ProductDto[];
  ingredients: IngredientDto[];
  tables: TableWithOrdersDto[];
  orders: OrderDto[];
  batches: BakeryBatchDto[];
  cakeOrders: CakeOrderDto[];
  openCashSession: CashSessionDto | null;
  cashSessions: CashSessionDto[];
  customers: CustomerProfileDto[];
  shiftNotes: ShiftNoteDto[];
  financialEntries: FinancialEntryDto[];
  deliveryZones: DeliveryZoneDto[];
  storeSettings: StoreSettingsDto;
  staffUsers: StaffUserDto[];
  coupons: PromoCouponDto[];
  reservations: TableReservationDto[];
  reviews: OrderReviewDto[];
  auditLogs: AuditLogDto[];
  metrics: {
    revenueToday: number;
    paidCount: number;
    avgTicket: number;
    activeOrdersCount: number;
    occupiedTables: number;
    totalTables: number;
    lowStockAlerts: number;
    activeCakeOrders: number;
    kdsPendingCount: number;
    activeDeliveries: number;
    deliveryRevenue: number;
    waiterCallsCount: number;
    averageRating: number;
    reviewsCount: number;
  };
}
