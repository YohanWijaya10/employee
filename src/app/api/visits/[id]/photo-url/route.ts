import { NextRequest } from 'next/server';
import {
  protectRoute,
  successResponse,
  errorResponse,
  serverErrorResponse,
  notFoundResponse,
} from '@/lib/auth/middleware';
import prisma from '@/lib/db/prisma';
import { createSignedUrl } from '@/lib/storage/supabaseStorage';

/**
 * GET /api/visits/[id]/photo-url
 * Get a signed URL for viewing a visit's proof photo
 *
 * Response: { signedUrl, expiresIn }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = protectRoute(request);
  if (authError) return authError;

  try {
    const { id: visitId } = await params;

    // Load the visit log
    const visitLog = await prisma.visitLog.findUnique({
      where: { id: visitId },
      select: {
        id: true,
        photoPath: true,
      },
    });

    if (!visitLog) {
      return notFoundResponse('VisitLog');
    }

    if (!visitLog.photoPath) {
      return errorResponse('No photo uploaded for this visit', 404);
    }

    // Generate signed URL with 1 hour TTL
    const SIGNED_URL_TTL = 3600; // 1 hour
    const { signedUrl, expiresIn } = await createSignedUrl(visitLog.photoPath, SIGNED_URL_TTL);

    return successResponse({
      signedUrl,
      expiresIn,
    });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return serverErrorResponse(error);
  }
}
