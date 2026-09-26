/// <reference lib="dom" />
/**
 * Domain barrel + the canonical, ORDERED route table.
 *
 * api/_index.ts mounts `routes` instead of hand-registering 16 app.get/post/
 * patch/delete calls. The concatenation order below is chosen to reproduce the
 * ORIGINAL registration order of api/_index.ts exactly:
 *
 *   1-4   system      /api/health · /api/ai/test-key · /api/ai/credits · /api/security/log
 *   5     profile     /api/upload/profile-photo
 *   6-10  advisor     session POST/GET · session/:sessionId DELETE ·
 *                     messages/:messageId/reaction PATCH · chat POST
 *   11-13 oracle      analyses POST · analyses/:id/tasks PATCH · analyses/:id DELETE
 *   14    ai          /api/ai/chat
 *   15    account     /api/users/me
 *   16    admin       /api/admin/users/:id
 */
export {
  handleHealth,
  handleTestKey,
  handleSecurityLog,
} from './system.js';
export { handleUploadProfilePhoto } from './profile.js';
export {
  handleCreateAdvisorSession,
  handleGetAdvisorSession,
  handleDeleteAdvisorSession,
  handleUpdateAdvisorReaction,
  handleAdvisorChatStream,
} from './advisor.js';
export {
  handleCreateOracleAnalysis,
  handleUpdateOracleAnalysisTasks,
  handleDeleteOracleAnalysis,
} from './oracle.js';
export { handleCalibrationAnalyze } from './calibration.js';
export { handleAiChat } from './ai.js';
export { handleDeleteMyAccount } from './account.js';
export { handleAdminDeleteUser } from './admin.js';

export type { NormalizedRequest, NormalizedResponse, RouteDef, HandlerRoute, StaticRoute, HttpMethod } from '../types.js';
export { isStaticRoute } from '../types.js';

import type { RouteDef } from '../types.js';
import { routes as systemRoutes } from './system.js';
import { routes as profileRoutes } from './profile.js';
import { routes as advisorRoutes } from './advisor.js';
import { routes as oracleRoutes } from './oracle.js';
import { routes as aiRoutes } from './ai.js';
import { routes as accountRoutes } from './account.js';
import { routes as adminRoutes } from './admin.js';

/** Every route, in the same order api/_index.ts used to register them. */
export const routes: RouteDef[] = [
  ...systemRoutes,
  ...profileRoutes,
  ...advisorRoutes,
  ...oracleRoutes,
  ...aiRoutes,
  ...accountRoutes,
  ...adminRoutes,
];

/** Per-domain tables, handy for tests and for the route-table report. */
export const routesByModule = {
  system: systemRoutes,
  profile: profileRoutes,
  advisor: advisorRoutes,
  oracle: oracleRoutes,
  ai: aiRoutes,
  account: accountRoutes,
  admin: adminRoutes,
} as const;

/**
 * Groups named in the refactor brief that have NO server-side handler in the
 * baseline. They are recorded here as explicit placeholders so nobody assumes
 * they exist. Evidence: none of these paths is registered in api/_index.ts or
 * matched in api/server.ts, and the corresponding frontend pages talk to
 * Supabase directly from the browser.
 */
export const UNSERVED_DOMAINS = {
  auth: 'login / register / logout / refresh / password-reset / session are handled by supabase-js in the browser; there is no /api/auth/* route.',
  'field-report': 'FieldGuidePage reads and writes field_reports / field_report_comments straight from the Supabase client.',
  dossiers: 'DossiersPage reads and writes dossiers straight from the Supabase client.',
  favorites: 'useFavorites reads and writes favorites straight from the Supabase client.',
  subscriptions: 'No tier-gate/Stripe route exists yet; requireTier() reads users directly. Stripe remains WIP.',
} as const;
