import { describe, it, expect } from 'vitest';
import {
  routes,
  routesByModule,
  UNSERVED_DOMAINS,
  handleHealth,
  handleTestKey,
  handleSecurityLog,
  handleUploadProfilePhoto,
  handleCreateAdvisorSession,
  handleGetAdvisorSession,
  handleDeleteAdvisorSession,
  handleUpdateAdvisorReaction,
  handleAdvisorChatStream,
  handleCreateOracleAnalysis,
  handleUpdateOracleAnalysisTasks,
  handleDeleteOracleAnalysis,
  handleCalibrationAnalyze,
  handleAiChat,
  handleDeleteMyAccount,
  handleAdminDeleteUser,
  isStaticRoute,
} from '../index';

/**
 * Golden route table, parsed out of the PRE-REFACTOR api/_index.ts
 * (`git show <baseline>:api/_index.ts`, lines 258-343).
 *
 * This is the contract. If a future edit adds, drops, renames or reorders a
 * route, this test fails — which is the whole point of the refactor's
 * "public API contracts unchanged" requirement.
 */
const GOLDEN_EXPRESS_ROUTES = [
  'GET /api/health',
  'GET /api/ai/test-key',
  'GET /api/ai/credits',
  'POST /api/security/log',
  'POST /api/upload/profile-photo',
  'POST /api/advisor/session',
  'GET /api/advisor/session',
  'DELETE /api/advisor/session/:sessionId',
  'PATCH /api/advisor/messages/:messageId/reaction',
  'POST /api/advisor/chat',
  'POST /api/oracle/analyses',
  'PATCH /api/oracle/analyses/:id/tasks',
  'DELETE /api/oracle/analyses/:id',
  'POST /api/ai/chat',
  'DELETE /api/users/me',
  'DELETE /api/admin/users/:id',
];

/** Same set, expressed as the Vercel matcher compares them (no prefix). */
const GOLDEN_VERCEL_ROUTES = GOLDEN_EXPRESS_ROUTES.map((r) =>
  r.replace(' /api/', ' ').replace(/:[A-Za-z]+/g, ':param'),
);

describe('route table parity with the pre-refactor registration list', () => {
  it('mounts exactly the same routes, in the same order', () => {
    expect(routes.map((r) => `${r.method} ${r.path}`)).toEqual(GOLDEN_EXPRESS_ROUTES);
  });

  it('has 16 routes — unchanged from the baseline', () => {
    expect(routes).toHaveLength(16);
  });

  it('matches the Vercel matcher surface too', () => {
    const normalized = routes.map((r) =>
      `${r.method} ${r.path}`.replace(' /api/', ' ').replace(/:[A-Za-z]+/g, ':param'),
    );
    expect(normalized).toEqual(GOLDEN_VERCEL_ROUTES);
  });

  it('keeps the /api prefix and method on every entry', () => {
    for (const route of routes) {
      expect(route.path.startsWith('/api/')).toBe(true);
      expect(['GET', 'POST', 'PATCH', 'DELETE']).toContain(route.method);
    }
  });

  it('marks every route except the four public ones as authenticated', () => {
    const publicRoutes = routes
      .filter((r) => r.auth === 'public')
      .map((r) => `${r.method} ${r.path}`);
    expect(publicRoutes).toEqual([
      'GET /api/health',
      'GET /api/ai/test-key',
      'GET /api/ai/credits',
      'POST /api/security/log',
    ]);
  });

  it('answers /api/ai/credits statically, without Supabase or auth', () => {
    const credits = routes.find((r) => r.path === '/api/ai/credits');
    expect(credits).toBeDefined();
    expect(isStaticRoute(credits!)).toBe(true);
    if (isStaticRoute(credits!)) {
      expect(credits.staticResponse).toEqual({
        status: 404,
        body: { error: 'Credits endpoint not available for Regolo AI' },
      });
    }
  });

  it('routes every non-static entry through a callable handler', () => {
    for (const route of routes) {
      if (!isStaticRoute(route)) expect(typeof route.handler).toBe('function');
    }
  });
});

describe('route table by module', () => {
  it('assigns all 16 routes across 7 mounted domains', () => {
    const counts = Object.fromEntries(
      Object.entries(routesByModule).map(([name, table]) => [name, table.length]),
    );
    expect(counts).toEqual({
      system: 4,
      profile: 1,
      advisor: 5,
      oracle: 3,
      ai: 1,
      account: 1,
      admin: 1,
    });
    expect(routes.length).toBe(
      Object.values(routesByModule).reduce((sum, table) => sum + table.length, 0),
    );
  });

  it('reports the brief\'s unserved domains explicitly instead of inventing routes', () => {
    expect(Object.keys(UNSERVED_DOMAINS).sort()).toEqual([
      'auth',
      'dossiers',
      'favorites',
      'field-report',
      'subscriptions',
    ]);
  });
});

describe('barrel surface — no handler lost in the move', () => {
  it('re-exports the same 16 handler names api/_index.ts and api/server.ts import', () => {
    const exported = {
      handleHealth,
      handleTestKey,
      handleSecurityLog,
      handleUploadProfilePhoto,
      handleCreateAdvisorSession,
      handleGetAdvisorSession,
      handleDeleteAdvisorSession,
      handleUpdateAdvisorReaction,
      handleAdvisorChatStream,
      handleCreateOracleAnalysis,
      handleUpdateOracleAnalysisTasks,
      handleDeleteOracleAnalysis,
      handleCalibrationAnalyze,
      handleAiChat,
      handleDeleteMyAccount,
      handleAdminDeleteUser,
    };
    expect(Object.keys(exported)).toHaveLength(16);
    for (const [name, fn] of Object.entries(exported)) {
      expect(typeof fn, `${name} must still be a function`).toBe('function');
    }
  });
});
