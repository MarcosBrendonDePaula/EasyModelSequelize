import { readFileSync, writeFileSync, statSync, readdirSync } from "fs"
import { join, extname } from "path"
import { gzipSync } from "zlib"
import type { OptimizationConfig, OptimizationResult } from "../types/build"
import { buildLogger } from "../utils/build-logger"

export interface OptimizerConfig {
  treeshake: boolean
  compress: boolean
  removeUnusedCSS: boolean
  optimizeImages: boolean
  bundleAnalysis: boolean
}

export class Optimizer {
  private config: OptimizerConfig

  constructor(config: OptimizerConfig) {
    this.config = config
  }

  async optimize(buildPath: string): Promise<OptimizationResult> {
    buildLogger.section('Build Optimization', '🔧')

    const startTime = Date.now()
    const results: OptimizationResult = {
      success: true,
      duration: 0,
      originalSize: 0,
      optimizedSize: 0,
      compressionRatio: 0,
      optimizations: []
    }

    try {
      // Get original size
      results.originalSize = await this.calculateDirectorySize(buildPath)
      buildLogger.step(`Original size: ${buildLogger.formatSize(results.originalSize)}`)

      // Apply optimizations (minification removed for compatibility)

      if (this.config.compress) {
        await this.compressAssets(buildPath, results)
      }

      if (this.config.removeUnusedCSS) {
        await this.removeUnusedCSS(buildPath, results)
      }

      if (this.config.optimizeImages) {
        await this.optimizeImages(buildPath, results)
      }

      if (this.config.bundleAnalysis) {
        await this.analyzeBundles(buildPath, results)
      }

      // Calculate final size and compression ratio
      results.optimizedSize = await this.calculateDirectorySize(buildPath)
      results.compressionRatio = results.originalSize > 0
        ? ((results.originalSize - results.optimizedSize) / results.originalSize) * 100
        : 0

      results.duration = Date.now() - startTime

      buildLogger.success(`Optimization completed in ${buildLogger.formatDuration(results.duration)}`)

      // Create optimization summary table
      const optimizationData = results.optimizations.map(opt => ({
        type: opt.type,
        description: opt.description,
        saved: buildLogger.formatSize(opt.sizeSaved)
      }))

      if (optimizationData.length > 0) {
        buildLogger.table(
          [
            { header: 'Optimization', key: 'type', width: 20, align: 'left', color: 'cyan' },
            { header: 'Description', key: 'description', width: 35, align: 'left' },
            { header: 'Size Saved', key: 'saved', width: 12, align: 'right', color: 'green' }
          ],
          optimizationData
        )
      }

      return results

    } catch (error) {
      results.success = false
      results.duration = Date.now() - startTime
      results.error = error instanceof Error ? error.message : "Unknown optimization error"

      buildLogger.error(`Optimization failed: ${results.error}`)
      return results
    }
  }

  // Minification methods removed for compatibility with Bun bundler

  private async compressAssets(buildPath: string, results: OptimizationResult): Promise<void> {
    buildLogger.step("Compressing assets...")

    const files = this.getFilesRecursively(buildPath)
    let compressedCount = 0

    for (const file of files) {
      const ext = extname(file).toLowerCase()
      
      if (['.js', '.css', '.html', '.json', '.svg'].includes(ext)) {
        try {
          const content = readFileSync(file)
          const compressed = gzipSync(content)
          
          // Only create .gz file if it's significantly smaller
          if (compressed.length < content.length * 0.9) {
            writeFileSync(file + '.gz', compressed)
            compressedCount++
          }
        } catch (error) {
          // Silently skip files that can't be compressed
        }
      }
    }

    buildLogger.success(`Compressed ${compressedCount} files`)
    results.optimizations.push({
      type: 'compression',
      description: `Created gzip versions for ${compressedCount} files`,
      sizeSaved: 0
    })
  }

  private async removeUnusedCSS(buildPath: string, results: OptimizationResult): Promise<void> {
    buildLogger.step("Analyzing CSS...")

    // This is a placeholder - real implementation would use PurgeCSS or similar
    results.optimizations.push({
      type: 'css-purging',
      description: 'CSS purging not implemented yet',
      sizeSaved: 0
    })
  }

  private async optimizeImages(buildPath: string, results: OptimizationResult): Promise<void> {
    buildLogger.step("Optimizing images...")

    // This is a placeholder - real implementation would use imagemin or similar
    results.optimizations.push({
      type: 'image-optimization',
      description: 'Image optimization not implemented yet',
      sizeSaved: 0
    })
  }

  private async analyzeBundles(buildPath: string, results: OptimizationResult): Promise<void> {
    buildLogger.step("Analyzing bundles...")
    
    const files = this.getFilesRecursively(buildPath)
    const jsFiles = files.filter(f => extname(f) === '.js')
    
    let totalJSSize = 0
    for (const file of jsFiles) {
      totalJSSize += statSync(file).size
    }

    results.optimizations.push({
      type: 'bundle-analysis',
      description: `Analyzed ${jsFiles.length} JS bundles (${(totalJSSize / 1024).toFixed(2)} KB total)`,
      sizeSaved: 0
    })
  }

  private async calculateDirectorySize(dirPath: string): Promise<number> {
    const files = this.getFilesRecursively(dirPath)
    let totalSize = 0
    
    for (const file of files) {
      try {
        totalSize += statSync(file).size
      } catch (error) {
        // Ignore files that can't be read
      }
    }
    
    return totalSize
  }

  private getFilesRecursively(dir: string): string[] {
    const files: string[] = []
    
    try {
      const items = readdirSync(dir, { withFileTypes: true })
      
      for (const item of items) {
        const fullPath = join(dir, item.name)
        
        if (item.isDirectory()) {
          files.push(...this.getFilesRecursively(fullPath))
        } else {
          files.push(fullPath)
        }
      }
    } catch (error) {
      // Ignore directories that can't be read
    }
    
    return files
  }

  async createOptimizationReport(result: OptimizationResult): Promise<string> {
    const report = `
# Build Optimization Report

## Summary
- **Status**: ${result.success ? '✅ Success' : '❌ Failed'}
- **Duration**: ${result.duration}ms
- **Original Size**: ${(result.originalSize / 1024).toFixed(2)} KB
- **Optimized Size**: ${(result.optimizedSize / 1024).toFixed(2)} KB
- **Size Reduction**: ${result.compressionRatio.toFixed(2)}%

## Optimizations Applied

${result.optimizations.map(opt => 
  `### ${opt.type.charAt(0).toUpperCase() + opt.type.slice(1)}
- ${opt.description}
- Size Saved: ${(opt.sizeSaved / 1024).toFixed(2)} KB`
).join('\n\n')}

${result.error ? `## Error\n${result.error}` : ''}

Generated at: ${new Date().toISOString()}
`

    return report.trim()
  }
}