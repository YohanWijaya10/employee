import { NextRequest } from 'next/server';
import { protectRoute, successResponse, errorResponse, serverErrorResponse } from '@/lib/auth/middleware';
import { AntiFraudSummaryRequestSchema } from '@/lib/validation/schemas';
import { getMetricsSummary } from '@/lib/metrics/computations';
import { getExistingFlags, runFraudDetectionRules } from '@/lib/fraud/rules';
import { generateAntiFraudSummary, MetricsForAI, FlagsForAI } from '@/lib/ai/deepseek';

/**
 * POST /api/ai/anti-fraud-summary
 * Generate AI-powered anti-fraud summary based on metrics and flags
 */
export async function POST(request: NextRequest) {
  const authError = protectRoute(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    // Validate request
    const parsed = AntiFraudSummaryRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
    }

    const { from, to, salesRepId, outletId } = parsed.data;

    // Get metrics
    const metrics = await getMetricsSummary(from, to, salesRepId, outletId);

    // Get or generate flags
    let flags = await getExistingFlags(from, to);

    // If no flags exist, run detection
    if (flags.length === 0) {
      const ruleResult = await runFraudDetectionRules(from, to);
      flags = ruleResult.flags.map((f) => ({
        ...f,
        id: 'generated',
        isResolved: false as const,
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date(),
        orderId: f.orderId || null,
        visitLogId: null,
        meta: (f.meta || {}) as object,
      }));
    }

    // Prepare data for AI
    const metricsForAI: MetricsForAI = {
      period: { from, to },
      orderMetrics: metrics.orderMetrics,
      endOfMonthAnalysis: metrics.endOfMonthAnalysis,
      preShipAnalysis: metrics.preShipAnalysis,
      topSalesRepsByCancelRate: metrics.topSalesRepsByCancelRate.map((r) => ({
        salesRepCode: r.salesRepCode,
        salesRepName: r.salesRepName,
        totalOrders: r.totalOrders,
        cancelledOrders: r.cancelledOrders,
        cancelRate: r.cancelRate,
      })),
      topOutletsByCancelRate: metrics.topOutletsByCancelRate.map((o) => ({
        outletCode: o.outletCode,
        outletName: o.outletName,
        totalOrders: o.totalOrders,
        cancelledOrders: o.cancelledOrders,
        cancelRate: o.cancelRate,
      })),
      abnormalOrders: metrics.abnormalOrders.map((o) => ({
        orderNumber: o.orderNumber,
        outletName: o.outletName,
        orderAmount: o.orderAmount,
        outletMedian: o.outletMedian,
        ratio: o.ratio,
      })),
    };

    const byRuleCode: Record<string, number> = {};
    flags.forEach((f) => {
      byRuleCode[f.ruleCode] = (byRuleCode[f.ruleCode] || 0) + 1;
    });

    const flagsForAI: FlagsForAI = {
      total: flags.length,
      highSeverity: flags.filter((f) => f.severity === 'HIGH').length,
      warnSeverity: flags.filter((f) => f.severity === 'WARN').length,
      byRuleCode,
      flags: flags.map((f) => ({
        ruleCode: f.ruleCode,
        severity: f.severity,
        entityType: f.entityType,
        message: f.message,
      })),
    };

    // Generate AI summary
    const aiSummary = await generateAntiFraudSummary(metricsForAI, flagsForAI);

    return successResponse({
      summary: aiSummary,
      rawMetrics: metrics,
      flagsSummary: {
        total: flagsForAI.total,
        highSeverity: flagsForAI.highSeverity,
        warnSeverity: flagsForAI.warnSeverity,
        byRuleCode: flagsForAI.byRuleCode,
      },
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
