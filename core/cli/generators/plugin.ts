import type { Generator } from "./index"
import type { GeneratorContext, GeneratorOptions, Template } from "./types"
import { templateEngine } from "./template-engine"
import { join } from "path"

export class PluginGenerator implements Generator {
    name = 'plugin'
    description = 'Generate a new FluxStack plugin'

    async generate(context: GeneratorContext, options: GeneratorOptions): Promise<void> {
        const template = this.getTemplate(options.template)

        if (template.hooks?.beforeGenerate) {
            await template.hooks.beforeGenerate(context, options)
        }

        const files = await templateEngine.processTemplate(template, context, options)

        if (options.dryRun) {
            console.log(`\n📋 Would generate plugin '${options.name}':\n`)
            for (const file of files) {
                console.log(`${file.action === 'create' ? '📄' : '✏️'} ${file.path}`)
            }
            return
        }

        await templateEngine.generateFiles(files, options.dryRun)

        if (template.hooks?.afterGenerate) {
            const filePaths = files.map(f => f.path)
            await template.hooks.afterGenerate(context, options, filePaths)
        }

        console.log(`\n✅ Generated plugin '${options.name}' with ${files.length} files`)
        console.log(`\n📦 Next steps:`)
        console.log(`   1. Configure plugin in plugins/${options.name}/config/index.ts`)
        console.log(`   2. Set environment variables (optional): ${options.name.toUpperCase().replace(/-/g, '_')}_*`)
        console.log(`   3. Implement your plugin logic in plugins/${options.name}/index.ts`)
        console.log(`   4. Add server-side code in plugins/${options.name}/server/ (optional)`)
        console.log(`   5. Add client-side code in plugins/${options.name}/client/ (optional)`)
        console.log(`   6. Run: bun run dev`)
    }

    private getTemplate(templateName?: string): Template {
        switch (templateName) {
            case 'full':
                return this.getFullTemplate()
            case 'server':
                return this.getServerOnlyTemplate()
            case 'client':
                return this.getClientOnlyTemplate()
            default:
                return this.getBasicTemplate()
        }
    }

    private getBasicTemplate(): Template {
        return {
            name: 'basic-plugin',
            description: 'Basic plugin template with essential files',
            files: [
                {
                    path: 'plugins/{{name}}/package.json',
                    content: `{
  "name": "@fluxstack/{{name}}-plugin",
  "version": "1.0.0",
  "description": "{{description}}",
  "main": "index.ts",
  "types": "index.ts",
  "exports": {
    ".": {
      "import": "./index.ts",
      "types": "./index.ts"
    },
    "./config": {
      "import": "./config/index.ts",
      "types": "./config/index.ts"
    }
  },
  "keywords": [
    "fluxstack",
    "plugin",
    "{{name}}",
    "typescript"
  ],
  "author": "FluxStack Developer",
  "license": "MIT",
  "peerDependencies": {},
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.0.0"
  },
  "fluxstack": {
    "plugin": true,
    "version": "^1.0.0",
    "hooks": [
      "setup",
      "onServerStart"
    ],
    "category": "utility",
    "tags": ["{{name}}"]
  }
}
`
                },
                {
                    path: 'plugins/{{name}}/config/index.ts',
                    content: `/**
 * {{pascalName}} Plugin Configuration
 * Declarative config using FluxStack config system
 */

import { defineConfig, config } from '@core/utils/config-schema'

const {{camelName}}ConfigSchema = {
  // Enable/disable plugin
  enabled: config.boolean('{{constantName}}_ENABLED', true),

  // Add your configuration options here
  // Example:
  // apiKey: config.string('{{constantName}}_API_KEY', ''),
  // timeout: config.number('{{constantName}}_TIMEOUT', 5000),
  // debug: config.boolean('{{constantName}}_DEBUG', false),
} as const

export const {{camelName}}Config = defineConfig({{camelName}}ConfigSchema)

export type {{pascalName}}Config = typeof {{camelName}}Config
export default {{camelName}}Config
`
                },
                {
                    path: 'plugins/{{name}}/index.ts',
                    content: `import type { ErrorContext, FluxStack, PluginContext, RequestContext, ResponseContext } from "@core/plugins/types"
// ✅ Plugin imports its own configuration
import { {{camelName}}Config } from './config'

/**
 * {{pascalName}} Plugin
 * {{description}}
 */
export class {{pascalName}}Plugin implements FluxStack.Plugin {
  name = '{{name}}'
  version = '1.0.0'

  /**
   * Setup hook - called when plugin is loaded
   */
  async setup(context: PluginContext): Promise<void> {
    // Check if plugin is enabled
    if (!{{camelName}}Config.enabled) {
      context.logger.info(\`[{{name}}] Plugin disabled by configuration\`)
      return
    }

    console.log(\`[{{name}}] Plugin initialized\`)

    // Add your initialization logic here
    // Example: Register middleware, setup database connections, etc.
  }

  /**
   * Server start hook - called when server starts
   */
  async onServerStart?(context: PluginContext): Promise<void> {
    if (!{{camelName}}Config.enabled) return

    console.log(\`[{{name}}] Server started\`)

    // Add logic to run when server starts
  }

  /**
   * Request hook - called on each request
   */
  async onRequest?(context: RequestContext): Promise<void> {
    if (!{{camelName}}Config.enabled) return

    // Add request processing logic
  }

  /**
   * Response hook - called on each response
   */
  async onResponse?(context: ResponseContext): Promise<void> {
    if (!{{camelName}}Config.enabled) return

    // Add response processing logic
  }

  /**
   * Error hook - called when errors occur
   */
  async onError?(context: ErrorContext): Promise<void> {
    console.error(\`[{{name}}] Error:\`, context.error)

    // Add error handling logic
  }
}

// Export plugin instance
export default new {{pascalName}}Plugin()
`
                },
                {
                    path: 'plugins/{{name}}/README.md',
                    content: `# {{pascalName}} Plugin

{{description}}

## Installation

This plugin is already in your FluxStack project. To use it:

1. Make sure the plugin is enabled in your configuration
2. Install any additional dependencies (if needed):
   \`\`\`bash
   bun run cli plugin:deps install
   \`\`\`

## Configuration

This plugin uses FluxStack's declarative configuration system. Configure it by editing \`config/index.ts\` or by setting environment variables:

\`\`\`bash
# Enable/disable plugin
{{constantName}}_ENABLED=true

# Add your environment variables here
# Example:
# {{constantName}}_API_KEY=your-api-key
# {{constantName}}_TIMEOUT=5000
\`\`\`

The plugin's configuration is located in \`plugins/{{name}}/config/index.ts\` and is self-contained, making the plugin fully portable.

## Usage

\`\`\`typescript
// The plugin is automatically loaded by FluxStack
// It imports its own configuration from ./config
\`\`\`

## API

Document your plugin's API here.

## Hooks

This plugin uses the following hooks:
- \`setup\`: Initialize plugin resources
- \`onServerStart\`: Run when server starts (optional)
- \`onRequest\`: Process incoming requests (optional)
- \`onResponse\`: Process outgoing responses (optional)
- \`onError\`: Handle errors (optional)

## Development

To modify this plugin:

1. Edit \`config/index.ts\` to add configuration options
2. Edit \`index.ts\` with your logic
3. Test with: \`bun run dev\`

## License

MIT
`
                }
            ]
        }
    }

    private getServerOnlyTemplate(): Template {
        const basic = this.getBasicTemplate()
        return {
            ...basic,
            name: 'server-plugin',
            description: 'Plugin with server-side code',
            files: [
                {
                    path: 'plugins/{{name}}/package.json',
                    content: `{
  "name": "@fluxstack/{{name}}-plugin",
  "version": "1.0.0",
  "description": "{{description}}",
  "main": "index.ts",
  "types": "index.ts",
  "exports": {
    ".": {
      "import": "./index.ts",
      "types": "./index.ts"
    },
    "./config": {
      "import": "./config/index.ts",
      "types": "./config/index.ts"
    },
    "./server": {
      "import": "./server/index.ts",
      "types": "./server/index.ts"
    }
  },
  "keywords": [
    "fluxstack",
    "plugin",
    "{{name}}",
    "server",
    "typescript"
  ],
  "author": "FluxStack Developer",
  "license": "MIT",
  "peerDependencies": {
    "elysia": "^1.0.0"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.0.0"
  },
  "fluxstack": {
    "plugin": true,
    "version": "^1.0.0",
    "hooks": [
      "setup",
      "onServerStart",
      "onRequest",
      "onResponse"
    ],
    "category": "utility",
    "tags": ["{{name}}", "server"]
  }
}
`
                },
                ...basic.files.slice(1), // Skip package.json from basic
                {
                    path: 'plugins/{{name}}/server/index.ts',
                    content: `/**
 * Server-side logic for {{pascalName}} plugin
 */

export class {{pascalName}}Service {
  async initialize() {
    console.log(\`[{{name}}] Server service initialized\`)
  }

  // Add your server-side methods here
}

export const {{camelName}}Service = new {{pascalName}}Service()
`
                }
            ]
        }
    }

    private getClientOnlyTemplate(): Template {
        const basic = this.getBasicTemplate()
        return {
            ...basic,
            name: 'client-plugin',
            description: 'Plugin with client-side code',
            files: [
                {
                    path: 'plugins/{{name}}/package.json',
                    content: `{
  "name": "@fluxstack/{{name}}-plugin",
  "version": "1.0.0",
  "description": "{{description}}",
  "main": "index.ts",
  "types": "index.ts",
  "exports": {
    ".": {
      "import": "./index.ts",
      "types": "./index.ts"
    },
    "./config": {
      "import": "./config/index.ts",
      "types": "./config/index.ts"
    },
    "./client": {
      "import": "./client/index.ts",
      "types": "./client/index.ts"
    }
  },
  "keywords": [
    "fluxstack",
    "plugin",
    "{{name}}",
    "react",
    "client",
    "typescript"
  ],
  "author": "FluxStack Developer",
  "license": "MIT",
  "peerDependencies": {
    "react": ">=16.8.0"
  },
  "peerDependenciesMeta": {
    "react": {
      "optional": true
    }
  },
  "dependencies": {},
  "devDependencies": {
    "@types/react": "^18.0.0",
    "typescript": "^5.0.0"
  },
  "fluxstack": {
    "plugin": true,
    "version": "^1.0.0",
    "hooks": [
      "setup",
      "onServerStart"
    ],
    "category": "utility",
    "tags": ["{{name}}", "client", "react"]
  }
}
`
                },
                ...basic.files.slice(1), // Skip package.json from basic
                {
                    path: 'plugins/{{name}}/client/index.ts',
                    content: `/**
 * Client-side logic for {{pascalName}} plugin
 */

export class {{pascalName}}Client {
  initialize() {
    console.log(\`[{{name}}] Client initialized\`)
  }

  // Add your client-side methods here
}

export const {{camelName}}Client = new {{pascalName}}Client()
`
                }
            ]
        }
    }

    private getFullTemplate(): Template {
        const basic = this.getBasicTemplate()
        const server = this.getServerOnlyTemplate()
        const client = this.getClientOnlyTemplate()

        return {
            ...basic,
            name: 'full-plugin',
            description: 'Complete plugin with server and client code',
            files: [
                {
                    path: 'plugins/{{name}}/package.json',
                    content: `{
  "name": "@fluxstack/{{name}}-plugin",
  "version": "1.0.0",
  "description": "{{description}}",
  "main": "index.ts",
  "types": "index.ts",
  "exports": {
    ".": {
      "import": "./index.ts",
      "types": "./index.ts"
    },
    "./config": {
      "import": "./config/index.ts",
      "types": "./config/index.ts"
    },
    "./server": {
      "import": "./server/index.ts",
      "types": "./server/index.ts"
    },
    "./client": {
      "import": "./client/index.ts",
      "types": "./client/index.ts"
    },
    "./types": {
      "import": "./types.ts",
      "types": "./types.ts"
    }
  },
  "keywords": [
    "fluxstack",
    "plugin",
    "{{name}}",
    "react",
    "server",
    "client",
    "typescript"
  ],
  "author": "FluxStack Developer",
  "license": "MIT",
  "peerDependencies": {
    "react": ">=16.8.0",
    "elysia": "^1.0.0"
  },
  "peerDependenciesMeta": {
    "react": {
      "optional": true
    }
  },
  "dependencies": {},
  "devDependencies": {
    "@types/react": "^18.0.0",
    "typescript": "^5.0.0"
  },
  "fluxstack": {
    "plugin": true,
    "version": "^1.0.0",
    "hooks": [
      "setup",
      "onServerStart",
      "onRequest",
      "onResponse",
      "onError"
    ],
    "category": "utility",
    "tags": ["{{name}}", "server", "client", "react"]
  }
}
`
                },
                ...basic.files.slice(1), // Skip package.json from basic
                {
                    path: 'plugins/{{name}}/server/index.ts',
                    content: `/**
 * Server-side logic for {{pascalName}} plugin
 */

export class {{pascalName}}Service {
  async initialize() {
    console.log(\`[{{name}}] Server service initialized\`)
  }

  // Add your server-side methods here
}

export const {{camelName}}Service = new {{pascalName}}Service()
`
                },
                {
                    path: 'plugins/{{name}}/client/index.ts',
                    content: `/**
 * Client-side logic for {{pascalName}} plugin
 */

export class {{pascalName}}Client {
  initialize() {
    console.log(\`[{{name}}] Client initialized\`)
  }

  // Add your client-side methods here
}

export const {{camelName}}Client = new {{pascalName}}Client()
`
                },
                {
                    path: 'plugins/{{name}}/types.ts',
                    content: `/**
 * Type definitions for {{pascalName}} plugin
 */

// Config types are exported from ./config/index.ts
// Import them like: import type { {{pascalName}}Config } from './config'

export interface {{pascalName}}Options {
  // Add your runtime options types here
}

export interface {{pascalName}}Event {
  // Add your event types here
}
`
                }
            ]
        }
    }
}
