import prisma from '@/lib/db/prisma';
import { OrderStatus, Prisma } from '@prisma/client';
import { startOfMonth, endOfMonth, subDays, parseISO, isWithinInterval, format } from 'date-fns';

// ============================================
// TYPES
// ============================================

export interface DateRange {
  from: Date;
  to: Date;
}

export interface OrderMetrics {
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  createdOrders: number;
  readyToShipOrders: number;
  cancelRate: number;
  totalRevenue: number;
  avgOrderValue: number;
}

export interface SalesRepMetrics {
  salesRepId: string;
  salesRepCode: string;
  salesRepName: string;
  totalOrders: number;
  cancelledOrders: number;
  cancelRate: number;
  totalRevenue: number;
  deliveredOrders: number;
}

export interface OutletMetrics {
  outletId: string;
  outletCode: string;
  outletName: string;
  totalOrders: number;
  cancelledOrders: number;
  cancelRate: number;
  totalRevenue: number;
  avgOrderValue: number;
}

export interface EndOfMonthAnalysis {
  totalOrdersInPeriod: number;
  endOfMonthOrders: number;
  restOfMonthOrders: number;
  endOfMonthPercentage: number;
  expectedPercentage: number; // ~16.67% for last 5 days of 30-day month
  spikeRatio: number;
  hasSpike: boolean;
}

export interface PreShipCancelAnalysis {
  totalCancellations: number;
  preShipCancellations: number;
  preShipPercentage: number;
  byReason: Record<string, number>;
}

export interface AbnormalOrderAnalysis {
  orderId: string;
  orderNumber: string;
  outletId: string;
  outletName: string;
  orderAmount: number;
  outletMedian: number;
  ratio: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function parseDateRange(from: string, to: string): DateRange {
  return {
    from: parseISO(from),
    to: parseISO(to),
  };
}

function isEndOfMonthDate(date: Date): boolean {
  const monthEnd = endOfMonth(date);
  const daysFromEnd = Math.ceil((monthEnd.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  return daysFromEnd <= 5;
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ============================================
// CORE METRICS FUNCTIONS
// ============================================

/**
 * Get overall order metrics for a date range
 */
export async function getOrderMetrics(
  from: string,
  to: string,
  salesRepId?: string,
  outletId?: string
): Promise<OrderMetrics> {
  const dateRange = parseDateRange(from, to);

  const whereClause: Prisma.OrderWhereInput = {
    createdAt: {
      gte: dateRange.from,
      lte: dateRange.to,
    },
    ...(salesRepId && { salesRepId }),
    ...(outletId && { outletId }),
  };

  // Get all orders in range
  const orders = await prisma.order.findMany({
    where: whereClause,
    select: {
      status: true,
      totalAmount: true,
    },
  });

  const totalOrders = orders.length;
  const deliveredOrders = orders.filter((o) => o.status === 'DELIVERED').length;
  const cancelledOrders = orders.filter((o) => o.status === 'CANCELLED').length;
  const createdOrders = orders.filter((o) => o.status === 'CREATED').length;
  const readyToShipOrders = orders.filter((o) => o.status === 'READY_TO_SHIP').length;

  const totalRevenue = orders
    .filter((o) => o.status === 'DELIVERED')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const cancelRate = totalOrders > 0 ? cancelledOrders / totalOrders : 0;
  const avgOrderValue = deliveredOrders > 0 ? totalRevenue / deliveredOrders : 0;

  return {
    totalOrders,
    deliveredOrders,
    cancelledOrders,
    createdOrders,
    readyToShipOrders,
    cancelRate: parseFloat(cancelRate.toFixed(4)),
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
  };
}

/**
 * Get metrics per sales rep
 */
export async function getSalesRepMetrics(
  from: string,
  to: string
): Promise<SalesRepMetrics[]> {
  const dateRange = parseDateRange(from, to);

  const salesReps = await prisma.salesRep.findMany({
    where: { isActive: true },
    include: {
      orders: {
        where: {
          createdAt: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
        },
        select: {
          status: true,
          totalAmount: true,
        },
      },
    },
  });

  return salesReps
    .map((rep) => {
      const totalOrders = rep.orders.length;
      const cancelledOrders = rep.orders.filter((o) => o.status === 'CANCELLED').length;
      const deliveredOrders = rep.orders.filter((o) => o.status === 'DELIVERED').length;
      const totalRevenue = rep.orders
        .filter((o) => o.status === 'DELIVERED')
        .reduce((sum, o) => sum + o.totalAmount, 0);

      return {
        salesRepId: rep.id,
        salesRepCode: rep.code,
        salesRepName: rep.name,
        totalOrders,
        cancelledOrders,
        cancelRate: totalOrders > 0 ? parseFloat((cancelledOrders / totalOrders).toFixed(4)) : 0,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        deliveredOrders,
      };
    })
    .sort((a, b) => b.cancelRate - a.cancelRate);
}

/**
 * Get metrics per outlet
 */
export async function getOutletMetrics(
  from: string,
  to: string,
  salesRepId?: string
): Promise<OutletMetrics[]> {
  const dateRange = parseDateRange(from, to);

  const whereClause: Prisma.OutletWhereInput = {
    isActive: true,
  };

  const outlets = await prisma.outlet.findMany({
    where: whereClause,
    include: {
      orders: {
        where: {
          createdAt: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
          ...(salesRepId && { salesRepId }),
        },
        select: {
          status: true,
          totalAmount: true,
        },
      },
    },
  });

  return outlets
    .map((outlet) => {
      const totalOrders = outlet.orders.length;
      const cancelledOrders = outlet.orders.filter((o) => o.status === 'CANCELLED').length;
      const totalRevenue = outlet.orders
        .filter((o) => o.status === 'DELIVERED')
        .reduce((sum, o) => sum + o.totalAmount, 0);
      const deliveredOrders = outlet.orders.filter((o) => o.status === 'DELIVERED').length;

      return {
        outletId: outlet.id,
        outletCode: outlet.code,
        outletName: outlet.name,
        totalOrders,
        cancelledOrders,
        cancelRate: totalOrders > 0 ? parseFloat((cancelledOrders / totalOrders).toFixed(4)) : 0,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        avgOrderValue: deliveredOrders > 0 ? parseFloat((totalRevenue / deliveredOrders).toFixed(2)) : 0,
      };
    })
    .filter((o) => o.totalOrders > 0)
    .sort((a, b) => b.cancelRate - a.cancelRate);
}

/**
 * Analyze end-of-month order spike
 */
export async function analyzeEndOfMonthSpike(
  from: string,
  to: string,
  salesRepId?: string
): Promise<EndOfMonthAnalysis> {
  const dateRange = parseDateRange(from, to);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: {
        gte: dateRange.from,
        lte: dateRange.to,
      },
      ...(salesRepId && { salesRepId }),
    },
    select: {
      createdAt: true,
    },
  });

  const totalOrders = orders.length;
  const endOfMonthOrders = orders.filter((o) => isEndOfMonthDate(o.createdAt)).length;
  const restOfMonthOrders = totalOrders - endOfMonthOrders;

  // Expected: ~16.67% in last 5 days (5/30 days)
  const expectedPercentage = 0.1667;
  const actualPercentage = totalOrders > 0 ? endOfMonthOrders / totalOrders : 0;

  // Spike ratio: how much higher than expected
  const spikeRatio = expectedPercentage > 0 ? actualPercentage / expectedPercentage : 0;

  return {
    totalOrdersInPeriod: totalOrders,
    endOfMonthOrders,
    restOfMonthOrders,
    endOfMonthPercentage: parseFloat(actualPercentage.toFixed(4)),
    expectedPercentage,
    spikeRatio: parseFloat(spikeRatio.toFixed(2)),
    hasSpike: spikeRatio > 1.5, // Flag if > 1.5x expected
  };
}

/**
 * Analyze pre-ship cancellations
 */
export async function analyzePreShipCancellations(
  from: string,
  to: string,
  thresholdHours: number = 24,
  salesRepId?: string
): Promise<PreShipCancelAnalysis> {
  const dateRange = parseDateRange(from, to);

  const cancellations = await prisma.cancellationLog.findMany({
    where: {
      cancelledAt: {
        gte: dateRange.from,
        lte: dateRange.to,
      },
      ...(salesRepId && { cancelledBySalesRepId: salesRepId }),
    },
    select: {
      reason: true,
      hoursBeforeShipDate: true,
    },
  });

  const totalCancellations = cancellations.length;
  const preShipCancellations = cancellations.filter(
    (c) => c.hoursBeforeShipDate !== null && c.hoursBeforeShipDate <= thresholdHours && c.hoursBeforeShipDate >= 0
  ).length;

  // Count by reason
  const byReason = cancellations.reduce(
    (acc, c) => {
      acc[c.reason] = (acc[c.reason] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    totalCancellations,
    preShipCancellations,
    preShipPercentage:
      totalCancellations > 0
        ? parseFloat((preShipCancellations / totalCancellations).toFixed(4))
        : 0,
    byReason,
  };
}

/**
 * Find abnormal order sizes
 */
export async function findAbnormalOrders(
  from: string,
  to: string,
  thresholdMultiplier: number = 3,
  salesRepId?: string
): Promise<AbnormalOrderAnalysis[]> {
  const dateRange = parseDateRange(from, to);

  // Get all orders with outlet info
  const orders = await prisma.order.findMany({
    where: {
      createdAt: {
        gte: dateRange.from,
        lte: dateRange.to,
      },
      ...(salesRepId && { salesRepId }),
    },
    include: {
      outlet: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Calculate median per outlet
  const outletOrders = new Map<string, number[]>();
  orders.forEach((order) => {
    const amounts = outletOrders.get(order.outletId) || [];
    amounts.push(order.totalAmount);
    outletOrders.set(order.outletId, amounts);
  });

  const outletMedians = new Map<string, number>();
  outletOrders.forEach((amounts, outletId) => {
    outletMedians.set(outletId, calculateMedian(amounts));
  });

  // Find abnormal orders
  const abnormalOrders: AbnormalOrderAnalysis[] = [];

  orders.forEach((order) => {
    const median = outletMedians.get(order.outletId) || 0;
    if (median > 0) {
      const ratio = order.totalAmount / median;
      if (ratio >= thresholdMultiplier) {
        abnormalOrders.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          outletId: order.outletId,
          outletName: order.outlet.name,
          orderAmount: parseFloat(order.totalAmount.toFixed(2)),
          outletMedian: parseFloat(median.toFixed(2)),
          ratio: parseFloat(ratio.toFixed(2)),
        });
      }
    }
  });

  return abnormalOrders.sort((a, b) => b.ratio - a.ratio);
}

/**
 * Get comprehensive metrics summary
 */
export async function getMetricsSummary(
  from: string,
  to: string,
  salesRepId?: string,
  outletId?: string
) {
  const [orderMetrics, endOfMonthAnalysis, preShipAnalysis, abnormalOrders] = await Promise.all([
    getOrderMetrics(from, to, salesRepId, outletId),
    analyzeEndOfMonthSpike(from, to, salesRepId),
    analyzePreShipCancellations(from, to, 24, salesRepId),
    findAbnormalOrders(from, to, 3, salesRepId),
  ]);

  // Get top entities only if not filtered
  const [salesRepMetrics, outletMetrics] = await Promise.all([
    !salesRepId ? getSalesRepMetrics(from, to) : Promise.resolve([]),
    !outletId ? getOutletMetrics(from, to, salesRepId) : Promise.resolve([]),
  ]);

  return {
    period: { from, to },
    orderMetrics,
    endOfMonthAnalysis,
    preShipAnalysis,
    abnormalOrders: abnormalOrders.slice(0, 10), // Top 10
    topSalesRepsByCancelRate: salesRepMetrics.slice(0, 5),
    topOutletsByCancelRate: outletMetrics.slice(0, 5),
  };
}
