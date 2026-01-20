import { NextRequest } from 'next/server';
import {
  protectRoute,
  successResponse,
  errorResponse,
  serverErrorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/auth/middleware';
import prisma from '@/lib/db/prisma';
import { CreateVisitCheckInSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * POST /api/visits/check-in
 * Create a new visit log with geo check-in
 *
 * Request body:
 * {
 *   salesRepId: string,
 *   outletId: string,
 *   latitude: number,
 *   longitude: number,
 *   accuracy?: number,
 *   checkInTime?: string (ISO datetime),
 *   notes?: string
 * }
 */
export async function POST(request: NextRequest) {
  const authError = protectRoute(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    // Validate request body
    const parsed = CreateVisitCheckInSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      parsed.error.errors.forEach((err) => {
        const path = err.path.join('.');
        if (!errors[path]) errors[path] = [];
        errors[path].push(err.message);
      });
      return validationErrorResponse(errors);
    }

    const { salesRepId, outletId, latitude, longitude, accuracy, checkInTime, notes } = parsed.data;

    // Verify sales rep exists and is active
    const salesRep = await prisma.salesRep.findUnique({
      where: { id: salesRepId },
      select: { id: true, code: true, name: true, isActive: true },
    });

    if (!salesRep) {
      return notFoundResponse('SalesRep');
    }

    if (!salesRep.isActive) {
      return errorResponse('Sales rep is not active', 403);
    }

    // Verify outlet exists and is active
    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      select: {
        id: true,
        code: true,
        name: true,
        latitude: true,
        longitude: true,
        isActive: true,
      },
    });

    if (!outlet) {
      return notFoundResponse('Outlet');
    }

    if (!outlet.isActive) {
      return errorResponse('Outlet is not active', 403);
    }

    // Calculate distance from outlet
    let distance = 0;
    if (outlet.latitude !== null && outlet.longitude !== null) {
      distance = calculateDistance(latitude, longitude, outlet.latitude, outlet.longitude);
    }

    const serverTime = new Date();
    const clientCheckInTime = checkInTime ? new Date(checkInTime) : serverTime;

    // Determine initial status based on distance
    const MAX_VERIFIED_DISTANCE = 200; // meters
    const status = distance <= MAX_VERIFIED_DISTANCE ? 'PENDING' : 'FLAGGED';

    // Create visit log
    const visitLog = await prisma.visitLog.create({
      data: {
        salesRepId,
        outletId,
        latitude,
        longitude,
        accuracy,
        distance,
        status,
        checkInTime: clientCheckInTime,
        serverTime,
        notes,
      },
      include: {
        salesRep: { select: { id: true, code: true, name: true } },
        outlet: { select: { id: true, code: true, name: true, latitude: true, longitude: true } },
      },
    });

    // Create audit flag if distance is too far
    if (distance > MAX_VERIFIED_DISTANCE) {
      await prisma.auditFlag.create({
        data: {
          entityType: 'VISIT',
          entityId: visitLog.id,
          ruleCode: 'DISTANCE_TOO_FAR',
          severity: 'WARN',
          message: `Check-in location is ${distance.toFixed(0)}m from outlet (threshold: ${MAX_VERIFIED_DISTANCE}m)`,
          meta: {
            checkInLat: latitude,
            checkInLng: longitude,
            outletLat: outlet.latitude,
            outletLng: outlet.longitude,
            distance,
            threshold: MAX_VERIFIED_DISTANCE,
          },
          visitLogId: visitLog.id,
        },
      });
    }

    return successResponse(
      {
        ...visitLog,
        distance: Math.round(distance),
        distanceStatus: distance <= MAX_VERIFIED_DISTANCE ? 'OK' : 'TOO_FAR',
      },
      201
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse('Invalid request body');
    }
    return serverErrorResponse(error);
  }
}
