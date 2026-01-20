import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import {
  protectRoute,
  successResponse,
  errorResponse,
  serverErrorResponse,
  notFoundResponse,
} from '@/lib/auth/middleware';
import prisma from '@/lib/db/prisma';
import {
  uploadVisitPhoto,
  createSignedUrl,
  validateFile,
  getExtensionFromContentType,
} from '@/lib/storage/supabaseStorage';

/**
 * POST /api/visits/[id]/photo
 * Upload visit proof photo to Supabase Storage
 *
 * Request: multipart/form-data with 'file' field
 * Response: { photoPath, signedUrl, expiresIn }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = protectRoute(request);
  if (authError) return authError;

  try {
    const { id: visitId } = await params;

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return errorResponse('No file provided. Include a "file" field in form-data.');
    }

    // Get file metadata
    const contentType = file.type;
    const sizeBytes = file.size;

    // Validate file type and size
    const validation = validateFile(contentType, sizeBytes);
    if (!validation.isValid) {
      return errorResponse(validation.error!, 400);
    }

    // Load the visit log
    const visitLog = await prisma.visitLog.findUnique({
      where: { id: visitId },
      include: {
        salesRep: { select: { id: true, code: true, name: true } },
        outlet: { select: { id: true, code: true, name: true } },
      },
    });

    if (!visitLog) {
      return notFoundResponse('VisitLog');
    }

    // Check if photo already exists
    if (visitLog.photoPath) {
      return errorResponse('Photo already uploaded for this visit. Use a new visit or delete existing photo first.', 409);
    }

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Compute SHA256 hash
    const photoSha256 = createHash('sha256').update(fileBuffer).digest('hex');

    // Check for duplicate photos by same sales rep (potential fraud indicator)
    const duplicatePhoto = await prisma.visitLog.findFirst({
      where: {
        salesRepId: visitLog.salesRepId,
        photoSha256: photoSha256,
        id: { not: visitId },
      },
      select: {
        id: true,
        checkInTime: true,
        outlet: { select: { code: true, name: true } },
      },
    });

    // Upload to Supabase Storage
    const ext = getExtensionFromContentType(contentType);
    const { path } = await uploadVisitPhoto({
      visitId,
      salesRepId: visitLog.salesRepId,
      outletId: visitLog.outletId,
      fileBuffer,
      contentType,
      ext,
    });

    // Update VisitLog with photo info
    const updateData: { photoPath: string; photoSha256: string; status?: 'VERIFIED' | 'FLAGGED' } = {
      photoPath: path,
      photoSha256,
    };

    // Update status based on distance (threshold: 200 meters)
    const MAX_VERIFIED_DISTANCE = 200; // meters
    if (visitLog.distance <= MAX_VERIFIED_DISTANCE) {
      updateData.status = 'VERIFIED';
    } else {
      updateData.status = 'FLAGGED';
    }

    await prisma.visitLog.update({
      where: { id: visitId },
      data: updateData,
    });

    // Create audit flag if duplicate photo detected
    if (duplicatePhoto) {
      await prisma.auditFlag.create({
        data: {
          entityType: 'VISIT',
          entityId: visitId,
          ruleCode: 'DUPLICATE_PHOTO',
          severity: 'HIGH',
          message: `Duplicate photo detected. Same image was previously uploaded for visit at ${duplicatePhoto.outlet.name} (${duplicatePhoto.outlet.code}) on ${duplicatePhoto.checkInTime.toISOString()}`,
          meta: {
            originalVisitId: duplicatePhoto.id,
            originalOutlet: duplicatePhoto.outlet,
            sha256: photoSha256,
          },
          visitLogId: visitId,
        },
      });
    }

    // Generate signed URL for immediate preview
    const SIGNED_URL_TTL = 3600; // 1 hour
    const { signedUrl, expiresIn } = await createSignedUrl(path, SIGNED_URL_TTL);

    return successResponse({
      photoPath: path,
      signedUrl,
      expiresIn,
      status: updateData.status,
      duplicateDetected: !!duplicatePhoto,
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    return serverErrorResponse(error);
  }
}
