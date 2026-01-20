import { NextRequest } from 'next/server';
import {
  protectRoute,
  successResponse,
  serverErrorResponse,
} from '@/lib/auth/middleware';
import prisma from '@/lib/db/prisma';
import { VisitsQuerySchema } from '@/lib/validation/schemas';
import { Prisma } from '@prisma/client';

/**
 * GET /api/visits
 * List visit logs with pagination and filtering
 *
 * Query params:
 * - from: ISO date string (filter by checkInTime >=)
 * - to: ISO date string (filter by checkInTime <=)
 * - salesRepId: Filter by sales rep
 * - outletId: Filter by outlet
 * - status: Filter by visit status
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 */
export async function GET(request: NextRequest) {
  const authError = protectRoute(request);
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const queryParams = Object.fromEntries(searchParams.entries());

    const parsed = VisitsQuerySchema.safeParse(queryParams);
    const { from, to, salesRepId, outletId, status, page, limit } = parsed.success
      ? parsed.data
      : { page: 1, limit: 20 } as const;

    // Build where clause
    const where: Prisma.VisitLogWhereInput = {};

    if (from || to) {
      where.checkInTime = {};
      if (from) where.checkInTime.gte = new Date(from);
      if (to) where.checkInTime.lte = new Date(to);
    }

    if (salesRepId) where.salesRepId = salesRepId;
    if (outletId) where.outletId = outletId;
    if (status) where.status = status;

    // Get total count
    const total = await prisma.visitLog.count({ where });

    // Get paginated results
    const visits = await prisma.visitLog.findMany({
      where,
      include: {
        salesRep: { select: { id: true, code: true, name: true } },
        outlet: { select: { id: true, code: true, name: true } },
        auditFlags: {
          select: { id: true, ruleCode: true, severity: true, message: true },
        },
      },
      orderBy: { checkInTime: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return successResponse({
      data: visits,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
