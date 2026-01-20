import { NextRequest } from 'next/server';
import {
  protectRoute,
  successResponse,
  serverErrorResponse,
  notFoundResponse,
} from '@/lib/auth/middleware';
import prisma from '@/lib/db/prisma';

/**
 * GET /api/visits/[id]
 * Get visit details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = protectRoute(request);
  if (authError) return authError;

  try {
    const { id } = await params;

    const visit = await prisma.visitLog.findUnique({
      where: { id },
      include: {
        salesRep: { select: { id: true, code: true, name: true, email: true, phone: true } },
        outlet: {
          select: {
            id: true,
            code: true,
            name: true,
            address: true,
            city: true,
            latitude: true,
            longitude: true,
          },
        },
        auditFlags: {
          select: {
            id: true,
            ruleCode: true,
            severity: true,
            message: true,
            meta: true,
            createdAt: true,
            isResolved: true,
          },
        },
      },
    });

    if (!visit) {
      return notFoundResponse('VisitLog');
    }

    return successResponse(visit);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
