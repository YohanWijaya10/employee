import { NextRequest } from 'next/server';
import { protectRoute, successResponse, errorResponse, serverErrorResponse, notFoundResponse } from '@/lib/auth/middleware';
import { CancelOrderSchema } from '@/lib/validation/schemas';
import prisma from '@/lib/db/prisma';

/**
 * POST /api/orders/[id]/cancel
 * Cancel an order with reason
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = protectRoute(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await request.json();

    // Validate request body
    const parsed = CancelOrderSchema.safeParse({ ...body, orderId: id });
    if (!parsed.success) {
      return errorResponse(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
    }

    const { reason, notes, cancelledBySalesRepId } = parsed.data;

    // Find order
    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true, orderNumber: true, plannedShipDate: true },
    });

    if (!order) {
      return notFoundResponse('Order');
    }

    // Check if order can be cancelled
    if (order.status === 'CANCELLED') {
      return errorResponse('Order is already cancelled');
    }
    if (order.status === 'DELIVERED') {
      return errorResponse('Cannot cancel a delivered order');
    }

    // Calculate hours before ship date
    let hoursBeforeShipDate: number | null = null;
    if (order.plannedShipDate) {
      const now = new Date();
      hoursBeforeShipDate = (order.plannedShipDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    }

    // Cancel order and create log in transaction
    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: {
          salesRep: { select: { code: true, name: true } },
          outlet: { select: { code: true, name: true } },
          orderItems: {
            include: { product: { select: { name: true, sku: true } } },
          },
        },
      }),
      prisma.cancellationLog.create({
        data: {
          orderId: id,
          reason,
          notes: notes || null,
          cancelledBySalesRepId: cancelledBySalesRepId || null,
          hoursBeforeShipDate,
        },
      }),
    ]);

    return successResponse({
      message: `Order ${order.orderNumber} cancelled successfully`,
      order: updatedOrder,
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
