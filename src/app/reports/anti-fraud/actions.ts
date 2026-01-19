"use server";

import { getMetricsSummary } from '@/lib/metrics/computations';
import { getExistingFlags, runFraudDetectionRules, detectAndSaveFlags } from '@/lib/fraud/rules';
import { generateAntiFraudSummary, MetricsForAI, FlagsForAI } from '@/lib/ai/deepseek';

export async function getFlagsAction(from: string, to: string) {
  const flags = await getExistingFlags(from, to);
  return flags;
}

export async function runFraudDetectionAction(from: string, to: string) {
  // Persist detected flags so they have createdAt and ids
  await detectAndSaveFlags(from, to);
  // Return the latest flags for the period
  const flags = await getExistingFlags(from, to);
  return flags;
}

export async function generateAISummaryAction(from: string, to: string) {
  const metrics = await getMetricsSummary(from, to);

  let flags = await getExistingFlags(from, to);
  if (flags.length === 0) {
    const ruleResult = await runFraudDetectionRules(from, to);
    flags = ruleResult.flags.map((f) => ({
      ...f,
      id: 'generated',
      isResolved: false,
      resolvedAt: null,
      resolvedBy: null,
      createdAt: new Date(),
      orderId: f.orderId || null,
      meta: f.meta || {},
    }));
  }

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

  const aiSummary = await generateAntiFraudSummary(metricsForAI, flagsForAI);

  return {
    summary: aiSummary,
    rawMetrics: metrics,
    flagsSummary: {
      total: flagsForAI.total,
      highSeverity: flagsForAI.highSeverity,
      warnSeverity: flagsForAI.warnSeverity,
      byRuleCode: flagsForAI.byRuleCode,
    },
  };
}
