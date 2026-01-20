import prisma from '@/lib/db/prisma';
import { EntityType, FlagSeverity, Prisma } from '@prisma/client';
import {
  getOrderMetrics,
  getSalesRepMetrics,
  getOutletMetrics,
  analyzeEndOfMonthSpike,
  analyzePreShipCancellations,
  findAbnormalOrders,
} from '@/lib/metrics/computations';

// ============================================
// RULE CONFIGURATION
// ============================================

export const FRAUD_RULES = {
  // Cancel rate thresholds
  HIGH_CANCEL_RATE_WARN: 0.15, // 15%
  HIGH_CANCEL_RATE_HIGH: 0.25, // 25%

  // End of month spike
  END_OF_MONTH_SPIKE_WARN: 1.5, // 1.5x expected
  END_OF_MONTH_SPIKE_HIGH: 2.0, // 2x expected

  // Pre-ship cancel thresholds
  PRE_SHIP_CANCEL_HOURS: 24, // Within 24 hours of ship date
  PRE_SHIP_CANCEL_RATE_WARN: 0.1, // 10% of cancellations
  PRE_SHIP_CANCEL_RATE_HIGH: 0.2, // 20% of cancellations

  // Abnormal order size
  ABNORMAL_ORDER_MULTIPLIER_WARN: 3, // 3x median
  ABNORMAL_ORDER_MULTIPLIER_HIGH: 5, // 5x median

  // Minimum samples for statistical significance
  MIN_ORDERS_FOR_ANALYSIS: 5,
} as const;

// ============================================
// RULE CODES
// ============================================

export const RULE_CODES = {
  HIGH_CANCEL_RATE: 'HIGH_CANCEL_RATE',
  END_OF_MONTH_SPIKE: 'END_OF_MONTH_SPIKE',
  PRE_SHIP_CANCEL: 'PRE_SHIP_CANCEL',
  ABNORMAL_ORDER_SIZE: 'ABNORMAL_ORDER_SIZE',
  FREQUENT_CANCELLER: 'FREQUENT_CANCELLER',
} as const;

// ============================================
// TYPES
// ============================================

export interface AuditFlagInput {
  entityType: EntityType;
  entityId: string;
  ruleCode: string;
  severity: FlagSeverity;
  message: string;
  meta?: Record<string, unknown>;
  orderId?: string;
}

export interface RuleResult {
  flags: AuditFlagInput[];
  summary: {
    totalFlags: number;
    highSeverity: number;
    warnSeverity: number;
    infoSeverity: number;
  };
}

// ============================================
// RULE FUNCTIONS
// ============================================

/**
 * Check for high cancel rate by sales rep
 */
async function checkSalesRepCancelRates(from: string, to: string): Promise<AuditFlagInput[]> {
  const flags: AuditFlagInput[] = [];
  const metrics = await getSalesRepMetrics(from, to);

  for (const rep of metrics) {
    if (rep.totalOrders < FRAUD_RULES.MIN_ORDERS_FOR_ANALYSIS) continue;

    if (rep.cancelRate >= FRAUD_RULES.HIGH_CANCEL_RATE_HIGH) {
      flags.push({
        entityType: 'SALES_REP',
        entityId: rep.salesRepId,
        ruleCode: RULE_CODES.HIGH_CANCEL_RATE,
        severity: 'HIGH',
        message: `Sales rep ${rep.salesRepCode} has ${(rep.cancelRate * 100).toFixed(1)}% cancel rate (${rep.cancelledOrders}/${rep.totalOrders} orders)`,
        meta: {
          salesRepCode: rep.salesRepCode,
          salesRepName: rep.salesRepName,
          cancelRate: rep.cancelRate,
          totalOrders: rep.totalOrders,
          cancelledOrders: rep.cancelledOrders,
        },
      });
    } else if (rep.cancelRate >= FRAUD_RULES.HIGH_CANCEL_RATE_WARN) {
      flags.push({
        entityType: 'SALES_REP',
        entityId: rep.salesRepId,
        ruleCode: RULE_CODES.HIGH_CANCEL_RATE,
        severity: 'WARN',
        message: `Sales rep ${rep.salesRepCode} has elevated cancel rate of ${(rep.cancelRate * 100).toFixed(1)}%`,
        meta: {
          salesRepCode: rep.salesRepCode,
          salesRepName: rep.salesRepName,
          cancelRate: rep.cancelRate,
          totalOrders: rep.totalOrders,
          cancelledOrders: rep.cancelledOrders,
        },
      });
    }
  }

  return flags;
}

/**
 * Check for high cancel rate by outlet
 */
async function checkOutletCancelRates(from: string, to: string): Promise<AuditFlagInput[]> {
  const flags: AuditFlagInput[] = [];
  const metrics = await getOutletMetrics(from, to);

  for (const outlet of metrics) {
    if (outlet.totalOrders < FRAUD_RULES.MIN_ORDERS_FOR_ANALYSIS) continue;

    if (outlet.cancelRate >= FRAUD_RULES.HIGH_CANCEL_RATE_HIGH) {
      flags.push({
        entityType: 'OUTLET',
        entityId: outlet.outletId,
        ruleCode: RULE_CODES.HIGH_CANCEL_RATE,
        severity: 'HIGH',
        message: `Outlet ${outlet.outletCode} has ${(outlet.cancelRate * 100).toFixed(1)}% cancel rate (${outlet.cancelledOrders}/${outlet.totalOrders} orders)`,
        meta: {
          outletCode: outlet.outletCode,
          outletName: outlet.outletName,
          cancelRate: outlet.cancelRate,
          totalOrders: outlet.totalOrders,
          cancelledOrders: outlet.cancelledOrders,
        },
      });
    } else if (outlet.cancelRate >= FRAUD_RULES.HIGH_CANCEL_RATE_WARN) {
      flags.push({
        entityType: 'OUTLET',
        entityId: outlet.outletId,
        ruleCode: RULE_CODES.HIGH_CANCEL_RATE,
        severity: 'WARN',
        message: `Outlet ${outlet.outletCode} has elevated cancel rate of ${(outlet.cancelRate * 100).toFixed(1)}%`,
        meta: {
          outletCode: outlet.outletCode,
          outletName: outlet.outletName,
          cancelRate: outlet.cancelRate,
          totalOrders: outlet.totalOrders,
          cancelledOrders: outlet.cancelledOrders,
        },
      });
    }
  }

  return flags;
}

/**
 * Check for end-of-month order spike
 */
async function checkEndOfMonthSpike(from: string, to: string): Promise<AuditFlagInput[]> {
  const flags: AuditFlagInput[] = [];
  const analysis = await analyzeEndOfMonthSpike(from, to);

  if (analysis.totalOrdersInPeriod < FRAUD_RULES.MIN_ORDERS_FOR_ANALYSIS) {
    return flags;
  }

  if (analysis.spikeRatio >= FRAUD_RULES.END_OF_MONTH_SPIKE_HIGH) {
    flags.push({
      entityType: 'ORDER',
      entityId: 'SYSTEM',
      ruleCode: RULE_CODES.END_OF_MONTH_SPIKE,
      severity: 'HIGH',
      message: `End-of-month order spike detected: ${analysis.endOfMonthOrders} orders (${(analysis.endOfMonthPercentage * 100).toFixed(1)}%) in last 5 days, ${analysis.spikeRatio}x expected`,
      meta: {
        endOfMonthOrders: analysis.endOfMonthOrders,
        restOfMonthOrders: analysis.restOfMonthOrders,
        percentage: analysis.endOfMonthPercentage,
        spikeRatio: analysis.spikeRatio,
        expectedPercentage: analysis.expectedPercentage,
      },
    });
  } else if (analysis.spikeRatio >= FRAUD_RULES.END_OF_MONTH_SPIKE_WARN) {
    flags.push({
      entityType: 'ORDER',
      entityId: 'SYSTEM',
      ruleCode: RULE_CODES.END_OF_MONTH_SPIKE,
      severity: 'WARN',
      message: `Elevated end-of-month orders: ${analysis.endOfMonthOrders} orders (${(analysis.endOfMonthPercentage * 100).toFixed(1)}%) in last 5 days`,
      meta: {
        endOfMonthOrders: analysis.endOfMonthOrders,
        restOfMonthOrders: analysis.restOfMonthOrders,
        percentage: analysis.endOfMonthPercentage,
        spikeRatio: analysis.spikeRatio,
      },
    });
  }

  return flags;
}

/**
 * Check for suspicious pre-ship cancellations
 */
async function checkPreShipCancellations(from: string, to: string): Promise<AuditFlagInput[]> {
  const flags: AuditFlagInput[] = [];
  const analysis = await analyzePreShipCancellations(from, to, FRAUD_RULES.PRE_SHIP_CANCEL_HOURS);

  if (analysis.totalCancellations < FRAUD_RULES.MIN_ORDERS_FOR_ANALYSIS) {
    return flags;
  }

  if (analysis.preShipPercentage >= FRAUD_RULES.PRE_SHIP_CANCEL_RATE_HIGH) {
    flags.push({
      entityType: 'ORDER',
      entityId: 'SYSTEM',
      ruleCode: RULE_CODES.PRE_SHIP_CANCEL,
      severity: 'HIGH',
      message: `High rate of pre-ship cancellations: ${analysis.preShipCancellations} orders (${(analysis.preShipPercentage * 100).toFixed(1)}%) cancelled within ${FRAUD_RULES.PRE_SHIP_CANCEL_HOURS}h of ship date`,
      meta: {
        preShipCancellations: analysis.preShipCancellations,
        totalCancellations: analysis.totalCancellations,
        percentage: analysis.preShipPercentage,
        thresholdHours: FRAUD_RULES.PRE_SHIP_CANCEL_HOURS,
        byReason: analysis.byReason,
      },
    });
  } else if (analysis.preShipPercentage >= FRAUD_RULES.PRE_SHIP_CANCEL_RATE_WARN) {
    flags.push({
      entityType: 'ORDER',
      entityId: 'SYSTEM',
      ruleCode: RULE_CODES.PRE_SHIP_CANCEL,
      severity: 'WARN',
      message: `Elevated pre-ship cancellations: ${analysis.preShipCancellations} orders cancelled within ${FRAUD_RULES.PRE_SHIP_CANCEL_HOURS}h of ship date`,
      meta: {
        preShipCancellations: analysis.preShipCancellations,
        totalCancellations: analysis.totalCancellations,
        percentage: analysis.preShipPercentage,
      },
    });
  }

  return flags;
}

/**
 * Check for abnormal order sizes
 */
async function checkAbnormalOrders(from: string, to: string): Promise<AuditFlagInput[]> {
  const flags: AuditFlagInput[] = [];

  // Check for HIGH severity (5x median)
  const highAbnormal = await findAbnormalOrders(from, to, FRAUD_RULES.ABNORMAL_ORDER_MULTIPLIER_HIGH);
  for (const order of highAbnormal) {
    flags.push({
      entityType: 'ORDER',
      entityId: order.orderId,
      ruleCode: RULE_CODES.ABNORMAL_ORDER_SIZE,
      severity: 'HIGH',
      message: `Order ${order.orderNumber} is ${order.ratio}x the outlet median ($${order.orderAmount} vs median $${order.outletMedian})`,
      meta: {
        orderNumber: order.orderNumber,
        outletId: order.outletId,
        outletName: order.outletName,
        orderAmount: order.orderAmount,
        outletMedian: order.outletMedian,
        ratio: order.ratio,
      },
      orderId: order.orderId,
    });
  }

  // Check for WARN severity (3x median but less than 5x)
  const warnAbnormal = await findAbnormalOrders(from, to, FRAUD_RULES.ABNORMAL_ORDER_MULTIPLIER_WARN);
  const highOrderIds = new Set(highAbnormal.map((o) => o.orderId));

  for (const order of warnAbnormal) {
    if (highOrderIds.has(order.orderId)) continue; // Skip if already flagged as HIGH

    flags.push({
      entityType: 'ORDER',
      entityId: order.orderId,
      ruleCode: RULE_CODES.ABNORMAL_ORDER_SIZE,
      severity: 'WARN',
      message: `Order ${order.orderNumber} is ${order.ratio}x the outlet median ($${order.orderAmount} vs median $${order.outletMedian})`,
      meta: {
        orderNumber: order.orderNumber,
        outletId: order.outletId,
        outletName: order.outletName,
        orderAmount: order.orderAmount,
        outletMedian: order.outletMedian,
        ratio: order.ratio,
      },
      orderId: order.orderId,
    });
  }

  return flags;
}

// ============================================
// MAIN RULE ENGINE
// ============================================

/**
 * Run all fraud detection rules and generate flags
 */
export async function runFraudDetectionRules(from: string, to: string): Promise<RuleResult> {
  console.log(`Running fraud detection rules for period ${from} to ${to}`);

  // Run all checks in parallel
  const [
    salesRepCancelFlags,
    outletCancelFlags,
    endOfMonthFlags,
    preShipFlags,
    abnormalOrderFlags,
  ] = await Promise.all([
    checkSalesRepCancelRates(from, to),
    checkOutletCancelRates(from, to),
    checkEndOfMonthSpike(from, to),
    checkPreShipCancellations(from, to),
    checkAbnormalOrders(from, to),
  ]);

  const allFlags = [
    ...salesRepCancelFlags,
    ...outletCancelFlags,
    ...endOfMonthFlags,
    ...preShipFlags,
    ...abnormalOrderFlags,
  ];

  const summary = {
    totalFlags: allFlags.length,
    highSeverity: allFlags.filter((f) => f.severity === 'HIGH').length,
    warnSeverity: allFlags.filter((f) => f.severity === 'WARN').length,
    infoSeverity: allFlags.filter((f) => f.severity === 'INFO').length,
  };

  console.log(`Generated ${summary.totalFlags} flags (${summary.highSeverity} HIGH, ${summary.warnSeverity} WARN)`);

  return { flags: allFlags, summary };
}

/**
 * Save flags to database
 */
export async function saveAuditFlags(flags: AuditFlagInput[]): Promise<number> {
  if (flags.length === 0) return 0;

  // Create flags in batches
  const batchSize = 50;
  let created = 0;

  for (let i = 0; i < flags.length; i += batchSize) {
    const batch = flags.slice(i, i + batchSize);

    await prisma.auditFlag.createMany({
      data: batch.map((flag) => ({
        entityType: flag.entityType,
        entityId: flag.entityId,
        ruleCode: flag.ruleCode,
        severity: flag.severity,
        message: flag.message,
        meta: (flag.meta || {}) as object,
        orderId: flag.orderId,
      })),
    });

    created += batch.length;
  }

  return created;
}

/**
 * Get existing flags for a period
 */
export async function getExistingFlags(
  from?: string,
  to?: string,
  filters?: {
    entityType?: EntityType;
    severity?: FlagSeverity;
    ruleCode?: string;
    isResolved?: boolean;
  }
) {
  const whereClause: Prisma.AuditFlagWhereInput = {};

  if (from && to) {
    whereClause.createdAt = {
      gte: new Date(from),
      lte: new Date(to),
    };
  }

  if (filters?.entityType) {
    whereClause.entityType = filters.entityType;
  }

  if (filters?.severity) {
    whereClause.severity = filters.severity;
  }

  if (filters?.ruleCode) {
    whereClause.ruleCode = filters.ruleCode;
  }

  if (filters?.isResolved !== undefined) {
    whereClause.isResolved = filters.isResolved;
  }

  return prisma.auditFlag.findMany({
    where: whereClause,
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    take: 500,
  });
}

/**
 * Run rules and save to database
 */
export async function detectAndSaveFlags(from: string, to: string): Promise<RuleResult> {
  const result = await runFraudDetectionRules(from, to);

  if (result.flags.length > 0) {
    const savedCount = await saveAuditFlags(result.flags);
    console.log(`Saved ${savedCount} flags to database`);
  }

  return result;
}
