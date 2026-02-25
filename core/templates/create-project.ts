import { spawn } from "bun"
import { join, resolve } from "path"
import { mkdir } from "fs/promises"

export interface CreateProjectOptions {
  name: string
  targetDir?: string
  template?: 'basic' | 'full'
}

export class ProjectCreator {
  private projectName: string
  private targetDir: string

  constructor(options: CreateProjectOptions) {
    this.projectName = options.name
    this.targetDir = options.targetDir || resolve(process.cwd(), options.name)
    // Template option available but basic template is used for now
    // const template = options.template || 'basic'
  }

  async create() {
    console.log(`🎉 Creating FluxStack project: ${this.projectName}`)
    console.log(`📁 Target directory: ${this.targetDir}`)
    console.log()

    try {
      // 1. Create project directory
      await this.createDirectory()
      
      // 2. Copy template files
      await this.copyTemplate()
      
      // 3. Generate package.json
      await this.generatePackageJson()
      
      // 4. Generate config files (including .gitignore)
      await this.generateConfigFiles()
      
      // 5. Initialize git (before installing dependencies)
      await this.initGit()
      
      // 6. Install dependencies (last step)
      await this.installDependencies()
      
      console.log()
      console.log("🎉 Project created successfully!")
      console.log()
      console.log("Next steps:")
      console.log(`  cd ${this.projectName}`)
      console.log(`  bun run dev`)
      console.log()
      console.log("Happy coding! 🚀")
      
    } catch (error) {
      console.error("❌ Error creating project:", error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  private async createDirectory() {
    console.log("📁 Creating project directory...")
    await mkdir(this.targetDir, { recursive: true })
  }

  private async copyTemplate() {
    console.log("📋 Copying template files...")
    
    // Copy files using Bun's built-in functions for better performance
    const rootDir = join(__dirname, '..', '..')
    
    // Copy app structure (exclude node_modules and dist)
    await this.copyDirectory(
      join(rootDir, 'app'),
      join(this.targetDir, 'app'),
      ['node_modules', 'dist', '.vite']
    )
    
    // Copy core framework (exclude node_modules)
    await this.copyDirectory(
      join(rootDir, 'core'),
      join(this.targetDir, 'core'),
      ['node_modules']
    )
    
    // Copy config
    await this.copyDirectory(
      join(rootDir, 'config'),
      join(this.targetDir, 'config')
    )

    // Copy plugins
    await this.copyDirectory(
      join(rootDir, 'plugins'),
      join(this.targetDir, 'plugins')
    )

  }

  private async copyDirectory(src: string, dest: string, exclude: string[] = []) {
    await mkdir(dest, { recursive: true })
    
    const fs = await import("fs/promises")
    let entries: any[] = []
    
    try {
      entries = await fs.readdir(src, { withFileTypes: true })
    } catch (error) {
      console.warn(`Warning: Could not read directory ${src}`)
      return
    }
    
    for (const entry of entries) {
      if (exclude.includes(entry.name)) continue
      
      const srcPath = join(src, entry.name)
      const destPath = join(dest, entry.name)
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath, exclude)
      } else {
        const content = await Bun.file(srcPath).text()
        await Bun.write(destPath, content)
      }
    }
  }

  private async generatePackageJson() {
    console.log("📦 Generating package.json...")
    
    const packageJson = {
      name: this.projectName,
      version: "1.0.0",
      description: `FluxStack project: ${this.projectName}`,
      keywords: ["fluxstack", "full-stack", "typescript", "elysia", "react", "bun"],
      author: "FluxStack Developer",
      license: "MIT",
      module: "app/server/index.ts",
      type: "module",
      bin: {
        flux: "./core/cli/index.ts"
      },
      scripts: {
        dev: "bun run core/cli/index.ts dev",
        "dev:frontend": "bun run core/cli/index.ts frontend", 
        "dev:backend": "bun run core/cli/index.ts backend",
        "sync-version": "bun run core/utils/sync-version.ts",
        build: "bun run core/cli/index.ts build",
        "build:frontend": "bun run core/cli/index.ts build:frontend",
        "build:backend": "bun run core/cli/index.ts build:backend",
        start: "bun run core/cli/index.ts start",
        test: "vitest",
        "test:ui": "vitest --ui",
        "test:run": "vitest run",
        "test:coverage": "vitest run --coverage",
        "test:watch": "vitest --watch"
      },
      devDependencies: {
        "@types/bun": "latest",
        "@types/react": "^18.2.0",
        "@types/react-dom": "^18.2.0",
        "@types/uuid": "^10.0.0",
        "@testing-library/react": "^14.0.0",
        "@testing-library/jest-dom": "^6.1.0",
        "@testing-library/user-event": "^14.5.0",
        "@vitest/ui": "^1.0.0",
        "@vitest/coverage-v8": "^1.0.0",
        "jsdom": "^23.0.0",
        typescript: "^5.0.0",
        vitest: "^1.0.0"
      },
      dependencies: {
        "@elysiajs/eden": "^1.3.2",
        "@sinclair/typebox": "^0.34.41",
        "@vitejs/plugin-react": "^4.0.0",
        "chalk": "^5.3.0",
        "elysia": "latest",
        "react": "^18.2.0",
        "react-dom": "^18.2.0",
        "react-icons": "^5.5.0",
        "uuid": "^13.0.0",
        "vite": "^5.0.0",
        "zustand": "^5.0.8"
      }
    }

    await Bun.write(
      join(this.targetDir, "package.json"),
      JSON.stringify(packageJson, null, 2)
    )
  }

  private async generateConfigFiles() {
    console.log("⚙️ Generating config files...")

    // TypeScript config
    const tsConfig = {
      compilerOptions: {
        lib: ["ESNext", "DOM"],
        target: "ESNext",
        module: "ESNext",
        moduleDetection: "force",
        jsx: "react-jsx",
        allowJs: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        verbatimModuleSyntax: true,
        noEmit: true,
        baseUrl: ".",
        paths: {
          "@/*": ["./*"],
          "@core/*": ["./core/*"],
          "@app/*": ["./app/*"],
          "@config/*": ["./config/*"],
          "@shared/*": ["./app/shared/*"]
        },
        strict: true,
        skipLibCheck: true,
        noFallthroughCasesInSwitch: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
        noPropertyAccessFromIndexSignature: false
      }
    }

    await Bun.write(
      join(this.targetDir, "tsconfig.json"),
      JSON.stringify(tsConfig, null, 2)
    )

    // Bun config
    const bunConfig = `# FluxStack Bun Configuration
[build]
target = "bun"

[install]
cache = true
lockfile = true

# Path mapping (alias support)
[build.alias]
"@" = "."
"@core" = "./core"
"@app" = "./app"
"@config" = "./config"
"@shared" = "./app/shared"
`

    await Bun.write(join(this.targetDir, "bunfig.toml"), bunConfig)

    // Vite config
    const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@core': resolve(__dirname, './core'),
      '@app': resolve(__dirname, './app'),
      '@config': resolve(__dirname, './config'),
      '@shared': resolve(__dirname, './app/shared')
    }
  },
  server: {
    port: 5173,
    host: 'localhost',
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    sourcemap: true
  }
})
`

    await Bun.write(join(this.targetDir, "vite.config.ts"), viteConfig)

    // Get FluxStack version dynamically
    const { FLUXSTACK_VERSION } = await import("../utils/version")
    
    // Environment file
    const envContent = `# FluxStack Environment Variables

# Development Mode
NODE_ENV=development

# Server Configuration
PORT=3000
HOST=localhost

# Frontend Configuration
FRONTEND_PORT=5173
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=FluxStack
VITE_APP_VERSION=${FLUXSTACK_VERSION}
VITE_NODE_ENV=development

# FluxStack Framework Version
FLUXSTACK_APP_VERSION=${FLUXSTACK_VERSION}

# Backend Configuration
BACKEND_PORT=3001
API_URL=http://localhost:3001

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
CORS_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_HEADERS=Content-Type,Authorization

# Logging
LOG_LEVEL=info

# Build Configuration
BUILD_TARGET=bun
BUILD_OUTDIR=dist

# Database (optional - uncomment to use)
# DATABASE_URL=postgresql://user:password@localhost:5432/${this.projectName}
# DATABASE_HOST=localhost
# DATABASE_PORT=5432
# DATABASE_NAME=${this.projectName}
# DATABASE_USER=user
# DATABASE_PASSWORD=password

# Authentication (optional - uncomment to use)
# JWT_SECRET=your-super-secret-jwt-key-here
# JWT_EXPIRES_IN=24h

# External APIs (optional - uncomment to use)
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_PUBLISHABLE_KEY=pk_test_...

# Email Service (optional - uncomment to use)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password

# File Upload (optional - uncomment to use)
# UPLOAD_PATH=uploads
# MAX_FILE_SIZE=10485760
`

    await Bun.write(join(this.targetDir, ".env"), envContent)

    // .gitignore
    const gitignoreContent = `# Dependencies
node_modules/
.pnp
.pnp.js

# Production builds
/dist
/build
/.next/
/out/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*
.pnpm-debug.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# nyc test coverage
.nyc_output

# Dependency directories
jspm_packages/

# TypeScript cache
*.tsbuildinfo

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Optional stylelint cache
.stylelintcache

# Microbundle cache
.rpt2_cache/
.rts2_cache_cjs/
.rts2_cache_es/
.rts2_cache_umd/

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# Next.js build output
.next

# Nuxt.js build / generate output
.nuxt
dist

# Storybook build outputs
.out
.storybook-out

# Temporary folders
tmp/
temp/

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# FluxStack specific
uploads/
public/uploads/
.fluxstack/

# Bun
bun.lockb
`

    await Bun.write(join(this.targetDir, ".gitignore"), gitignoreContent)

    // README
    const readme = `# ${this.projectName}

Modern full-stack TypeScript application built with FluxStack framework.

## Tech Stack

- **Backend**: Elysia.js (high-performance web framework)
- **Frontend**: React + Vite (modern development experience)
- **Runtime**: Bun (ultra-fast JavaScript runtime)
- **Type Safety**: Eden Treaty (end-to-end type safety)

## Getting Started

### Install Dependencies
\`\`\`bash
bun install
\`\`\`

### Development

#### Full-Stack (Recommended)
\`\`\`bash
bun run dev
# Frontend + Backend integrated at http://localhost:3000
\`\`\`

#### Separate Development
\`\`\`bash
# Terminal 1: Backend API
bun run dev:backend
# API at http://localhost:3001

# Terminal 2: Frontend 
bun run dev:frontend  
# Frontend at http://localhost:5173
\`\`\`

### Production

\`\`\`bash
# Build everything
bun run build

# Start production server
bun run start
\`\`\`

## Project Structure

\`\`\`
${this.projectName}/
├── app/                    # Your application code
│   ├── server/            # Backend (controllers, routes)
│   ├── client/            # Frontend (React components)
│   └── shared/            # Shared types
├── core/                   # FluxStack framework (don't edit)
├── config/                 # Configuration files
└── dist/                  # Production build
\`\`\`

## Available Commands

- \`bun run dev\` - Full-stack development
- \`bun run dev:frontend\` - Frontend only
- \`bun run dev:backend\` - Backend only
- \`bun run build\` - Build for production
- \`bun run start\` - Start production server

## Health Check

\`\`\`bash
curl http://localhost:3000/api/health
\`\`\`

Built with ❤️ using FluxStack framework.
`

    await Bun.write(join(this.targetDir, "README.md"), readme)
  }

  private async installDependencies() {
    console.log("📦 Installing dependencies...")
    
    const installProcess = spawn({
      cmd: ["bun", "install"],
      cwd: this.targetDir,
      stdout: "pipe",
      stderr: "pipe"
    })

    const exitCode = await installProcess.exited
    
    if (exitCode !== 0) {
      throw new Error("Failed to install dependencies")
    }
  }

  private async initGit() {
    console.log("🔧 Initializing git repository...")
    
    try {
      // Initialize git repository
      await spawn({
        cmd: ["git", "init", "--quiet"],
        cwd: this.targetDir,
        stdout: "ignore",
        stderr: "ignore"
      }).exited

      // Add all files
      await spawn({
        cmd: ["git", "add", "."],
        cwd: this.targetDir,
        stdout: "ignore",
        stderr: "ignore"
      }).exited

      // Initial commit
      await spawn({
        cmd: ["git", "commit", "-m", "Initial commit - FluxStack project created", "--quiet"],
        cwd: this.targetDir,
        stdout: "ignore",
        stderr: "ignore"
      }).exited
    } catch (error) {
      console.warn("⚠️ Git initialization failed (git may not be installed)")
    }
  }
}