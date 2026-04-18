export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = (error as { code?: string })?.code;

  // Handle quota errors gracefully - don't throw
  if (errorCode === 'resource-exhausted' || errorMessage.includes('quota')) {
    console.info('Quota exceeded, operation will use local fallback');
    return; // Don't throw for quota errors
  }

  console.error('Error:', errorMessage);
  // Error info is no longer Firebase-specific
  const errInfo = {
    error: errorMessage,
    operationType,
    path,
    authInfo: {
      userId: undefined,
      email: undefined,
      emailVerified: undefined,
      isAnonymous: undefined,
      tenantId: undefined,
      providerInfo: []
    }
  };
  console.error('Error info:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Hook for handling async errors in components
export function useErrorHandler() {
  return (error: Error | string, _context?: string) => {
    const message = typeof error === 'string' ? error : error.message;

    console.error('Error handled by useErrorHandler:', serializeError(error));

    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      console.error('Production error:', message);
      // errorReportingService.captureMessage(message, 'error');
    }
  };
}

// Utility function for handling promise rejections
export function handleAsyncError(promise: Promise<unknown>, context?: string) {
  return promise.catch((error) => {
    console.error(`Async error${context ? ` in ${context}` : ''}:`, serializeError(error));

    if (error.name !== 'ChunkLoadError') {
      // toast.error(`Something went wrong${context ? ` ${context.toLowerCase()}` : ''}`);
    }

    throw error;
  });
}

// Function to get user-friendly error message from Supabase auth errors
export function getSupabaseErrorMessage(error: unknown): string {
  if (!error) return 'An unknown error occurred';

  const message = (error as { message?: string }).message || String(error);

  // Handle common Supabase auth errors
  if (message.includes('Invalid login credentials')) {
    return 'Invalid email or password';
  }
  if (message.includes('Email not confirmed')) {
    return 'Please check your email and confirm your account';
  }
  if (message.includes('User already registered')) {
    return 'An account with this email already exists';
  }
  if (message.includes('Password should be at least 6 characters')) {
    return 'Password must be at least 6 characters long';
  }
  if (message.includes('Unable to validate email address')) {
    return 'Please enter a valid email address';
  }
  if (message.includes('Failed to fetch')) {
    return 'Network error - please check your connection';
  }

  // Return the original message if no specific handling
  return message;
}

// Email validation utility
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Input sanitization utility
export function sanitizeInput(input: string): string {
  // Remove potentially dangerous characters and trim
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

// Helper function to properly serialize Error objects for logging
export function serializeError(err: unknown): Record<string, any> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      ...(err as any) // Include any custom properties
    };
  }
  return { error: err };
}
