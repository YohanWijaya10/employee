import { NextRequest } from 'next/server';
import { protectRoute, successResponse, errorResponse, serverErrorResponse } from '@/lib/auth/middleware';
import { CreateOrderSchema, PaginationSchema } from '@/lib/validation/schemas';
import prisma from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

/**
 * GET /api/orders
 * List orders with pagination and filters
 */
export async function GET(request: NextRequest) {
  const authError = protectRoute(request);
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;

    // Pagination
    const pagination = PaginationSchema.parse({
      page: searchParams.get('page') || 1,
      limit: searchParams.get('limit') || 20,
    });

    // Filters
    const status = searchParams.get('status');
    const salesRepId = searchParams.get('salesRepId');
    const outletId = searchParams.get('outletId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where: Prisma.OrderWhereInput = {};

    if (status) {
      where.status = status as 'CREATED' | 'READY_TO_SHIP' | 'DELIVERED' | 'CANCELLED';
    }
    if (salesRepId) {
      where.salesRepId = salesRepId;
    }
    if (outletId) {
      where.outletId = outletId;
    }
    if (from && to) {
      where.createdAt = {
        gte: new Date(from),
        lte: new Date(to),
      };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          salesRep: { select: { code: true, name: true } },
          outlet: { select: { code: true, name: true } },
          cancellation: { select: { reason: true, cancelledAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      prisma.order.count({ where }),
    ]);

    return successResponse({
      orders,
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
 * POST /api/orders
 * Create a new order
 */
export async function POST(request: NextRequest) {
  const authError = protectRoute(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    const parsed = CreateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(`Validation failed: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`);
    }

    const { salesRepId, outletId, plannedShipDate, notes, items } = parsed.data;

    // Verify sales rep and outlet exist
    const [salesRep, outlet] = await Promise.all([
      prisma.salesRep.findUnique({ where: { id: salesRepId } }),
      prisma.outlet.findUnique({ where: { id: outletId } }),
    ]);

    if (!salesRep) {
      return errorResponse('Sales rep not found', 404);
    }
    if (!outlet) {
      return errorResponse('Outlet not found', 404);
    }

    // Verify all products exist and get their prices
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      return errorResponse('One or more products not found', 404);
    }

    // Calculate totals
    const orderItems = items.map((item) => {
      const subtotal = item.quantity * item.unitPrice;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal,
      };
    });

    const totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0);

    // Generate order number
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const existingCount = await prisma.order.count({
      where: {
        orderNumber: { startsWith: `ORD-${dateStr}` },
      },
    });
    const orderNumber = `ORD-${dateStr}-${String(existingCount + 1).padStart(4, '0')}`;

    // Create order with items
    const order = await prisma.order.create({
      data: {
        orderNumber,
        status: 'CREATED',
        totalAmount,
        totalItems,
        notes,
        plannedShipDate: plannedShipDate ? new Date(plannedShipDate) : null,
        salesRepId,
        outletId,
        orderItems: {
          create: orderItems,
        },
      },
      include: {
        orderItems: {
          include: { product: { select: { name: true, sku: true } } },
        },
        salesRep: { select: { code: true, name: true } },
        outlet: { select: { code: true, name: true } },
      },
    });

    return successResponse(order, 201);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
