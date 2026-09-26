/// <reference lib="dom" />
/**
 * Public entry point for the backend handlers.
 *
 * This file used to hold ~1,400 lines and every route handler in the project.
 * It is now a thin barrel: the implementation lives in ./handlers/<domain>.ts
 * and this module re-exports it so the existing specifier `./lib/handlers.js`
 * keeps resolving unchanged in api/_index.ts, api/server.ts and
 * api/lib/handlers.test.ts. Nothing else about those call sites changes.
 *
 * Domain map (all bodies moved verbatim — see the header of each module):
 *   system.ts       handleHealth · handleTestKey · handleSecurityLog
 *   profile.ts      handleUploadProfilePhoto
 *   advisor.ts      advisor sessions, reactions, streaming chat
 *   oracle.ts       oracle analyses (create / patch tasks / delete)
 *   calibration.ts  handleCalibrationAnalyze  (exported, not mounted — see file)
 *   ai.ts           handleAiChat
 *   account.ts      handleDeleteMyAccount
 *   admin.ts        handleAdminDeleteUser
 */
export {
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
  routes,
  routesByModule,
  UNSERVED_DOMAINS,
} from './handlers/index.js';

export type {
  NormalizedRequest,
  NormalizedResponse,
  RouteDef,
  HandlerRoute,
  StaticRoute,
  HttpMethod,
} from './types.js';
export {
  handleGetMyProfilePhotoUrl,
  handleAdminGetUserPhotoUrl,
  handleAdminUpdateUserRole,
} from './handlers/photoAdmin.js';
export {
  handleRagReindex,
  handleRagStatus,
  handleRagToggle,
} from './handlers/rag.js';
