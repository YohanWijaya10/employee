import OpenAI from 'openai';
import { z } from 'zod';
import { AISummaryResponseSchema } from '@/lib/validation/schemas';

// ============================================
// CONFIGURATION
// ============================================

function sanitizeBaseURL(url?: string): string {
  const fallback = 'https://api.deepseek.com';
  if (!url) return fallback;
  const trimmed = url.trim();
  if (!trimmed) return fallback;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  // Remove trailing slashes for consistency
  return withProto.replace(/\/+$/, '');
}

const getDeepSeekConfig = () => ({
  baseURL: sanitizeBaseURL(process.env.DEEPSEEK_BASE_URL),
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
});

// ============================================
// TYPES
// ============================================

export interface MetricsForAI {
  period: { from: string; to: string };
  orderMetrics: {
    totalOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    cancelRate: number;
    totalRevenue: number;
    avgOrderValue: number;
  };
  endOfMonthAnalysis: {
    endOfMonthOrders: number;
    restOfMonthOrders: number;
    spikeRatio: number;
    hasSpike: boolean;
  };
  preShipAnalysis: {
    totalCancellations: number;
    preShipCancellations: number;
    preShipPercentage: number;
  };
  topSalesRepsByCancelRate: Array<{
    salesRepCode: string;
    salesRepName: string;
    totalOrders: number;
    cancelledOrders: number;
    cancelRate: number;
  }>;
  topOutletsByCancelRate: Array<{
    outletCode: string;
    outletName: string;
    totalOrders: number;
    cancelledOrders: number;
    cancelRate: number;
  }>;
  abnormalOrders: Array<{
    orderNumber: string;
    outletName: string;
    orderAmount: number;
    outletMedian: number;
    ratio: number;
  }>;
}

export interface FlagsForAI {
  total: number;
  highSeverity: number;
  warnSeverity: number;
  byRuleCode: Record<string, number>;
  flags: Array<{
    ruleCode: string;
    severity: string;
    entityType: string;
    message: string;
  }>;
}

// ============================================
// PROMPT GENERATION
// ============================================

function buildSystemPrompt(): string {
  return `You are a sales distribution fraud analyst AI assistant. Your role is to analyze sales metrics and audit flags to identify potential risk indicators and provide actionable insights.

CRITICAL RULES:
1. NEVER invent or hallucinate any numbers. All numbers in your response must come from the provided data.
2. NEVER confirm fraud as a fact. Only identify "risk indicators" or "suspicious patterns" that warrant investigation.
3. Always respond in valid JSON format only. No markdown, no explanations outside the JSON.
4. If data is missing or insufficient, clearly state this in the limitations array.
5. Be objective and professional. Focus on patterns that deviate from expected behavior.

LANGUAGE REQUIREMENTS:
- Use Bahasa Indonesia for all natural-language fields in the JSON (e.g., titles, descriptions, recommendations, investigation items).
- Keep JSON keys and enum values exactly as specified (e.g., INFO|WARN|HIGH), do not translate keys or enum values.

Your output must be a valid JSON object matching this exact structure:
{
  "period": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },
  "highlights": [
    { "type": "metric|trend|anomaly", "title": "...", "description": "...", "value": "..." }
  ],
  "riskSignals": [
    { "severity": "INFO|WARN|HIGH", "entity": "...", "entityType": "SALES_REP|OUTLET|ORDER|PRODUCT", "description": "...", "recommendation": "..." }
  ],
  "topEntities": {
    "salesReps": [{ "id": "...", "name": "...", "metric": "...", "value": "...", "flag": "INFO|WARN|HIGH" }],
    "outlets": [{ "id": "...", "name": "...", "metric": "...", "value": "...", "flag": "INFO|WARN|HIGH" }],
    "skus": []
  },
  "investigationChecklist": ["..."],
  "limitations": ["..."]
}`;
}

function buildUserPrompt(metrics: MetricsForAI, flags: FlagsForAI): string {
  return `Analyze the following sales metrics and audit flags for the period ${metrics.period.from} to ${metrics.period.to}.

## ORDER METRICS
- Total Orders: ${metrics.orderMetrics.totalOrders}
- Delivered: ${metrics.orderMetrics.deliveredOrders}
- Cancelled: ${metrics.orderMetrics.cancelledOrders}
- Cancel Rate: ${(metrics.orderMetrics.cancelRate * 100).toFixed(2)}%
- Total Revenue: $${metrics.orderMetrics.totalRevenue.toFixed(2)}
- Avg Order Value: $${metrics.orderMetrics.avgOrderValue.toFixed(2)}

## END-OF-MONTH ANALYSIS
- Orders in last 5 days of months: ${metrics.endOfMonthAnalysis.endOfMonthOrders}
- Orders in rest of months: ${metrics.endOfMonthAnalysis.restOfMonthOrders}
- Spike Ratio (vs expected 16.7%): ${metrics.endOfMonthAnalysis.spikeRatio}x
- Has Spike: ${metrics.endOfMonthAnalysis.hasSpike}

## PRE-SHIP CANCELLATIONS
- Total Cancellations: ${metrics.preShipAnalysis.totalCancellations}
- Pre-Ship Cancellations (within 24h): ${metrics.preShipAnalysis.preShipCancellations}
- Pre-Ship Rate: ${(metrics.preShipAnalysis.preShipPercentage * 100).toFixed(2)}%

## TOP SALES REPS BY CANCEL RATE
${metrics.topSalesRepsByCancelRate.map((r) => `- ${r.salesRepCode} (${r.salesRepName}): ${(r.cancelRate * 100).toFixed(1)}% cancel rate (${r.cancelledOrders}/${r.totalOrders} orders)`).join('\n')}

## TOP OUTLETS BY CANCEL RATE
${metrics.topOutletsByCancelRate.map((o) => `- ${o.outletCode} (${o.outletName}): ${(o.cancelRate * 100).toFixed(1)}% cancel rate (${o.cancelledOrders}/${o.totalOrders} orders)`).join('\n')}

## ABNORMAL ORDERS (Size > 3x Median)
${metrics.abnormalOrders.length > 0 ? metrics.abnormalOrders.map((o) => `- ${o.orderNumber} at ${o.outletName}: $${o.orderAmount} (${o.ratio}x outlet median of $${o.outletMedian})`).join('\n') : 'No abnormal orders detected'}

## AUDIT FLAGS SUMMARY
- Total Flags: ${flags.total}
- High Severity: ${flags.highSeverity}
- Warning Severity: ${flags.warnSeverity}
- By Rule: ${Object.entries(flags.byRuleCode).map(([k, v]) => `${k}: ${v}`).join(', ')}

## DETAILED FLAGS
${flags.flags.slice(0, 20).map((f) => `- [${f.severity}] ${f.entityType}: ${f.message}`).join('\n')}

Based on this data, provide your analysis as a JSON object. Remember: only use numbers from the provided data, never invent figures, and flag suspicious patterns as "risk indicators" not confirmed fraud.`;
}

// ============================================
// API INTEGRATION
// ============================================

/**
 * Call DeepSeek API to generate anti-fraud summary
 */
export async function generateAntiFraudSummary(
  metrics: MetricsForAI,
  flags: FlagsForAI
): Promise<z.infer<typeof AISummaryResponseSchema>> {
  const config = getDeepSeekConfig();

  if (!config.apiKey) {
    console.warn('DEEPSEEK_API_KEY not configured, returning fallback response');
    return getFallbackResponse(metrics.period.from, metrics.period.to, 'API key not configured');
  }

  try {
    const client = new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    });

    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(metrics, flags) },
      ],
      temperature: 0.3, // Lower temperature for more consistent output
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      console.error('Empty response from DeepSeek');
      return getFallbackResponse(metrics.period.from, metrics.period.to, 'Empty response from AI');
    }

    // Parse and validate JSON
    const parsed = parseAIResponse(content);
    const validated = AISummaryResponseSchema.safeParse(parsed);

    if (!validated.success) {
      console.error('AI response validation failed:', validated.error);
      return getFallbackResponse(
        metrics.period.from,
        metrics.period.to,
        'AI output validation failed - review flags manually'
      );
    }

    return validated.data;
  } catch (error) {
    console.error('DeepSeek API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return getFallbackResponse(metrics.period.from, metrics.period.to, `AI service error: ${message}`);
  }
}

/**
 * Parse AI response, handling potential JSON extraction from markdown
 */
function parseAIResponse(content: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(content);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        // Fall through
      }
    }

    // Try to find JSON object in content
    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Fall through
      }
    }

    throw new Error('Could not parse AI response as JSON');
  }
}

/**
 * Generate fallback response when AI fails
 */
function getFallbackResponse(from: string, to: string, reason: string): z.infer<typeof AISummaryResponseSchema> {
  return {
    period: { from, to },
    highlights: [],
    riskSignals: [
      {
        severity: 'WARN',
        entity: 'Sistem',
        entityType: 'ORDER',
        description: `Analisis AI tidak tersedia: ${reason}`,
        recommendation: 'Tinjau catatan audit (flags) secara manual',
      },
    ],
    topEntities: {
      salesReps: [],
      outlets: [],
      skus: [],
    },
    investigationChecklist: [
      'Tinjau tabel audit flags untuk item dengan tingkat HIGH',
      'Periksa sales rep dengan tingkat pembatalan > 25%',
      'Investigasi pola pesanan di akhir bulan',
      'Verifikasi ukuran pesanan abnormal dengan pengelola outlet',
    ],
    limitations: [reason, 'Disarankan peninjauan manual'],
  };
}
