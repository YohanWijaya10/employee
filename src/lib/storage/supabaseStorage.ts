/**
 * Supabase Storage Helper
 *
 * Provides functions for uploading visit proof photos and generating signed URLs.
 * All functions are server-side only and should not be imported from client code.
 */

import { getSupabaseAdmin, VISIT_PROOFS_BUCKET } from '@/lib/supabase/server';
import { format } from 'date-fns';

export interface UploadVisitPhotoParams {
  visitId: string;
  salesRepId: string;
  outletId: string;
  fileBuffer: Buffer;
  contentType: string;
  ext: string;
}

export interface UploadResult {
  path: string;
}

export interface SignedUrlResult {
  signedUrl: string;
  expiresIn: number;
}

/**
 * Uploads a visit proof photo to Supabase Storage
 *
 * Object path format: visits/YYYY/MM/DD/sales_{salesRepId}/outlet_{outletId}/visit_{visitId}.{ext}
 *
 * @param params Upload parameters including file buffer and metadata
 * @returns Object containing the storage path
 * @throws Error if upload fails
 */
export async function uploadVisitPhoto(params: UploadVisitPhotoParams): Promise<UploadResult> {
  const { visitId, salesRepId, outletId, fileBuffer, contentType, ext } = params;

  const supabase = getSupabaseAdmin();
  const now = new Date();

  // Build structured path: visits/YYYY/MM/DD/sales_{salesRepId}/outlet_{outletId}/visit_{visitId}.{ext}
  const datePath = format(now, 'yyyy/MM/dd');
  const objectPath = `visits/${datePath}/sales_${salesRepId}/outlet_${outletId}/visit_${visitId}.${ext}`;

  const { error } = await supabase.storage
    .from(VISIT_PROOFS_BUCKET)
    .upload(objectPath, fileBuffer, {
      contentType,
      cacheControl: '3600', // 1 hour cache
      upsert: false, // Don't overwrite existing files
    });

  if (error) {
    // Handle duplicate file error specifically
    if (error.message.includes('already exists') || error.message.includes('Duplicate')) {
      throw new Error(`Photo already exists for this visit: ${objectPath}`);
    }
    throw new Error(`Failed to upload photo: ${error.message}`);
  }

  return { path: objectPath };
}

/**
 * Creates a signed URL for accessing a private storage object
 *
 * @param path The object path in storage
 * @param expiresInSeconds URL validity duration (default: 3600 = 1 hour)
 * @returns Object containing signed URL and expiration info
 * @throws Error if URL generation fails
 */
export async function createSignedUrl(
  path: string,
  expiresInSeconds: number = 3600
): Promise<SignedUrlResult> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.storage
    .from(VISIT_PROOFS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  if (!data?.signedUrl) {
    throw new Error('No signed URL returned from Supabase');
  }

  return {
    signedUrl: data.signedUrl,
    expiresIn: expiresInSeconds,
  };
}

/**
 * Deletes a photo from storage (for cleanup/admin purposes)
 *
 * @param path The object path to delete
 * @throws Error if deletion fails
 */
export async function deleteVisitPhoto(path: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.storage
    .from(VISIT_PROOFS_BUCKET)
    .remove([path]);

  if (error) {
    throw new Error(`Failed to delete photo: ${error.message}`);
  }
}

/**
 * Validates file type and size for upload
 *
 * @param contentType MIME type of the file
 * @param sizeBytes File size in bytes
 * @returns Object with isValid boolean and optional error message
 */
export function validateFile(
  contentType: string,
  sizeBytes: number
): { isValid: boolean; error?: string } {
  const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

  if (!ALLOWED_TYPES.includes(contentType)) {
    return {
      isValid: false,
      error: `Invalid file type: ${contentType}. Allowed: ${ALLOWED_TYPES.join(', ')}`,
    };
  }

  if (sizeBytes > MAX_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File too large: ${(sizeBytes / 1024 / 1024).toFixed(2)}MB. Max: 5MB`,
    };
  }

  return { isValid: true };
}

/**
 * Gets file extension from content type
 */
export function getExtensionFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
  };
  return map[contentType] || 'jpg';
}
