# CLI Commands Reference

**Version:** 1.11.0 | **Updated:** 2025-02-08

## Quick Facts

- CLI entry: `bun run flux <command>` or directly via npm scripts
- Commands are modular, each in `core/cli/commands/`
- Plugins can register custom commands
- Aliases supported (e.g., `g` for `generate`)

## Development Commands

### dev

Start full-stack development server with hot reload.

```bash
bun run dev                    # Full-stack (default)
bun run dev --port 4000        # Custom backend port
bun run dev --frontend-only    # Vite only (port 5173)
bun run dev --backend-only     # Elysia only (port 3000)
bun run dev --frontend-port 8080  # Custom Vite port
```

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--port` | `-p` | number | 3000 | Backend server port |
| `--frontend-port` | | number | 5173 | Frontend server port |
| `--frontend-only` | `-f` | boolean | false | Run only Vite dev server |
| `--backend-only` | `-b` | boolean | false | Run only Elysia server |

## Build Commands

### build

Build application for production.

```bash
bun run build                  # Full build (frontend + backend)
bun run build --frontend-only  # Vite build only
bun run build --backend-only   # Server bundle only
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--frontend-only` | boolean | false | Build only frontend |
| `--backend-only` | boolean | false | Build only backend |
| `--production` | boolean | true | Enable minification |

**Output:**
- Frontend: `dist/client/`
- Backend: `dist/server/`
- Config: `dist/config/`

## Generator Commands

### generate

Generate code from templates.

```bash
bun run flux generate <type> <name> [options]
# Aliases: g, gen

bun run flux g controller user
bun run flux g component UserCard
bun run flux g service auth
bun run flux g route api/users
bun run flux g plugin my-plugin
```

| Type | Description | Output Location |
|------|-------------|-----------------|
| `controller` | Business logic handler | `app/server/controllers/` |
| `route` | API endpoint | `app/server/routes/` |
| `component` | React component | `app/client/src/components/` |
| `service` | Reusable service | `app/server/services/` |
| `plugin` | FluxStack plugin | `plugins/` |

| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--path` | `-p` | string | Custom output path |
| `--template` | `-t` | string | Template variant |
| `--force` | `-f` | boolean | Overwrite existing |
| `--dry-run` | | boolean | Preview without creating |

### interactive (wizard)

Interactive generator with prompts.

```bash
bun run flux interactive
# Walks through generation options step by step
```

## Plugin Management Commands

### plugin:add

Install and whitelist an NPM plugin securely.

```bash
bun run flux plugin:add <plugin-name> [options]

bun run flux plugin:add fluxstack-plugin-auth
bun run flux plugin:add @acme/fplugin-payments --skip-audit
```

| Option | Description |
|--------|-------------|
| `--skip-audit` | Skip npm security audit |
| `--skip-confirmation` | Skip confirmation prompt |

**Actions performed:**
1. Validates plugin name
2. Runs npm audit (unless skipped)
3. Installs plugin
4. Enables `PLUGINS_DISCOVER_NPM=true`
5. Adds to `PLUGINS_ALLOWED` whitelist

### plugin:remove

Remove plugin from whitelist and optionally uninstall.

```bash
bun run flux plugin:remove <plugin-name> [options]
# Alias: plugin:rm

bun run flux plugin:remove fluxstack-plugin-auth
bun run flux plugin:remove my-plugin --keep-installed
```

| Option | Description |
|--------|-------------|
| `--skip-confirmation` | Skip confirmation prompt |
| `--keep-installed` | Only remove from whitelist, keep package |

### plugin:list

List all plugins (installed, whitelisted, discovered).

```bash
bun run flux plugin:list [options]
# Alias: plugin:ls

bun run flux plugin:list
bun run flux plugin:list --installed
bun run flux plugin:list --whitelisted
bun run flux plugin:list --json
```

| Option | Description |
|--------|-------------|
| `--installed` | Show only installed NPM plugins |
| `--whitelisted` | Show only whitelisted plugins |
| `--json` | Output as JSON |

### plugin:deps

Manage plugin dependencies.

```bash
bun run flux plugin:deps <subcommand> [options]

bun run flux plugin:deps install           # Install all plugin deps
bun run flux plugin:deps install --dry-run # Preview installation
bun run flux plugin:deps list              # List plugin dependencies
bun run flux plugin:deps list --plugin crypto-auth  # Specific plugin
bun run flux plugin:deps check             # Check for conflicts
bun run flux plugin:deps clean             # Remove unused deps
```

| Subcommand | Description |
|------------|-------------|
| `install` | Install plugin dependencies |
| `list` | Show plugin dependencies |
| `check` | Detect dependency conflicts |
| `clean` | Remove unused dependencies |

## Project Commands

### create

Create new FluxStack project (used by create-fluxstack).

```bash
bunx create-fluxstack my-app
bunx create-fluxstack my-app --no-git
bunx create-fluxstack my-app --no-install
```

### make:plugin

Create a new plugin scaffold.

```bash
bun run flux make:plugin <name>

bun run flux make:plugin my-custom-plugin
```

**Creates:**
```
plugins/my-custom-plugin/
├── index.ts        # Plugin entry
├── config/         # Plugin config
└── README.md       # Documentation
```

## Help Command

### help

Display help for commands.

```bash
bun run flux help
bun run flux help <command>

bun run flux help dev
bun run flux help generate
```

## NPM Script Shortcuts

Standard npm scripts in `package.json`:

```bash
bun run dev           # flux dev
bun run build         # flux build
bun run start         # NODE_ENV=production bun dist/server/index.js
bun run test          # vitest
bun run lint          # eslint
bun run typecheck     # tsc --noEmit
```

## Environment Variables for CLI

| Variable | Effect |
|----------|--------|
| `LOG_LEVEL` | Set log verbosity (debug, info, warn, error) |
| `NODE_ENV` | development/production mode |
| `FLUXSTACK_MODE` | full-stack/backend-only/frontend-only |

## Related

- [Build System](../core/build-system.md)
- [Plugin System](../core/plugin-system.md)
- [Project Structure](../patterns/project-structure.md)
