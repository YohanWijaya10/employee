import { NextRequest, NextResponse } from 'next/server';

export interface AuthResult {
  authenticated: boolean;
  error?: string;
}

/**
 * Placeholder auth middleware that checks for X-API-KEY header
 * In production, replace with proper auth (JWT, session, etc.)
 */
export function authenticateRequest(request: NextRequest): AuthResult {
  const apiKey = request.headers.get('X-API-KEY');
  const expectedKey = process.env.INTERNAL_API_KEY;

  // Allow requests without auth in development for easier testing
  if (process.env.NODE_ENV === 'development' && !expectedKey) {
    return { authenticated: true };
  }

  if (!expectedKey) {
    console.warn('INTERNAL_API_KEY not configured');
    return { authenticated: false, error: 'Server misconfigured' };
  }

  if (!apiKey) {
    return { authenticated: false, error: 'Missing X-API-KEY header' };
  }

  if (apiKey !== expectedKey) {
    return { authenticated: false, error: 'Invalid API key' };
  }

  return { authenticated: true };
}

/**
 * Helper to create unauthorized response
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    { error: message, success: false },
    { status: 401 }
  );
}

/**
 * Helper to protect API routes
 * Use at the start of route handlers:
 *
 * const auth = protectRoute(request);
 * if (auth) return auth; // Returns unauthorized response
 */
export function protectRoute(request: NextRequest): NextResponse | null {
  const result = authenticateRequest(request);
  if (!result.authenticated) {
    return unauthorizedResponse(result.error);
  }
  return null;
}

/**
 * API Response helpers
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function validationErrorResponse(errors: Record<string, string[]>): NextResponse {
  return NextResponse.json(
    { success: false, error: 'Validation failed', details: errors },
    { status: 400 }
  );
}

export function notFoundResponse(entity: string = 'Resource'): NextResponse {
  return NextResponse.json(
    { success: false, error: `${entity} not found` },
    { status: 404 }
  );
}

export function serverErrorResponse(error: unknown): NextResponse {
  console.error('Server error:', error);
  const message = error instanceof Error ? error.message : 'Internal server error';
  return NextResponse.json(
    { success: false, error: message },
    { status: 500 }
  );
}
