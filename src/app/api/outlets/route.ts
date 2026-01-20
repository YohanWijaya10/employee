import { NextRequest } from 'next/server';
import { protectRoute, successResponse, errorResponse, serverErrorResponse } from '@/lib/auth/middleware';
import { CreateOutletSchema, PaginationSchema } from '@/lib/validation/schemas';
import prisma from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

/**
 * GET /api/outlets
 * List all outlets with optional statistics
 */
export async function GET(request: NextRequest) {
  const authError = protectRoute(request);
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const includeStats = searchParams.get('includeStats') === 'true';
    const region = searchParams.get('region');
    const outletType = searchParams.get('outletType');
    const city = searchParams.get('city');
    const isActive = searchParams.get('isActive');

    const pagination = PaginationSchema.parse({
      page: searchParams.get('page') || 1,
      limit: searchParams.get('limit') || 50,
    });

    const where: Prisma.OutletWhereInput = {};

    if (region) {
      where.region = region;
    }
    if (outletType) {
      where.outletType = outletType as 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR' | 'SUPERMARKET' | 'MINIMARKET';
    }
    if (city) {
      where.city = city;
    }
    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    const [outlets, total] = await Promise.all([
      prisma.outlet.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      prisma.outlet.count({ where }),
    ]);

    // Get statistics if requested
    if (includeStats) {
      const outletsWithStats = await Promise.all(
        outlets.map(async (outlet) => {
          const orders = await prisma.order.groupBy({
            by: ['status'],
            where: { outletId: outlet.id },
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
            ...outlet,
            stats: {
              ...stats,
              cancelRate: stats.totalOrders > 0 ? stats.cancelledOrders / stats.totalOrders : 0,
            },
          };
        })
      );

      return successResponse({
        outlets: outletsWithStats,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages: Math.ceil(total / pagination.limit),
        },
      });
    }

    return successResponse({
      outlets,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}

/**
 * POST /api/outlets
 * Create a new outlet
 */
export async function POST(request: NextRequest) {
  const authError = protectRoute(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    const parsed = CreateOutletSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
    }

    // Check if code already exists
    const existing = await prisma.outlet.findUnique({
      where: { code: parsed.data.code },
    });

    if (existing) {
      return errorResponse(`Outlet with code ${parsed.data.code} already exists`);
    }

    const outlet = await prisma.outlet.create({
      data: parsed.data,
    });

    return successResponse(outlet, 201);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
