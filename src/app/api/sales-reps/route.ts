import { NextRequest } from 'next/server';
import { protectRoute, successResponse, errorResponse, serverErrorResponse } from '@/lib/auth/middleware';
import { CreateSalesRepSchema, PaginationSchema } from '@/lib/validation/schemas';
import prisma from '@/lib/db/prisma';

/**
 * GET /api/sales-reps
 * List all sales reps with their order statistics
 */
export async function GET(request: NextRequest) {
  const authError = protectRoute(request);
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const includeStats = searchParams.get('includeStats') === 'true';
    const region = searchParams.get('region');
    const isActive = searchParams.get('isActive');

    const where: Parameters<typeof prisma.salesRep.findMany>[0]['where'] = {};

    if (region) {
      where.region = region;
    }
    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    const salesReps = await prisma.salesRep.findMany({
      where,
      include: includeStats
        ? {
            _count: {
              select: {
                orders: true,
                cancelledOrders: true,
              },
            },
          }
        : undefined,
      orderBy: { name: 'asc' },
    });

    // Get order statistics if requested
    if (includeStats) {
      const repsWithStats = await Promise.all(
        salesReps.map(async (rep) => {
          const orders = await prisma.order.groupBy({
            by: ['status'],
            where: { salesRepId: rep.id },
            _count: true,
            _sum: { totalAmount: true },
          });

          const stats = {
            totalOrders: 0,
            deliveredOrders: 0,
            cancelledOrders: 0,
            totalRevenue: 0,
          };

          orders.forEach((group) => {
            stats.totalOrders += group._count;
            if (group.status === 'DELIVERED') {
              stats.deliveredOrders = group._count;
              stats.totalRevenue = group._sum.totalAmount || 0;
            } else if (group.status === 'CANCELLED') {
              stats.cancelledOrders = group._count;
            }
          });

          return {
            ...rep,
            stats: {
              ...stats,
              cancelRate: stats.totalOrders > 0 ? stats.cancelledOrders / stats.totalOrders : 0,
            },
          };
        })
      );

      return successResponse(repsWithStats);
    }

    return successResponse(salesReps);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

/**
 * POST /api/sales-reps
 * Create a new sales rep
 */
export async function POST(request: NextRequest) {
  const authError = protectRoute(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    const parsed = CreateSalesRepSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
    }

    // Check if code already exists
    const existing = await prisma.salesRep.findUnique({
      where: { code: parsed.data.code },
    });

    if (existing) {
      return errorResponse(`Sales rep with code ${parsed.data.code} already exists`);
    }

    const salesRep = await prisma.salesRep.create({
      data: parsed.data,
    });

    return successResponse(salesRep, 201);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
