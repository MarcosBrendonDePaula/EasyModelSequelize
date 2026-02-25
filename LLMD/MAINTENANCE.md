# Documentation Maintenance Guide

**Version:** 1.11.0 | **Updated:** 2025-02-08

## Quick Facts

- Documentation lives in `/LLMD/`
- Each document tracks version and update date
- Target: <2000 tokens per document
- All internal links must be validated

## Document Format

Every document follows this template:

```markdown
# Document Title

**Version:** X.Y.Z | **Updated:** YYYY-MM-DD

## Quick Facts

- Key point 1
- Key point 2

## [Main Sections]

Content...

## Related

- [Link 1](./path.md)
- [Link 2](./path.md)
```

## When to Update Documentation

### Code Changes That Require Doc Updates

| Change Type | Update Required |
|-------------|-----------------|
| New CLI command | `reference/cli-commands.md` |
| New plugin hook | `reference/plugin-hooks.md`, `core/plugin-system.md` |
| New config option | `config/environment-vars.md`, `config/declarative-system.md` |
| Changed API pattern | `resources/routes-eden.md`, `patterns/type-safety.md` |
| New framework feature | Relevant `core/*.md` file |
| Build system change | `core/build-system.md` |
| Breaking change | `patterns/anti-patterns.md`, `reference/troubleshooting.md` |

### Version Bump Checklist

When FluxStack version changes:

1. Update `**Version:**` header in all `.md` files
2. Update `MIGRATION.md` if needed
3. Add new entries to `reference/troubleshooting.md` for version-specific issues
4. Update `INDEX.md` if new documents added

## Adding New Documentation

### New Document Checklist

1. **Create file** in appropriate directory:
   - `core/` - Framework internals
   - `config/` - Configuration system
   - `resources/` - Creating things (routes, controllers, plugins)
   - `patterns/` - Best practices and rules
   - `reference/` - Quick lookup (CLI, hooks, troubleshooting)

2. **Add header** with version and date

3. **Add to INDEX.md** in the right section

4. **Add Related links** at bottom of new document

5. **Cross-link** from related existing documents

### Token Efficiency Guidelines

- No prose introductions ("In this document we will...")
- Use tables for reference data
- Use code blocks, not explanations of code
- Bullet points over paragraphs
- No repeated information (link instead)

## Link Validation

### Manual Check

```bash
# Find all internal links
grep -r "\]\(./" LLMD/ | grep "\.md"

# Verify each path exists
```

### Required Links to Check

Each document should have working links in:
- `## Related` section at bottom
- Any inline references

## Directory Structure

```
LLMD/
├── INDEX.md              # Navigation hub (update for new docs)
├── MIGRATION.md          # Changes from ai-context/
├── MAINTENANCE.md        # This file
├── core/
│   ├── framework-lifecycle.md
│   ├── plugin-system.md
│   └── build-system.md
├── config/
│   ├── declarative-system.md
│   ├── environment-vars.md
│   └── runtime-reload.md
├── resources/
│   ├── routes-eden.md
│   ├── controllers.md
│   ├── live-components.md
│   └── plugins-external.md
├── patterns/
│   ├── project-structure.md
│   ├── type-safety.md
│   └── anti-patterns.md
└── reference/
    ├── cli-commands.md
    ├── plugin-hooks.md
    └── troubleshooting.md
```

## Code Example Standards

### TypeScript Examples

```typescript
// ✅ Include imports when non-obvious
import { Elysia, t } from 'elysia'

// ✅ Show complete, runnable snippets
export const route = new Elysia()
  .get('/', () => ({ status: 'ok' }))
```

### Bash Examples

```bash
# ✅ Include expected output when helpful
bun run dev
# ⚡ Starting Full-stack development server...
# Backend: http://localhost:3000
# Frontend: http://localhost:5173
```

### Avoid

```typescript
// ❌ Incomplete snippets
.get('/', () => ...)

// ❌ Unexplained magic
const x = doSomething() // What is doSomething?
```

## Sync with Code Changes

### Before PR

1. Check if code changes affect documentation
2. Update relevant documents
3. Update version dates
4. Validate links

### After Major Feature

1. Create new document if needed
2. Update INDEX.md
3. Add to MIGRATION.md for notable changes
4. Cross-reference from related docs

## Quality Checklist

Before committing documentation changes:

- [ ] Version and date updated
- [ ] All code examples syntactically valid
- [ ] All internal links work
- [ ] No duplicate information (link instead)
- [ ] Added to INDEX.md if new document
- [ ] Related section has relevant links
- [ ] Token count reasonable (<2000 target)

## Related

- [INDEX.md](./INDEX.md) - Main navigation
- [MIGRATION.md](./MIGRATION.md) - Version changes
