import { Elysia, t } from "elysia"
import { usersRoutes } from "./users.routes"
import { roomRoutes } from "./room.routes"
import { authRoutes } from "./auth.routes"
import { schemaRoutes } from "./schema.routes"

export const apiRoutes = new Elysia({ prefix: "/api" })
  .get("/", () => ({ message: "🔥 Hot Reload funcionando! FluxStack API v1.4.0 ⚡" }), {
    response: t.Object({
      message: t.String()
    }),
    detail: {
      tags: ['Health'],
      summary: 'API Root',
      description: 'Returns a welcome message from the FluxStack API'
    }
  })
  .get("/health", () => ({
    status: "🚀 Hot Reload ativo!",
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    version: "1.4.0",
    environment: "development"
  }), {
    response: t.Object({
      status: t.String(),
      timestamp: t.String(),
      uptime: t.String(),
      version: t.String(),
      environment: t.String()
    }),
    detail: {
      tags: ['Health'],
      summary: 'Health Check',
      description: 'Returns the current health status of the API server'
    }
  })
  // Register routes
  .use(authRoutes)
  .use(usersRoutes)
  .use(roomRoutes)
  .use(schemaRoutes)
