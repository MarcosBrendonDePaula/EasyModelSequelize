# Plugins

This folder is for your custom FluxStack plugins.

## 📖 Documentation

For complete plugin development guide, see:
- `LLMD/resources/plugins-external.md` - Full plugin documentation
- `LLMD/reference/plugin-hooks.md` - All available hooks

## 📦 Available CLI Commands

```bash
# Create a new plugin
bun run cli make:plugin my-plugin                    # Basic plugin
bun run cli make:plugin my-plugin --template full    # Full plugin (server + client)
bun run cli make:plugin my-plugin --template server  # Server-only plugin

# Manage plugin dependencies
bun run cli plugin:deps install    # Install plugin dependencies
bun run cli plugin:deps list       # List plugin dependencies
bun run cli plugin:deps check      # Check for conflicts
bun run cli plugin:deps clean      # Clean unused dependencies
```

## 🔌 Plugin Structure

```
plugins/
├── my-plugin/
│   ├── plugin.json       # Plugin metadata (name, version, dependencies)
│   ├── index.ts          # Plugin entry point (server-side hooks)
│   ├── server/           # Server-side code (optional)
│   └── client/           # Client-side code (optional)
```

## ⚡ Quick Start

1. Create your plugin folder: `plugins/my-plugin/`
2. Create `plugin.json` with metadata
3. Create `index.ts` with your plugin logic
4. Use `bun run cli plugin:deps install` if you need extra dependencies

## 🔌 Intercepting Requests

Plugins can intercept and modify requests using hooks:

```typescript
// plugins/my-plugin/index.ts
import type { FluxStack, PluginContext, RequestContext, ResponseContext } from "@core/plugins/types"

export class MyPlugin implements FluxStack.Plugin {
  name = 'my-plugin'
  version = FLUXSTACK_VERSION

  // Intercept every request
  async onRequest(context: PluginContext): Promise<void> {
    // Example: Add custom headers
    const url = (() => {
      try {
        return new URL(PluginContext.request.url)
      } catch {
        const host = PluginContext.request.headers.get('host') || 'localhost'
        return new URL(request.url, `http://${host}`)
      }
    })()
    console.log(`[${this.name}] Request to: ${url.pathname}`)

    // Example: Validate authentication
    const token = request.headers.get('Authorization')
    if (!token && url.pathname.startsWith('/api/protected')) {
      throw new Error('Unauthorized')
    }
  }

  // Intercept every response
  async onResponse(context: PluginContext): Promise<void> {
    console.log(`[${this.name}] Response status: ${PluginContext.response.status}`)
  }

  // Handle errors
  async onError(context: PluginContext, error: Error): Promise<void> {
    console.error(`[${this.name}] Error:`, error.message)
    // Example: Send to error tracking service
  }
}
```

## 📋 Available Hooks

- **`setup`**: Initialize plugin resources (called once at startup)
- **`onServerStart`**: Run when server starts
- **`onRequest`**: Intercept incoming requests (before route handlers)
- **`onResponse`**: Intercept outgoing responses (after route handlers)
- **`onError`**: Handle errors globally

## 💡 Common Use Cases

- **Authentication**: Validate tokens in `onRequest`
- **Logging**: Log requests/responses for analytics
- **Rate Limiting**: Track request counts per IP
- **CORS**: Add headers in `onResponse`
- **Request Transformation**: Modify request body/headers
- **Response Transformation**: Add custom headers, compress responses

See the documentation for detailed examples and best practices.
