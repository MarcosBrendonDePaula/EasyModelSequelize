# Project Structure

**Version:** 1.11.0 | **Updated:** 2025-02-08

## Quick Facts

- `core/` is **read-only** framework code - NEVER modify
- `app/` contains all user application code
- `config/` holds declarative configuration files
- `plugins/` is for external plugin development
- Path aliases simplify imports across the project

## Directory Organization

### core/ - Framework Code (READ-ONLY)

**Rule:** NEVER modify files in `core/`

```
core/
├── framework/      # Core framework server and lifecycle
├── plugins/        # Plugin system (manager, registry, types)
├── server/         # Server utilities (live components, middleware)
├── client/         # Client-side framework utilities
├── build/          # Build system and bundling
├── cli/            # CLI commands and generators
├── utils/          # Framework utilities
├── types/          # Framework type definitions
└── templates/      # Code generation templates
```

**Why read-only?**
- Framework updates would overwrite your changes
- Breaking changes could occur on version upgrades
- Customization should happen through plugins or app code

**What to do instead:**
- Create plugins in `plugins/` for framework extensions
- Override behavior using plugin hooks
- Implement custom logic in `app/`

### app/ - Application Code (MODIFY HERE)

**Rule:** All your application code goes here

```
app/
├── server/         # Backend code
│   ├── routes/     # API route definitions (Eden Treaty)
│   ├── controllers/# Business logic and services
│   ├── live/       # Live component implementations
│   ├── websockets/ # WebSocket handlers
│   ├── utils/      # Server-side utilities
│   ├── app.ts      # Elysia app configuration
│   └── index.ts    # Server entrypoint
├── client/         # Frontend code
│   ├── src/        # React application source
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── stores/      # State management (Zustand)
│   │   ├── utils/       # Client-side utilities
│   │   ├── App.tsx      # Root component
│   │   └── main.tsx     # React entrypoint
│   ├── public/     # Static assets
│   └── index.html  # HTML template
└── shared/         # Shared code between client and server
    └── types/      # Shared TypeScript types
```

**Organization principles:**
- **server/routes/**: Define API endpoints with schemas
- **server/controllers/**: Implement business logic (keep routes thin)
- **client/src/**: All React code and frontend logic
- **shared/types/**: Types used by both frontend and backend

### config/ - Configuration Files

```
config/
├── system/              # Framework system configs (rarely modified)
│   ├── app.config.ts
│   ├── server.config.ts
│   ├── client.config.ts
│   ├── build.config.ts
│   ├── plugins.config.ts
│   └── ...
├── app.config.ts        # Application-specific config
├── server.config.ts     # Server configuration
├── client.config.ts     # Client configuration
├── database.config.ts   # Database configuration
├── plugins.config.ts    # Plugin configuration
└── index.ts             # Config aggregator
```

**Two-tier system:**
- `config/system/`: Framework defaults (use `defineConfig`)
- `config/*.config.ts`: User overrides and custom configs

**Best practices:**
- Override system configs by creating same-named file in `config/`
- Use `defineConfig` for type safety and validation
- Keep sensitive values in environment variables

### plugins/ - External Plugins

```
plugins/
└── your-plugin/
    ├── index.ts         # Plugin entrypoint
    ├── server/          # Server-side plugin code
    ├── client/          # Client-side plugin code
    └── package.json     # Plugin metadata
```

**When to create a plugin:**
- Reusable functionality across projects
- Framework extensions (new hooks, middleware)
- Third-party integrations
- Shareable with community

**When NOT to use plugins:**
- Application-specific business logic → use `app/`
- Simple utilities → use `app/server/utils/` or `app/client/utils/`

## File Naming Conventions

### General Rules

- **kebab-case** for directories: `user-management/`, `auth-service/`
- **kebab-case** for files: `user-controller.ts`, `auth-utils.ts`
- **PascalCase** for React components: `UserProfile.tsx`, `LoginForm.tsx`
- **camelCase** for utility files: `formatDate.ts`, `apiClient.ts`

### Specific Patterns

**Routes:**
```
app/server/routes/
├── users.ts           # /users endpoints
├── auth.ts            # /auth endpoints
└── admin/
    └── dashboard.ts   # /admin/dashboard endpoints
```

**Controllers:**
```
app/server/controllers/
├── UserController.ts
├── AuthController.ts
└── services/
    ├── UserService.ts
    └── AuthService.ts
```

**React Components:**
```
app/client/src/components/
├── UserProfile.tsx
├── LoginForm.tsx
└── common/
    ├── Button.tsx
    └── Input.tsx
```

**Types:**
```
app/shared/types/
├── user.types.ts
├── auth.types.ts
└── api.types.ts
```

## Import Path Aliases

**Configured in `tsconfig.json`:**

```typescript
{
  "paths": {
    "@core/*": ["./core/*"],           // Framework code
    "@app/*": ["./app/*"],             // Application root
    "@server/*": ["./app/server/*"],   // Server code
    "@client/*": ["./app/client/*"],   // Client code
    "@shared/*": ["./app/shared/*"],   // Shared code
    "@config": ["./config/index.ts"],  // Config aggregator
    "@config/*": ["./config/*"]        // Individual configs
  }
}
```

### Usage Examples

**Server-side imports:**
```typescript
// ✅ Good - Use aliases
import { UserController } from '@server/controllers/UserController'
import { UserType } from '@shared/types/user.types'
import { serverConfig } from '@config'

// ❌ Bad - Relative paths
import { UserController } from '../../server/controllers/UserController'
import { UserType } from '../../../shared/types/user.types'
```

**Client-side imports:**
```typescript
// ✅ Good - Use aliases
import { UserProfile } from '@client/components/UserProfile'
import { useAuth } from '@client/hooks/useAuth'
import { UserType } from '@shared/types/user.types'

// ❌ Bad - Relative paths
import { UserProfile } from '../components/UserProfile'
import { useAuth } from '../../hooks/useAuth'
```

**Plugin imports:**
```typescript
// ✅ Good - Import from core for plugin development
import type { FluxStackPlugin } from '@core/types/plugin.types'
import { logger } from '@core/utils/logger'

// ✅ Good - Import app code if needed
import { UserType } from '@shared/types/user.types'
```

### Alias Rules

1. **Always use aliases** for cross-directory imports
2. **Relative paths OK** for same-directory imports: `./utils`, `./types`
3. **Never import from `core/`** in app code (except types)
4. **Use `@shared/*`** for code used by both client and server

## Common Patterns

### Creating a New Feature

1. **Define types** in `app/shared/types/feature.types.ts`
2. **Create route** in `app/server/routes/feature.ts`
3. **Implement controller** in `app/server/controllers/FeatureController.ts`
4. **Build UI** in `app/client/src/pages/FeaturePage.tsx`
5. **Use Eden Treaty** in client to call API with type safety

### Adding Configuration

1. **Create config file** in `config/feature.config.ts`
2. **Use `defineConfig`** for schema and validation
3. **Export from** `config/index.ts`
4. **Import with** `@config` alias

### Creating a Plugin

1. **Create directory** in `plugins/my-plugin/`
2. **Implement interface** from `@core/types/plugin.types`
3. **Add to whitelist** in `config/plugins.config.ts`
4. **Framework auto-discovers** on startup

## Related

- [Type Safety Patterns](./type-safety.md)
- [Anti-Patterns](./anti-patterns.md)
- [Plugin Development](../resources/plugins-external.md)
- [Configuration System](../config/declarative-system.md)
