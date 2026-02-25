export const ERROR_CODES = {
  // Validation errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Authentication errors (401)
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  
  // Authorization errors (403)
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ACCESS_DENIED: 'ACCESS_DENIED',
  
  // Not found errors (404)
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  ENDPOINT_NOT_FOUND: 'ENDPOINT_NOT_FOUND',
  
  // Conflict errors (409)
  CONFLICT: 'CONFLICT',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  
  // Server errors (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  
  // Service unavailable (503)
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  MAINTENANCE_MODE: 'MAINTENANCE_MODE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Plugin errors
  PLUGIN_ERROR: 'PLUGIN_ERROR',
  PLUGIN_NOT_FOUND: 'PLUGIN_NOT_FOUND',
  PLUGIN_INITIALIZATION_ERROR: 'PLUGIN_INITIALIZATION_ERROR',
  
  // Configuration errors
  CONFIG_ERROR: 'CONFIG_ERROR',
  INVALID_CONFIG: 'INVALID_CONFIG',
  MISSING_CONFIG: 'MISSING_CONFIG',
  
  // Build errors
  BUILD_ERROR: 'BUILD_ERROR',
  COMPILATION_ERROR: 'COMPILATION_ERROR',
  BUNDLING_ERROR: 'BUNDLING_ERROR'
} as const

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]

export const getErrorMessage = (code: ErrorCode): string => {
  const messages: Record<ErrorCode, string> = {
    // Validation errors
    VALIDATION_ERROR: 'Validation failed',
    INVALID_INPUT: 'Invalid input provided',
    MISSING_REQUIRED_FIELD: 'Required field is missing',
    INVALID_FORMAT: 'Invalid format',
    
    // Authentication errors
    UNAUTHORIZED: 'Authentication required',
    INVALID_TOKEN: 'Invalid authentication token',
    TOKEN_EXPIRED: 'Authentication token has expired',
    INVALID_CREDENTIALS: 'Invalid credentials provided',
    
    // Authorization errors
    FORBIDDEN: 'Access forbidden',
    INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
    ACCESS_DENIED: 'Access denied',
    
    // Not found errors
    NOT_FOUND: 'Resource not found',
    RESOURCE_NOT_FOUND: 'Requested resource not found',
    ENDPOINT_NOT_FOUND: 'API endpoint not found',
    
    // Conflict errors
    CONFLICT: 'Resource conflict',
    RESOURCE_ALREADY_EXISTS: 'Resource already exists',
    DUPLICATE_ENTRY: 'Duplicate entry',
    
    // Server errors
    INTERNAL_ERROR: 'Internal server error',
    INTERNAL_SERVER_ERROR: 'Internal server error',
    DATABASE_ERROR: 'Database operation failed',
    EXTERNAL_SERVICE_ERROR: 'External service error',
    
    // Service unavailable
    SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
    MAINTENANCE_MODE: 'Service is under maintenance',
    RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
    
    // Plugin errors
    PLUGIN_ERROR: 'Plugin error',
    PLUGIN_NOT_FOUND: 'Plugin not found',
    PLUGIN_INITIALIZATION_ERROR: 'Plugin initialization failed',
    
    // Configuration errors
    CONFIG_ERROR: 'Configuration error',
    INVALID_CONFIG: 'Invalid configuration',
    MISSING_CONFIG: 'Missing configuration',
    
    // Build errors
    BUILD_ERROR: 'Build error',
    COMPILATION_ERROR: 'Compilation failed',
    BUNDLING_ERROR: 'Bundling failed'
  }
  
  return messages[code] || 'Unknown error'
}