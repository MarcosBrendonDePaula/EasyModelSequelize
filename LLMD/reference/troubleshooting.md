# Troubleshooting

**Version:** 1.11.0 | **Updated:** 2025-02-08

## Quick Facts

- Most issues: missing response schemas, wrong imports, or port conflicts
- Always run `bunx tsc --noEmit` to check types first
- Development URLs: Backend :3000, Frontend :5173, Swagger :3000/swagger

## Diagnostic Commands

```bash
# Check APIs
curl http://localhost:3000/api/health

# Check TypeScript
bunx tsc --noEmit

# Check tests
bun run test

# Check build
bun run build
```

## Type Inference Issues

### Problem: Eden Treaty Returns `unknown`

**Symptom:**
```typescript
const { data, error } = await api.users.get()
// data is 'unknown' instead of { users: User[] }
```

**Cause:** Missing response schema in route definition.

**Solution:**
```typescript
// Add response schema to route
export const usersRoutes = new Elysia()
  .get("/", handler, {
    response: t.Object({
      users: t.Array(t.Object({
        id: t.Number(),
        name: t.String(),
        email: t.String()
      }))
    })
  })
```

### Problem: TypeScript Doesn't See Type Changes

**Solution:**
```bash
# 1. Restart TS Server (VS Code)
Ctrl+Shift+P → "TypeScript: Restart TS Server"

# 2. Or clear cache
rm -rf node_modules/.cache
bun install
```

## Server Issues

### Problem: Port Already in Use

**Symptom:** `Error: EADDRINUSE: address already in use :::3000`

**Solution:**
```bash
# Find process (Linux/Mac)
lsof -i :3000
kill -9 <PID>

# Find process (Windows)
netstat -ano | findstr :3000
taskkill /F /PID <PID>

# Or use different port
PORT=3001 bun run dev
```

### Problem: Hot Reload Not Working

**Solution:**
```bash
# Kill all node/bun processes
pkill -f bun  # Mac/Linux
taskkill /F /IM bun.exe  # Windows

# Restart
bun run dev
```

### Problem: Vite Module Runner Error

**Symptom:** `Cannot find module 'vite/module-runner'`

**Cause:** Vite being imported in production mode.

**Solution:**
```bash
# Ensure NODE_ENV is set correctly
export NODE_ENV=development
bun run dev
```

## API/Request Issues

### Problem: CORS Errors

**Symptom:** Browser console shows CORS policy errors.

**Note:** CORS is expected when frontend (5173) calls backend (3000).

**Verify API works:**
```bash
curl http://localhost:3000/api/health
```

**If CORS config needed:**
```typescript
// config/server.config.ts
export const serverConfig = defineConfig({
  cors: {
    origins: config.array('CORS_ORIGINS', ['http://localhost:5173']),
    credentials: config.boolean('CORS_CREDENTIALS', true)
  }
})
```

### Problem: 404 Not Found

**Check 1:** Route registration
```typescript
// Ensure route is registered in app/server/routes/index.ts
export const apiRoutes = new Elysia({ prefix: "/api" })
  .use(usersRoutes)  // ← Must be registered
```

**Check 2:** Prefix stacking
```typescript
// If usersRoutes has prefix "/users"
// And apiRoutes has prefix "/api"
// Final URL is: /api/users
```

### Problem: Validation Errors

**Symptom:** `Body validation failed`

**Solution:** Verify request matches schema:
```typescript
// Route expects:
body: t.Object({
  name: t.String({ minLength: 2 }),
  email: t.String({ format: "email" })
})

// Request must provide:
await api.users.post({
  name: "Jo",        // ← At least 2 chars
  email: "jo@x.com"  // ← Valid email format
})
```

## Build Issues

### Problem: Build Fails with Import Errors

**Symptom:** `Cannot resolve './../../something'`

**Solution:** Use path aliases:
```typescript
// ❌ Wrong
import { api } from '../../../lib/eden-api'

// ✅ Correct
import { api } from '@client/lib/eden-api'
```

### Problem: Build Type Errors

**Solution:**
```bash
# Check types before build
bunx tsc --noEmit

# Clear and rebuild
rm -rf dist/
bun run build
```

### Problem: Assets Not Loading in Production

**Solution:** Use public/ folder for static assets:
```typescript
// ❌ Wrong - bundler might not include
import logo from '../assets/logo.png'

// ✅ Correct - serve from public/
<img src="/logo.png" />  // File at public/logo.png
```

## Plugin Issues

### Problem: Plugin Not Loading

**Check 1:** NPM plugins require whitelist
```bash
# .env
PLUGINS_DISCOVER_NPM=true
PLUGINS_ALLOWED=plugin-name
```

**Check 2:** Project plugins auto-discover
```bash
# Must be in plugins/ directory
plugins/my-plugin/index.ts
```

**Check 3:** Plugin exports correctly
```typescript
// plugins/my-plugin/index.ts
export default {
  name: 'my-plugin',
  setup: async (ctx) => { /* ... */ }
} satisfies FluxStack.Plugin
```

### Problem: Plugin Blocked by Security

**Symptom:** Log shows `Plugin blocked: not in whitelist`

**Solution:**
```bash
# Add to whitelist
bun run flux plugin:add plugin-name

# Or manually in .env
PLUGINS_ALLOWED=existing-plugins,new-plugin
```

## Frontend/React Issues

### Problem: State Not Updating After API Call

**Solution:** Ensure state setter is called:
```typescript
const createUser = async (userData) => {
  const { data, error } = await api.users.post(userData)

  if (!error && data.success) {
    setUsers(prev => [...prev, data.user])  // ← Don't forget!
  }
}
```

### Problem: Infinite Re-renders

**Cause:** useEffect without dependency array.

**Solution:**
```typescript
// ❌ Wrong - runs every render
useEffect(() => {
  loadUsers()
})

// ✅ Correct - runs once
useEffect(() => {
  loadUsers()
}, [])
```

### Problem: Memory Leak Warning

**Symptom:** `Can't perform state update on unmounted component`

**Solution:** Add cleanup:
```typescript
useEffect(() => {
  let mounted = true

  const loadData = async () => {
    const { data, error } = await api.users.get()
    if (mounted && !error) {
      setUsers(data.users)
    }
  }

  loadData()
  return () => { mounted = false }
}, [])
```

## Docker Issues

### Problem: Container Won't Start

**Check logs:**
```bash
docker logs <container-id>
```

**Common causes:**
1. Missing env vars → Check docker-compose.yml
2. Port conflict → Change exposed ports
3. Build failure → Rebuild image

### Problem: Docker Build Fails

**Check .dockerignore doesn't exclude:**
- `package.json`
- `bun.lockb`
- `tsconfig.json`

## Testing Issues

### Problem: Tests Can't Find Module

**Solution:** Ensure test config matches main tsconfig paths:
```typescript
// vitest.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@client': './app/client/src',
      '@server': './app/server',
      '@shared': './app/shared'
    }
  }
})
```

### Problem: Mocks Not Applied

**Solution:** Import order matters:
```typescript
// ✅ Correct order
import { vi } from 'vitest'
vi.mock('@client/lib/eden-api')
import { Component } from './Component'
```

## Quick Checklist

When something breaks:

1. **Check types:** `bunx tsc --noEmit`
2. **Check ports:** Are 3000/5173 free?
3. **Check schemas:** Response schemas defined?
4. **Check imports:** Using path aliases?
5. **Restart:** `bun run dev` fresh
6. **Clean:** `rm -rf node_modules && bun install`

## Related

- [Type Safety](../patterns/type-safety.md)
- [Anti-Patterns](../patterns/anti-patterns.md)
- [Routes with Eden Treaty](../resources/routes-eden.md)
