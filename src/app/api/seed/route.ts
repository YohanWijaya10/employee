import { NextRequest, NextResponse } from 'next/server';
import { protectRoute, successResponse, errorResponse, serverErrorResponse } from '@/lib/auth/middleware';

/**
 * POST /api/seed
 * Development only - trigger database seeding
 * Run the actual seed from CLI: npm run db:seed
 */
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return errorResponse('Seed endpoint is only available in development', 403);
  }

  const authError = protectRoute(request);
  if (authError) return authError;

  return NextResponse.json({
    success: true,
    message: 'Please run the seed script from CLI: npm run db:seed',
    instructions: [
      '1. Ensure DATABASE_URL is set in .env',
      '2. Run: npx prisma db push',
      '3. Run: npm run db:seed',
    ],
  });
}
