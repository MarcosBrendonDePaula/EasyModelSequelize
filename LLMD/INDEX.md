# FluxStack LLM Documentation

**Version:** 1.12.1 | **Framework:** Bun + Elysia + React + Eden Treaty

## Quick Navigation

**AI Agent?** → [agent.md](agent.md) - Guia completo para agentes de IA
**First Time?** → [core/framework-lifecycle.md](core/framework-lifecycle.md)
**Creating Routes?** → [resources/routes-eden.md](resources/routes-eden.md)
**REST API Auth?** → [resources/rest-auth.md](resources/rest-auth.md)
**Live Components Auth?** → [resources/live-auth.md](resources/live-auth.md)
**Real-time Rooms?** → [resources/live-rooms.md](resources/live-rooms.md)
**Debugging Logs?** → [resources/live-logging.md](resources/live-logging.md)
**Config Issues?** → [config/declarative-system.md](config/declarative-system.md)
**Plugin Development?** → [resources/plugins-external.md](resources/plugins-external.md)
**Errors?** → [reference/troubleshooting.md](reference/troubleshooting.md)

## Core Concepts

- [Framework Lifecycle](core/framework-lifecycle.md) - Startup, request handling, shutdown
- [Plugin System](core/plugin-system.md) - Architecture, hooks, load order
- [Build System](core/build-system.md) - Dev vs production builds

## Configuration

- [Declarative System](config/declarative-system.md) - defineConfig, validation, types
- [Environment Variables](config/environment-vars.md) - Complete reference
- [Runtime Reload](config/runtime-reload.md) - Hot config updates

## Creating Resources

- [Routes with Eden Treaty](resources/routes-eden.md) - Type-safe API routes
- [Controllers & Services](resources/controllers.md) - Business logic patterns
- [Live Components](resources/live-components.md) - WebSocket components
- [REST Auth](resources/rest-auth.md) - Session & Token guards, middleware, rate limiting
- [Live Auth](resources/live-auth.md) - Authentication for Live Components
- [Live Rooms](resources/live-rooms.md) - Multi-room real-time communication
- [Live Logging](resources/live-logging.md) - Per-component logging control
- [Live Upload](resources/live-upload.md) - Chunked upload via Live Components
- [External Plugins](resources/plugins-external.md) - Plugin development
- [Routing (React Router v7)](reference/routing.md) - Frontend routing setup

## Patterns & Rules

- [Project Structure](patterns/project-structure.md) - Folder organization
- [Type Safety](patterns/type-safety.md) - Eden Treaty type flow
- [Anti-Patterns](patterns/anti-patterns.md) - What NOT to do

## Reference

- [CLI Commands](reference/cli-commands.md) - Complete command reference
- [Plugin Hooks](reference/plugin-hooks.md) - All available hooks
- [Troubleshooting](reference/troubleshooting.md) - Common issues

## Critical Rules

**NEVER:**
- Modify files in `core/` (framework is read-only)
- Wrap Eden Treaty in custom functions
- Omit response schemas in routes

**ALWAYS:**
- Work in `app/` directory
- Use native Eden Treaty: `const { data, error } = await api.users.get()`
- Define shared types in `app/shared/`
- Run `bun run dev` after changes

## Migration & Maintenance

- [MIGRATION.md](MIGRATION.md) - Changes from `ai-context/` to `LLMD/`
- [MAINTENANCE.md](MAINTENANCE.md) - How to update this documentation
