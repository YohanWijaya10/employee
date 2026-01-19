import { NextRequest } from 'next/server';
import { protectRoute, successResponse, errorResponse, serverErrorResponse, notFoundResponse } from '@/lib/auth/middleware';
import { UpdateOrderStatusSchema } from '@/lib/validation/schemas';
import prisma from '@/lib/db/prisma';
import { OrderStatus } from '@prisma/client';

// Valid status transitions
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CREATED: ['READY_TO_SHIP', 'CANCELLED'],
  READY_TO_SHIP: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [], // Final state
  CANCELLED: [], // Final state
};

/**
 * GET /api/orders/[id]
 * Get order details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = protectRoute(request);
  if (authError) return authError;

  try {
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: {
            product: { select: { id: true, sku: true, name: true, category: true } },
          },
        },
        salesRep: { select: { id: true, code: true, name: true, email: true } },
        outlet: { select: { id: true, code: true, name: true, address: true, city: true } },
        cancellation: true,
        auditFlags: true,
      },
    });

    if (!order) {
      return notFoundResponse('Order');
    }

    return successResponse(order);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

/**
 * PATCH /api/orders/[id]
 * Update order status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = protectRoute(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await request.json();

    // Find current order
    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true, plannedShipDate: true },
    });

    if (!order) {
      return notFoundResponse('Order');
    }

    const { newStatus, cancellationReason, cancellationNotes, cancelledBySalesRepId } = body;

    if (!newStatus) {
      return errorResponse('newStatus is required');
    }

    // Validate status transition
    const validNextStatuses = VALID_TRANSITIONS[order.status];
    if (!validNextStatuses.includes(newStatus)) {
      return errorResponse(
        `Invalid status transition: ${order.status} -> ${newStatus}. Valid transitions: ${validNextStatuses.join(', ') || 'none (final state)'}`
      );
    }

    // Handle cancellation
    if (newStatus === 'CANCELLED') {
      if (!cancellationReason) {
        return errorResponse('cancellationReason is required when cancelling an order');
      }

      // Calculate hours before ship date if applicable
      let hoursBeforeShipDate: number | null = null;
      if (order.plannedShipDate) {
        const now = new Date();
        hoursBeforeShipDate = (order.plannedShipDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      }

      // Update order and create cancellation log
      const [updatedOrder] = await prisma.$transaction([
        prisma.order.update({
          where: { id },
          data: { status: 'CANCELLED' },
          include: {
            salesRep: { select: { code: true, name: true } },
            outlet: { select: { code: true, name: true } },
            cancellation: true,
          },
        }),
        prisma.cancellationLog.create({
          data: {
            orderId: id,
            reason: cancellationReason,
            notes: cancellationNotes,
            cancelledBySalesRepId: cancelledBySalesRepId || null,
            hoursBeforeShipDate,
          },
        }),
      ]);

      return successResponse(updatedOrder);
    }

    // Handle other status updates
    const updateData: Parameters<typeof prisma.order.update>[0]['data'] = {
      status: newStatus,
    };

    if (newStatus === 'DELIVERED') {
      updateData.deliveredAt = new Date();
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        salesRep: { select: { code: true, name: true } },
        outlet: { select: { code: true, name: true } },
        cancellation: true,
      },
    });

    return successResponse(updatedOrder);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
