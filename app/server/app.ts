/**
 * 🎯 Application Instance - Single Source of Truth
 *
 * This instance is used by:
 * - index.ts (full-stack & backend-only modes via FLUXSTACK_MODE env)
 * - Eden Treaty client (type inference)
 *
 * This ensures that the type exported for Eden Treaty is exactly
 * the same as what the server uses.
 */

import { Elysia } from "elysia"
import { apiRoutes } from "./routes"

/**
 * Main application instance with all routes registered
 */
export const appInstance = new Elysia()
  .use(apiRoutes)     // Main application routes

// Export the type correctly for Eden Treaty
export type App = typeof appInstance