/**
 * API Error Monitoring and Logging Service
 * Centralizes error handling, monitoring, and reporting for the application
 */

const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const isProd = typeof window !== 'undefined' && (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1');

export enum ErrorSeverity {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

export interface ErrorLog {
  timestamp: number;
  severity: ErrorSeverity;
  service: string;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
  stack?: string;
  userId?: string;
  endpoint?: string;
  statusCode?: number;
}

class APIErrorMonitor {
  private errorLogs: ErrorLog[] = [];
  private maxLogs = 100;

  /**
   * Log an API error
   */
  logError(
    service: string,
    message: string,
    options?: {
      severity?: ErrorSeverity;
      code?: string;
      details?: Record<string, unknown>;
      stack?: string;
      userId?: string;
      endpoint?: string;
      statusCode?: number;
    }
  ): void {
    const errorLog: ErrorLog = {
      timestamp: Date.now(),
      severity: options?.severity || ErrorSeverity.Medium,
      service,
      message,
      code: options?.code,
      details: options?.details,
      stack: options?.stack,
      userId: options?.userId,
      endpoint: options?.endpoint,
      statusCode: options?.statusCode,
    };

    this.errorLogs.push(errorLog);

    // Keep only recent logs
    if (this.errorLogs.length > this.maxLogs) {
      this.errorLogs = this.errorLogs.slice(-this.maxLogs);
    }

    // Log to console in development
    if (isDev) {
      const logLevel =
        errorLog.severity === ErrorSeverity.Critical ? 'error' :
        errorLog.severity === ErrorSeverity.High ? 'warn' :
        'log';

      const fn = console[logLevel as 'log' | 'warn' | 'error'];
      if (typeof fn === 'function') {
        fn.call(console, `[${errorLog.service}] ${errorLog.message}`, errorLog);
      }
    }

    // Send to monitoring service in production
    if (isProd && errorLog.severity === ErrorSeverity.Critical) {
      this.sendToMonitoring(errorLog);
    }
  }

  /**
   * Log an API call result
   */
  logApiCall(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    error?: Error
  ): void {
    if (statusCode >= 400) {
      this.logError('API_CALL', `${method} ${endpoint} failed`, {
        severity: statusCode >= 500 ? ErrorSeverity.High : ErrorSeverity.Medium,
        statusCode,
        endpoint,
        details: { method, duration },
        stack: error?.stack,
      });
    } else if (isDev) {
      console.log(`[API] ${method} ${endpoint} - ${statusCode} (${duration}ms)`);
    }
  }

  /**
   * Get recent error logs
   */
  getRecentErrors(limit = 10): ErrorLog[] {
    return this.errorLogs.slice(-limit);
  }

  /**
   * Clear error logs
   */
  clearLogs(): void {
    this.errorLogs = [];
  }

  /**
   * Send critical errors to monitoring service
   */
  private sendToMonitoring(error: ErrorLog): void {
    // This would integrate with services like Sentry, Rollbar, etc.
    // For now, just log to console
    console.error('Critical error detected:', error);
  }
}

export const apiErrorMonitor = new APIErrorMonitor();

/**
 * Wrap an API call with error monitoring.
 * Uses apiFetch internally so auth headers are included automatically.
 */
export async function monitoredFetch<T>(
  endpoint: string,
  options?: RequestInit,
  timeout = 30000
): Promise<T> {
  const startTime = performance.now();
  const method = options?.method || 'GET';

  // Lazy import to avoid circular dependency at module load time
  const { apiFetch } = await import('../lib/fetch');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await apiFetch(endpoint, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = performance.now() - startTime;

    if (!response.ok) {
      await response.json().catch(() => ({}));
      apiErrorMonitor.logApiCall(endpoint, method, response.status, duration);
      throw new Error(
        `API Error: ${response.status} ${response.statusText}`,
      );
    }

    apiErrorMonitor.logApiCall(endpoint, method, response.status, duration);
    return await response.json();
  } catch (error) {
    const duration = performance.now() - startTime;

    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      apiErrorMonitor.logError('API_CALL', 'Network error', {
        severity: ErrorSeverity.High,
        endpoint,
        details: { method, duration },
        stack: (error as Error).stack,
      });
    } else {
      apiErrorMonitor.logError('API_CALL', 'Request failed', {
        severity: ErrorSeverity.High,
        endpoint,
        details: { method, duration },
        stack: (error as Error).stack,
      });
    }

    throw error;
  }
}

/**
 * Handle API response errors gracefully
 */
export function handleApiError(error: unknown, context: string): string {
  if (error instanceof Error) {
    apiErrorMonitor.logError(context, error.message, {
      severity: ErrorSeverity.Medium,
      stack: error.stack,
    });
    return error.message;
  }

  const message = String(error);
  apiErrorMonitor.logError(context, message, {
    severity: ErrorSeverity.Medium,
  });
  return message;
}
