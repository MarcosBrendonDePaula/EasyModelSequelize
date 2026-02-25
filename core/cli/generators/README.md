# FluxStack Code Generation System

The FluxStack code generation system provides powerful tools to quickly scaffold common code patterns, reducing boilerplate and ensuring consistency across your project.

## Quick Start

### Basic Usage

```bash
# Generate a CRUD controller
flux generate controller user

# Generate a React component
flux generate component UserCard

# Generate a service with repository pattern
flux generate service auth

# Generate API routes
flux generate route user
```

### Interactive Mode

For a guided experience with prompts:

```bash
flux generate:interactive
# or
flux gi
```

## Available Generators

### 1. Controller Generator

Generates backend controllers with CRUD operations.

**Templates:**
- `crud` (default) - Full CRUD controller with validation and error handling
- `minimal` - Basic controller structure with TODO placeholders

**Usage:**
```bash
flux generate controller user
flux generate controller product --template minimal
flux generate controller order --path custom/path
```

**Generated Files:**
- `app/server/controllers/{name}.controller.ts` - Main controller class
- `app/server/schemas/{name}.schema.ts` - Validation schemas (CRUD template only)

### 2. Service Generator

Generates business logic services with repository pattern.

**Templates:**
- `crud` (default) - Full service with validation, logging, and repository
- `repository` - Service with repository pattern
- `minimal` - Basic service structure

**Usage:**
```bash
flux generate service user
flux generate service auth --template repository
```

**Generated Files:**
- `app/server/services/{name}.service.ts` - Main service class
- `app/server/repositories/{name}.repository.ts` - Repository class (CRUD/repository templates)

### 3. Component Generator

Generates React components with TypeScript.

**Templates:**
- `basic` (default) - Simple React component with props interface
- `functional` - Component with hooks and state management
- `page` - Page component with layout and SEO
- `form` - Form component with validation
- `full` - Complete component with tests and Storybook stories

**Usage:**
```bash
flux generate component UserCard
flux generate component ContactForm --template form
flux generate component HomePage --template page
```

**Generated Files:**
- `app/client/src/components/{Name}/{Name}.tsx` - Main component
- `app/client/src/components/{Name}/{Name}.css` - Component styles
- `app/client/src/components/{Name}/index.ts` - Export file
- `app/client/src/components/{Name}/{Name}.test.tsx` - Tests (full template)
- `app/client/src/components/{Name}/{Name}.stories.tsx` - Storybook stories (full template)

### 4. Route Generator

Generates API routes with Elysia.js.

**Templates:**
- `crud` (default) - Full REST API with validation and documentation
- `auth` - Authentication routes (login, register, etc.)
- `minimal` - Basic route structure

**Usage:**
```bash
flux generate route user
flux generate route auth --template auth
```

**Generated Files:**
- `app/server/routes/{name}.routes.ts` - Route definitions
- `app/server/routes/index.ts` - Route registry (if doesn't exist)
- `app/server/middleware/{name}.middleware.ts` - Middleware (auth template)

## Command Options

### Global Options

- `--path, -p` - Custom path for generated files
- `--template, -t` - Template variant to use
- `--force, -f` - Overwrite existing files
- `--dry-run` - Preview what would be generated without creating files

### Examples

```bash
# Preview generation without creating files
flux generate controller user --dry-run

# Force overwrite existing files
flux generate component Button --force

# Use custom path
flux generate service auth --path app/custom/services

# Use specific template
flux generate component Modal --template functional
```

## Template Variables

All templates have access to these variables:

- `{{name}}` - Original name as provided
- `{{Name}}` - Capitalized name
- `{{NAME}}` - Uppercase name
- `{{kebabName}}` - kebab-case name (user-profile)
- `{{camelName}}` - camelCase name (userProfile)
- `{{pascalName}}` - PascalCase name (UserProfile)
- `{{snakeName}}` - snake_case name (user_profile)
- `{{timestamp}}` - ISO timestamp
- `{{date}}` - Current date
- `{{year}}` - Current year
- `{{author}}` - Author from config
- `{{projectName}}` - Project name from config

## Creating Custom Templates

### Template Structure

Templates are defined as objects with the following structure:

```typescript
interface Template {
  name: string
  description: string
  files: TemplateFile[]
  variables?: TemplateVariable[]
  hooks?: {
    beforeGenerate?: (context: GeneratorContext, options: GeneratorOptions) => Promise<void>
    afterGenerate?: (context: GeneratorContext, options: GeneratorOptions, files: string[]) => Promise<void>
  }
}
```

### Example Custom Generator

```typescript
import { Generator } from "./index"
import { GeneratorContext, GeneratorOptions, Template } from "./types"
import { templateEngine } from "./template-engine"

export class CustomGenerator implements Generator {
  name = 'custom'
  description = 'Generate custom code'

  async generate(context: GeneratorContext, options: GeneratorOptions): Promise<void> {
    const template = this.getTemplate()
    const files = await templateEngine.processTemplate(template, context, options)
    
    if (!options.dryRun) {
      await templateEngine.generateFiles(files)
    }
  }

  private getTemplate(): Template {
    return {
      name: 'custom-template',
      description: 'Custom template',
      files: [
        {
          path: 'custom/{{kebabName}}.ts',
          content: `// Generated {{pascalName}} at {{timestamp}}
export class {{pascalName}} {
  constructor() {
    console.log('{{pascalName}} created')
  }
}
`
        }
      ]
    }
  }
}
```

## Best Practices

### 1. Naming Conventions

- Use PascalCase for components: `UserCard`, `ContactForm`
- Use camelCase for services and controllers: `userService`, `authController`
- Use kebab-case for routes: `user-profile`, `auth-routes`

### 2. Template Selection

- Use `crud` templates for full-featured implementations
- Use `minimal` templates when you need basic structure
- Use `full` templates when you need tests and documentation

### 3. File Organization

- Keep related files together (controller + service + routes)
- Use consistent directory structure
- Follow the generated file patterns

### 4. Customization

- Always review generated code before committing
- Customize templates for your specific needs
- Add validation and error handling as needed

## Integration with Development Workflow

### 1. Generate Related Files

When generating a controller, also generate:
```bash
flux generate controller user
flux generate service user
flux generate route user
```

### 2. Update Imports

After generating routes, update your main server file:
```typescript
import { userRoutes } from './routes/user.routes'

app.use(userRoutes)
```

### 3. Add to Navigation

After generating components, add them to your routing:
```typescript
import { UserPage } from './components/UserPage'

// Add to your router
```

## Troubleshooting

### Common Issues

1. **Files already exist**
   - Use `--force` to overwrite
   - Use `--dry-run` to preview first

2. **Permission errors**
   - Check file permissions
   - Ensure directory is writable

3. **Template not found**
   - Check available templates with `flux generate --help`
   - Verify template name spelling

4. **Invalid names**
   - Names must start with a letter
   - Only letters, numbers, hyphens, and underscores allowed

### Getting Help

```bash
# General help
flux help

# Generator help
flux help generate

# Interactive mode
flux generate:interactive
```

## Advanced Usage

### Batch Generation

Generate multiple related files:
```bash
# Generate full stack for a feature
flux generate controller user
flux generate service user  
flux generate route user
flux generate component UserList
flux generate component UserForm
```

### Custom Paths

Organize files in custom directories:
```bash
flux generate controller admin/user --path app/admin/controllers
flux generate component admin/UserPanel --path app/admin/components
```

### Environment-Specific Templates

Use different templates for different environments:
```bash
# Development with full features
flux generate controller user --template crud

# Production with minimal features  
flux generate controller user --template minimal
```