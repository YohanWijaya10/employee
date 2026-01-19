import { NextRequest } from 'next/server';
import { protectRoute, successResponse, errorResponse, serverErrorResponse } from '@/lib/auth/middleware';
import { MetricsQuerySchema } from '@/lib/validation/schemas';
import { getMetricsSummary, getSalesRepMetrics, getOutletMetrics } from '@/lib/metrics/computations';

/**
 * GET /api/metrics
 * Get metrics for a date range with optional filters
 */
export async function GET(request: NextRequest) {
  // Auth check
  const authError = protectRoute(request);
  if (authError) return authError;

  try {
    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const query = {
      from: searchParams.get('from'),
      to: searchParams.get('to'),
      salesRepId: searchParams.get('salesRepId') || undefined,
      outletId: searchParams.get('outletId') || undefined,
    };

    // Validate
    const parsed = MetricsQuerySchema.safeParse(query);
    if (!parsed.success) {
      return errorResponse(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
    }

    const { from, to, salesRepId, outletId } = parsed.data;

    // Get comprehensive metrics
    const metrics = await getMetricsSummary(from, to, salesRepId, outletId);

    return successResponse(metrics);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
