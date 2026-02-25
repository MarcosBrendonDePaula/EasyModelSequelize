import type { FluxStackConfig } from "@config"
import type { Logger } from "@core/utils/logger/index"
import type { PluginUtils } from "../../plugins/types"

export interface GeneratorContext {
  workingDir: string
  config: FluxStackConfig
  logger: Logger
  utils: PluginUtils
}

export interface GeneratorOptions {
  name: string
  path?: string
  template?: string
  force?: boolean
  dryRun?: boolean
  [key: string]: any
}

export interface TemplateVariable {
  name: string
  description: string
  type: 'string' | 'boolean' | 'choice'
  required?: boolean
  default?: any
  choices?: string[]
  prompt?: string
}

export interface Template {
  name: string
  description: string
  files: TemplateFile[]
  variables?: TemplateVariable[]
  hooks?: {
    beforeGenerate?: (context: GeneratorContext, options: GeneratorOptions) => Promise<void>
    afterGenerate?: (context: GeneratorContext, options: GeneratorOptions, files: string[]) => Promise<void>
  }
}

export interface TemplateFile {
  path: string
  content: string
  condition?: (variables: Record<string, any>) => boolean
}

export interface GeneratedFile {
  path: string
  content: string
  exists: boolean
  action: 'create' | 'overwrite' | 'skip'
}

export interface GenerationResult {
  success: boolean
  files: GeneratedFile[]
  errors?: string[]
  warnings?: string[]
}

// Utility types for template processing
export type TemplateProcessor = (template: string, variables: Record<string, any>) => string

export interface PromptConfig {
  type: 'input' | 'confirm' | 'select' | 'multiselect'
  message: string
  default?: any
  choices?: Array<{ name: string; value: any; description?: string }>
  validate?: (value: any) => boolean | string
}