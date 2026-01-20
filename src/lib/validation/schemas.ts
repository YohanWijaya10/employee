import { z } from 'zod';

// ============================================
// Common Schemas
// ============================================

export const DateRangeSchema = z.object({
  from: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  to: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================
// Order Schemas
// ============================================

export const OrderStatusSchema = z.enum(['CREATED', 'READY_TO_SHIP', 'DELIVERED', 'CANCELLED']);

export const CancellationReasonSchema = z.enum([
  'CUSTOMER_REQUEST',
  'OUT_OF_STOCK',
  'PAYMENT_ISSUE',
  'DELIVERY_ISSUE',
  'DUPLICATE_ORDER',
  'PRICING_ERROR',
  'SALES_REP_ERROR',
  'OTHER',
]);

export const CreateOrderItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().positive(),
});

export const CreateOrderSchema = z.object({
  salesRepId: z.string().cuid(),
  outletId: z.string().cuid(),
  plannedShipDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(CreateOrderItemSchema).min(1),
});

export const UpdateOrderStatusSchema = z.object({
  orderId: z.string().cuid(),
  newStatus: OrderStatusSchema,
  // Required for cancellation
  cancellationReason: CancellationReasonSchema.optional(),
  cancellationNotes: z.string().optional(),
  cancelledBySalesRepId: z.string().cuid().optional(),
});

export const CancelOrderSchema = z.object({
  orderId: z.string().cuid(),
  reason: CancellationReasonSchema,
  notes: z.string().optional(),
  cancelledBySalesRepId: z.string().cuid().optional(),
});

// ============================================
// Query/Filter Schemas
// ============================================

export const MetricsQuerySchema = z.object({
  from: z.string(),
  to: z.string(),
  salesRepId: z.string().cuid().optional(),
  outletId: z.string().cuid().optional(),
});

export const FlagsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  entityType: z.enum(['SALES_REP', 'OUTLET', 'ORDER', 'PRODUCT', 'VISIT']).optional(),
  severity: z.enum(['INFO', 'WARN', 'HIGH']).optional(),
  ruleCode: z.string().optional(),
  isResolved: z.coerce.boolean().optional(),
});

export const AntiFraudSummaryRequestSchema = z.object({
  from: z.string(),
  to: z.string(),
  salesRepId: z.string().cuid().optional(),
  outletId: z.string().cuid().optional(),
});

// ============================================
// AI Response Schemas
// ============================================

export const AIHighlightSchema = z.object({
  type: z.string(),
  title: z.string(),
  description: z.string(),
  value: z.union([z.string(), z.number()]).optional(),
});

export const AIRiskSignalSchema = z.object({
  severity: z.enum(['INFO', 'WARN', 'HIGH']),
  entity: z.string(),
  entityType: z.enum(['SALES_REP', 'OUTLET', 'ORDER', 'PRODUCT']),
  description: z.string(),
  recommendation: z.string().optional(),
});

export const AIEntitySummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  metric: z.string(),
  value: z.union([z.string(), z.number()]),
  flag: z.enum(['INFO', 'WARN', 'HIGH']).optional(),
});

export const AISummaryResponseSchema = z.object({
  period: z.object({
    from: z.string(),
    to: z.string(),
  }),
  highlights: z.array(AIHighlightSchema),
  riskSignals: z.array(AIRiskSignalSchema),
  topEntities: z.object({
    salesReps: z.array(AIEntitySummarySchema),
    outlets: z.array(AIEntitySummarySchema),
    skus: z.array(AIEntitySummarySchema),
  }),
  investigationChecklist: z.array(z.string()),
  limitations: z.array(z.string()),
});

// Fallback schema for when AI fails
export const AIFallbackResponseSchema = z.object({
  period: z.object({
    from: z.string(),
    to: z.string(),
  }),
  highlights: z.array(AIHighlightSchema).default([]),
  riskSignals: z.array(z.object({
    severity: z.literal('WARN'),
    entity: z.literal('System'),
    entityType: z.literal('ORDER'),
    description: z.string(),
  })),
  topEntities: z.object({
    salesReps: z.array(AIEntitySummarySchema).default([]),
    outlets: z.array(AIEntitySummarySchema).default([]),
    skus: z.array(AIEntitySummarySchema).default([]),
  }),
  investigationChecklist: z.array(z.string()),
  limitations: z.array(z.string()),
});

// ============================================
// Entity Schemas
// ============================================

export const CreateSalesRepSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  region: z.string().optional(),
});

export const CreateOutletSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  address: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  outletType: z.enum(['RETAIL', 'WHOLESALE', 'DISTRIBUTOR', 'SUPERMARKET', 'MINIMARKET']).default('RETAIL'),
});

export const CreateProductSchema = z.object({
  sku: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  category: z.string().optional(),
  unitPrice: z.number().positive(),
  unit: z.string().default('pcs'),
});

// ============================================
// Visit Schemas (Geo Check-In + Photo Proof)
// ============================================

export const VisitStatusSchema = z.enum(['PENDING', 'VERIFIED', 'FLAGGED', 'REJECTED']);

export const CreateVisitCheckInSchema = z.object({
  salesRepId: z.string().cuid(),
  outletId: z.string().cuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional(),
  checkInTime: z.string().datetime().optional(), // If not provided, server uses current time
  notes: z.string().optional(),
});

export const VisitsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  salesRepId: z.string().cuid().optional(),
  outletId: z.string().cuid().optional(),
  status: VisitStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================
// Export Types
// ============================================

export type DateRange = z.infer<typeof DateRangeSchema>;
export type MetricsQuery = z.infer<typeof MetricsQuerySchema>;
export type FlagsQuery = z.infer<typeof FlagsQuerySchema>;
export type AntiFraudSummaryRequest = z.infer<typeof AntiFraudSummaryRequestSchema>;
export type AISummaryResponse = z.infer<typeof AISummaryResponseSchema>;
export type CreateOrder = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderStatus = z.infer<typeof UpdateOrderStatusSchema>;
export type CancelOrder = z.infer<typeof CancelOrderSchema>;
export type CreateVisitCheckIn = z.infer<typeof CreateVisitCheckInSchema>;
export type VisitsQuery = z.infer<typeof VisitsQuerySchema>;
