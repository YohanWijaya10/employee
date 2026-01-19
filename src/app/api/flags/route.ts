import { NextRequest } from 'next/server';
import { protectRoute, successResponse, errorResponse, serverErrorResponse } from '@/lib/auth/middleware';
import { FlagsQuerySchema } from '@/lib/validation/schemas';
import { getExistingFlags, detectAndSaveFlags } from '@/lib/fraud/rules';
import { EntityType, FlagSeverity } from '@prisma/client';

/**
 * GET /api/flags
 * Get existing audit flags with optional filters
 */
export async function GET(request: NextRequest) {
  const authError = protectRoute(request);
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const query = {
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      entityType: searchParams.get('entityType') || undefined,
      severity: searchParams.get('severity') || undefined,
      ruleCode: searchParams.get('ruleCode') || undefined,
      isResolved: searchParams.get('isResolved') || undefined,
    };

    const parsed = FlagsQuerySchema.safeParse(query);
    if (!parsed.success) {
      return errorResponse(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
    }

    const flags = await getExistingFlags(parsed.data.from, parsed.data.to, {
      entityType: parsed.data.entityType as EntityType | undefined,
      severity: parsed.data.severity as FlagSeverity | undefined,
      ruleCode: parsed.data.ruleCode,
      isResolved: parsed.data.isResolved,
    });

    return successResponse({
      flags,
      total: flags.length,
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}

/**
 * POST /api/flags
 * Run fraud detection and generate new flags
 */
export async function POST(request: NextRequest) {
  const authError = protectRoute(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    if (!body.from || !body.to) {
      return errorResponse('from and to date parameters are required');
    }

    const result = await detectAndSaveFlags(body.from, body.to);

    return successResponse({
      message: `Generated ${result.summary.totalFlags} flags`,
      summary: result.summary,
      flags: result.flags,
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
