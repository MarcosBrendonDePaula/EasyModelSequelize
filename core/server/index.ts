// FluxStack framework exports
export { FluxStackFramework } from "../framework/server"
export { vitePlugin, staticPlugin } from "../plugins/built-in"
export { swaggerPlugin } from "../plugins/built-in/swagger"
export { PluginRegistry } from "../plugins/registry"
export * from "../types"

// Live Components exports
export { liveComponentsPlugin } from "./live/websocket-plugin"
export { componentRegistry } from "./live/ComponentRegistry"
export { LiveComponent } from "../types/types"

// Static Files Plugin
export { staticFilesPlugin } from "./plugins/static-files-plugin"

export * from "../types/types"