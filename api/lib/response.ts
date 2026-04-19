import { Response } from 'express';

/**
 * Standard API response utilities
 * Ensures consistent response formatting across all endpoints
 */

export function sendSuccess<T>(res: Response, data: T, statusCode = 200) {
  res.status(statusCode).json({
    success: true,
    data,
    timestamp: new Date().toISOString()
  });
}

export function sendError(
  res: Response, 
  error: string, 
  statusCode = 400, 
  details?: string,
  code?: string
) {
  res.status(statusCode).json({
    success: false,
    error,
    details: process.env.NODE_ENV === 'development' ? details : undefined,
    code,
    timestamp: new Date().toISOString()
  });
}

export function sendServerError(res: Response, error: unknown) {
  console.error('Server Error:', error);
  
  const message = error instanceof Error ? error.message : 'Internal server error';
  const stack = error instanceof Error ? error.stack : undefined;
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? stack : undefined,
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  });
}

export function handleRouteError(res: Response, error: unknown) {
  if (error instanceof Error && error.message.includes('JSON')) {
    return sendError(res, 'Invalid request data', 400, error.message, 'INVALID_JSON');
  }
  
  if (error instanceof Error && error.message.includes('validation')) {
    return sendError(res, 'Validation failed', 400, error.message, 'VALIDATION_ERROR');
  }
  
  return sendServerError(res, error);
}