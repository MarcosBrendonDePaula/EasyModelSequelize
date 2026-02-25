import { existsSync } from "fs"
import { join } from "path"

export class GeneratorUtils {
  static validateName(name: string): { valid: boolean; error?: string } {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'Name is required' }
    }
    
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      return { valid: false, error: 'Name cannot be empty' }
    }
    
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(trimmed)) {
      return { valid: false, error: 'Name must start with a letter and contain only letters, numbers, hyphens, and underscores' }
    }
    
    if (trimmed.length > 100) {
      return { valid: false, error: 'Name must be less than 100 characters' }
    }
    
    return { valid: true }
  }

  static validatePath(path: string): { valid: boolean; error?: string } {
    if (!path || typeof path !== 'string') {
      return { valid: true } // Path is optional
    }
    
    const trimmed = path.trim()
    if (trimmed.length === 0) {
      return { valid: true }
    }
    
    // Check for invalid characters
    if (/[<>:"|?*]/.test(trimmed)) {
      return { valid: false, error: 'Path contains invalid characters' }
    }
    
    // Check for absolute paths (should be relative)
    if (trimmed.startsWith('/') || /^[a-zA-Z]:/.test(trimmed)) {
      return { valid: false, error: 'Path should be relative to project root' }
    }
    
    return { valid: true }
  }

  static checkFileExists(workingDir: string, filePath: string): boolean {
    const fullPath = join(workingDir, filePath)
    return existsSync(fullPath)
  }

  static getDefaultPath(type: string, name: string): string {
    const kebabName = this.toKebabCase(name)
    const pascalName = this.toPascalCase(name)
    
    switch (type) {
      case 'controller':
        return `app/server/controllers/${kebabName}.controller.ts`
      case 'service':
        return `app/server/services/${kebabName}.service.ts`
      case 'route':
        return `app/server/routes/${kebabName}.routes.ts`
      case 'component':
        return `app/client/src/components/${pascalName}/${pascalName}.tsx`
      default:
        return `${kebabName}.ts`
    }
  }

  static getRelatedFiles(type: string, name: string): string[] {
    const kebabName = this.toKebabCase(name)
    const pascalName = this.toPascalCase(name)
    
    switch (type) {
      case 'controller':
        return [
          `app/server/services/${kebabName}.service.ts`,
          `app/server/schemas/${kebabName}.schema.ts`,
          `app/server/routes/${kebabName}.routes.ts`
        ]
      case 'service':
        return [
          `app/server/repositories/${kebabName}.repository.ts`,
          `app/server/controllers/${kebabName}.controller.ts`
        ]
      case 'component':
        return [
          `app/client/src/components/${pascalName}/${pascalName}.css`,
          `app/client/src/components/${pascalName}/index.ts`,
          `app/client/src/components/${pascalName}/${pascalName}.test.tsx`,
          `app/client/src/components/${pascalName}/${pascalName}.stories.tsx`
        ]
      case 'route':
        return [
          `app/server/controllers/${kebabName}.controller.ts`,
          `app/server/middleware/${kebabName}.middleware.ts`
        ]
      default:
        return []
    }
  }

  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  static getTemplateVariables(name: string, additionalVars: Record<string, any> = {}): Record<string, any> {
    return {
      name,
      Name: this.capitalize(name),
      NAME: name.toUpperCase(),
      kebabName: this.toKebabCase(name),
      camelName: this.toCamelCase(name),
      pascalName: this.toPascalCase(name),
      snakeName: this.toSnakeCase(name),
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      day: new Date().getDate(),
      ...additionalVars
    }
  }

  // String transformation utilities
  static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  static toCamelCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '')
      .replace(/^[A-Z]/, char => char.toLowerCase())
  }

  static toPascalCase(str: string): string {
    return this.capitalize(this.toCamelCase(str))
  }

  static toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase()
  }

  static toSnakeCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase()
  }

  static pluralize(str: string): string {
    // Simple pluralization - in a real implementation you'd use a proper library
    if (str.endsWith('y')) {
      return str.slice(0, -1) + 'ies'
    }
    if (str.endsWith('s') || str.endsWith('sh') || str.endsWith('ch') || str.endsWith('x') || str.endsWith('z')) {
      return str + 'es'
    }
    return str + 's'
  }

  static singularize(str: string): string {
    // Simple singularization - in a real implementation you'd use a proper library
    if (str.endsWith('ies')) {
      return str.slice(0, -3) + 'y'
    }
    if (str.endsWith('es')) {
      return str.slice(0, -2)
    }
    if (str.endsWith('s') && !str.endsWith('ss')) {
      return str.slice(0, -1)
    }
    return str
  }
}

export const generatorUtils = GeneratorUtils