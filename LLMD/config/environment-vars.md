# Environment Variables Reference

**Version:** 1.11.0 | **Updated:** 2025-02-08

## Quick Facts

- All env vars are optional (have defaults)
- Type casting automatic (strings → numbers/booleans)
- Validation on startup
- Defined in `config/system/*.config.ts`

## Application

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `APP_NAME` | string | `'fluxstack-app'` | Application name | app.config.ts |
| `APP_VERSION` | string | `'1.0.0'` | Application version | app.config.ts |
| `APP_DESCRIPTION` | string | `'A FluxStack application'` | Application description | app.config.ts |
| `NODE_ENV` | enum | `'development'` | Environment: `development`, `production`, `test` | app.config.ts |
| `FLUXSTACK_MODE` | enum | `'full-stack'` | Runtime mode: `full-stack`, `backend-only`, `frontend-only` | app.config.ts |
| `APP_TRUST_PROXY` | boolean | `false` | Trust proxy headers | app.config.ts |
| `APP_SESSION_SECRET` | string | `''` | Session secret key | app.config.ts |

## Server

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `PORT` | number | `3000` | Server port (1-65535) | server.config.ts |
| `HOST` | string | `'localhost'` | Server host | server.config.ts |
| `API_PREFIX` | string | `'/api'` | API route prefix (must start with `/`) | server.config.ts |
| `BACKEND_PORT` | number | `3001` | Backend-only mode port | server.config.ts |
| `ENABLE_REQUEST_LOGGING` | boolean | `true` | Enable request logging | server.config.ts |
| `SHOW_SERVER_BANNER` | boolean | `true` | Show startup banner | server.config.ts |

## CORS

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `CORS_ORIGINS` | array | `['http://localhost:3000', 'http://localhost:5173']` | Allowed origins (comma-separated) | server.config.ts |
| `CORS_METHODS` | array | `['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']` | Allowed HTTP methods | server.config.ts |
| `CORS_HEADERS` | array | `['Content-Type', 'Authorization']` | Allowed headers | server.config.ts |
| `CORS_CREDENTIALS` | boolean | `false` | Allow credentials | server.config.ts |
| `CORS_MAX_AGE` | number | `86400` | Preflight cache duration (seconds) | server.config.ts |

## Client (Vite)

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `VITE_PORT` | number | `5173` | Vite dev server port | client.config.ts |
| `VITE_HOST` | string | `'localhost'` | Vite dev server host | client.config.ts |
| `VITE_STRICT_PORT` | boolean | `true` | Fail if port unavailable | client.config.ts |
| `VITE_OPEN` | boolean | `false` | Auto-open browser | client.config.ts |
| `ENABLE_VITE_PROXY_LOGS` | boolean | `false` | Enable proxy logging | client.config.ts |
| `VITE_LOG_LEVEL` | enum | `undefined` | Log level: `error`, `warn`, `info`, `silent` | client.config.ts |

## Client Build

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `CLIENT_OUTDIR` | string | `'dist/client'` | Client build output directory | client.config.ts |
| `CLIENT_SOURCEMAPS` | boolean | `true` (dev) / `false` (prod) | Generate source maps | client.config.ts |
| `CLIENT_MINIFY` | boolean | `false` (dev) / `true` (prod) | Minify output | client.config.ts |
| `CLIENT_TARGET` | string | `'esnext'` | Build target | client.config.ts |
| `CLIENT_ASSETS_DIR` | string | `'assets'` | Assets directory name | client.config.ts |
| `CLIENT_CSS_CODE_SPLIT` | boolean | `true` | Split CSS into chunks | client.config.ts |
| `CLIENT_CHUNK_SIZE_WARNING` | number | `500` | Chunk size warning limit (KB) | client.config.ts |
| `CLIENT_EMPTY_OUTDIR` | boolean | `true` | Empty output dir before build | client.config.ts |

## Build

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `BUILD_TARGET` | enum | `'bun'` | Build target: `bun`, `node`, `docker` | build.config.ts |
| `BUILD_OUT_DIR` | string | `'dist'` | Build output directory | build.config.ts |
| `BUILD_SOURCE_MAPS` | boolean | `true` (dev) / `false` (prod) | Generate source maps | build.config.ts |
| `BUILD_CLEAN` | boolean | `true` | Clean output dir before build | build.config.ts |
| `BUILD_MODE` | enum | `'development'` / `'production'` | Build mode | build.config.ts |
| `BUILD_EXTERNAL` | array | `[]` | External dependencies (comma-separated) | build.config.ts |
| `BUILD_OPTIMIZE` | boolean | `true` | Enable optimizations | build.config.ts |

## Build Optimization

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `BUILD_MINIFY` | boolean | `false` (dev) / `true` (prod) | Minify code | build.config.ts |
| `BUILD_TREESHAKE` | boolean | `true` | Remove unused code | build.config.ts |
| `BUILD_COMPRESS` | boolean | `false` (dev) / `true` (prod) | Compress output | build.config.ts |
| `BUILD_SPLIT_CHUNKS` | boolean | `true` | Split code into chunks | build.config.ts |
| `BUILD_BUNDLE_ANALYZER` | boolean | `false` | Enable bundle analyzer | build.config.ts |
| `BUILD_REMOVE_UNUSED_CSS` | boolean | `false` | Remove unused CSS | build.config.ts |
| `BUILD_OPTIMIZE_IMAGES` | boolean | `false` | Optimize images | build.config.ts |

## Live Component Logging

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `LIVE_LOGGING` | string | `undefined` | Global live component logs: `true`, `false`, or comma-separated categories (`lifecycle,rooms,messages`) | env only |

> Per-component logging is controlled via `static logging` on the class. See [Live Logging](../resources/live-logging.md).

## Authentication

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `AUTH_DEFAULT_GUARD` | enum | `'session'` | Auth guard: `session`, `token` | auth.config.ts |
| `AUTH_DEFAULT_PROVIDER` | enum | `'memory'` | User provider: `memory`, `database` | auth.config.ts |
| `AUTH_HASH_ALGORITHM` | enum | `'bcrypt'` | Hash algorithm: `bcrypt`, `argon2id` | auth.config.ts |
| `AUTH_BCRYPT_ROUNDS` | number | `10` | Bcrypt cost rounds | auth.config.ts |
| `AUTH_RATE_LIMIT_MAX_ATTEMPTS` | number | `5` | Max login attempts before lockout | auth.config.ts |
| `AUTH_RATE_LIMIT_DECAY_SECONDS` | number | `60` | Rate limit window (seconds) | auth.config.ts |
| `AUTH_TOKEN_TTL` | number | `86400` | Bearer token TTL (seconds, token guard only) | auth.config.ts |

## Session

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `SESSION_COOKIE` | string | `'fluxstack_session'` | Session cookie name | session.config.ts |
| `SESSION_LIFETIME` | number | `7200` | Session duration (seconds) | session.config.ts |
| `SESSION_HTTP_ONLY` | boolean | `true` | HttpOnly cookie flag | session.config.ts |
| `SESSION_SECURE` | boolean | `false` | Secure cookie flag (HTTPS only) | session.config.ts |
| `SESSION_SAME_SITE` | enum | `'lax'` | SameSite policy: `lax`, `strict`, `none` | session.config.ts |

## Logging

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `LOG_LEVEL` | enum | `'info'` | Log level: `debug`, `info`, `warn`, `error` | logger.config.ts |
| `LOG_FORMAT` | enum | `'pretty'` | Log format: `pretty`, `json` | logger.config.ts |
| `LOG_DATE_FORMAT` | string | `'YYYY-MM-DD HH:mm:ss'` | Date format string | logger.config.ts |
| `LOG_OBJECT_DEPTH` | number | `4` | Object inspection depth | logger.config.ts |
| `LOG_TO_FILE` | boolean | `false` | Enable file logging | logger.config.ts |
| `LOG_MAX_SIZE` | string | `'20m'` | Max log file size | logger.config.ts |
| `LOG_MAX_FILES` | string | `'14d'` | Max log file retention | logger.config.ts |
| `LOG_TRANSPORTS` | array | `['console']` | Log transports (comma-separated) | logger.config.ts |
| `LOG_COLORS` | boolean | `true` | Enable colored output | logger.config.ts |
| `LOG_STACK_TRACE` | boolean | `true` | Show stack traces | logger.config.ts |

## Plugins

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `FLUXSTACK_PLUGINS_ENABLED` | array | `['logger', 'swagger', 'vite', 'cors', 'static-files']` | Enabled plugins | plugins.config.ts |
| `FLUXSTACK_PLUGINS_DISABLED` | array | `[]` | Disabled plugins | plugins.config.ts |
| `PLUGINS_AUTO_DISCOVER` | boolean | `true` | Auto-discover plugins | plugins.config.ts |
| `PLUGINS_DIR` | string | `'plugins'` | Plugins directory | plugins.config.ts |
| `PLUGINS_DISCOVER_NPM` | boolean | `false` | Discover npm plugins | plugins.config.ts |
| `PLUGINS_DISCOVER_PROJECT` | boolean | `true` | Discover project plugins | plugins.config.ts |
| `PLUGINS_ALLOWED` | array | `[]` | Whitelist of allowed plugins | plugins.config.ts |
| `LOGGER_PLUGIN_ENABLED` | boolean | `true` | Enable logger plugin | plugins.config.ts |

## Swagger

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `SWAGGER_ENABLED` | boolean | `true` | Enable Swagger UI | plugins.config.ts |
| `SWAGGER_TITLE` | string | `'FluxStack API'` | API documentation title | plugins.config.ts |
| `SWAGGER_VERSION` | string | `'1.11.0'` | API version | plugins.config.ts |
| `SWAGGER_DESCRIPTION` | string | `'API documentation for FluxStack application'` | API description | plugins.config.ts |
| `SWAGGER_PATH` | string | `'/swagger'` | Swagger UI path | plugins.config.ts |
| `SWAGGER_EXCLUDE_PATHS` | array | `[]` | Paths to exclude from docs | plugins.config.ts |
| `SWAGGER_SERVERS` | string | `''` | API servers (JSON string) | plugins.config.ts |
| `SWAGGER_PERSIST_AUTH` | boolean | `true` | Persist authorization | plugins.config.ts |
| `SWAGGER_DISPLAY_DURATION` | boolean | `true` | Display request duration | plugins.config.ts |
| `SWAGGER_ENABLE_FILTER` | boolean | `true` | Enable endpoint filter | plugins.config.ts |
| `SWAGGER_SHOW_EXTENSIONS` | boolean | `true` | Show extensions | plugins.config.ts |
| `SWAGGER_TRY_IT_OUT` | boolean | `true` | Enable "Try it out" | plugins.config.ts |
| `SWAGGER_AUTH_ENABLED` | boolean | `false` | Enable basic auth for Swagger | plugins.config.ts |
| `SWAGGER_AUTH_USERNAME` | string | `'admin'` | Swagger auth username | plugins.config.ts |
| `SWAGGER_AUTH_PASSWORD` | string | `''` | Swagger auth password | plugins.config.ts |

## Static Files

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `STATIC_FILES_ENABLED` | boolean | `true` | Enable static file serving | plugins.config.ts |
| `STATIC_PUBLIC_DIR` | string | `'public'` | Public files directory | plugins.config.ts |
| `STATIC_UPLOADS_DIR` | string | `'uploads'` | Uploads directory | plugins.config.ts |
| `STATIC_CACHE_MAX_AGE` | number | `31536000` | Cache max age (seconds) | plugins.config.ts |
| `STATIC_ENABLE_UPLOADS` | boolean | `true` | Enable uploads serving | plugins.config.ts |
| `STATIC_ENABLE_PUBLIC` | boolean | `true` | Enable public files serving | plugins.config.ts |

## Vite Plugin

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `VITE_PLUGIN_ENABLED` | boolean | `true` | Enable Vite plugin | plugins.config.ts |
| `VITE_EXCLUDE_PATHS` | array | `['/api', '/swagger']` | Paths to exclude from Vite proxy | plugins.config.ts |

## Monitoring

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `ENABLE_MONITORING` | boolean | `false` | Enable monitoring | monitoring.config.ts |
| `MONITORING_EXPORTERS` | array | `[]` | Monitoring exporters | monitoring.config.ts |
| `ENABLE_HEALTH_CHECKS` | boolean | `true` | Enable health checks | monitoring.config.ts |
| `HEALTH_CHECK_INTERVAL` | number | `30000` | Health check interval (ms) | monitoring.config.ts |
| `ENABLE_ALERTS` | boolean | `false` | Enable alerting | monitoring.config.ts |
| `ALERT_WEBHOOK` | string | `undefined` | Alert webhook URL | monitoring.config.ts |

## Metrics

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `ENABLE_METRICS` | boolean | `false` | Enable metrics collection | monitoring.config.ts |
| `METRICS_INTERVAL` | number | `5000` | Collection interval (ms, min 1000) | monitoring.config.ts |
| `HTTP_METRICS` | boolean | `true` | Collect HTTP metrics | monitoring.config.ts |
| `SYSTEM_METRICS` | boolean | `true` | Collect system metrics | monitoring.config.ts |
| `CUSTOM_METRICS` | boolean | `false` | Enable custom metrics | monitoring.config.ts |
| `METRICS_EXPORT_CONSOLE` | boolean | `true` (dev) / `false` (prod) | Export to console | monitoring.config.ts |
| `METRICS_EXPORT_FILE` | boolean | `false` | Export to file | monitoring.config.ts |
| `METRICS_EXPORT_HTTP` | boolean | `false` | Export via HTTP | monitoring.config.ts |
| `METRICS_EXPORT_URL` | string | `undefined` | HTTP export URL | monitoring.config.ts |
| `METRICS_RETENTION_PERIOD` | number | `3600000` | Retention period (ms) | monitoring.config.ts |
| `METRICS_MAX_DATA_POINTS` | number | `1000` | Max data points to store | monitoring.config.ts |

## Profiling

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `PROFILING_ENABLED` | boolean | `false` | Enable profiling | monitoring.config.ts |
| `PROFILING_SAMPLE_RATE` | number | `0.1` (dev) / `0.01` (prod) | Sample rate (0-1) | monitoring.config.ts |
| `MEMORY_PROFILING` | boolean | `false` | Enable memory profiling | monitoring.config.ts |
| `CPU_PROFILING` | boolean | `false` | Enable CPU profiling | monitoring.config.ts |
| `HEAP_SNAPSHOT` | boolean | `false` | Enable heap snapshots | monitoring.config.ts |
| `PROFILING_OUTPUT_DIR` | string | `'profiling'` | Profiling output directory | monitoring.config.ts |
| `PROFILING_MAX_PROFILES` | number | `10` | Max profiles to keep | monitoring.config.ts |

## Runtime (Reloadable)

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `ENABLE_SWAGGER` | boolean | `true` | Enable Swagger (runtime) | runtime.config.ts |
| `DEBUG` | boolean | `false` | Enable debug mode | runtime.config.ts |
| `RATE_LIMIT_ENABLED` | boolean | `true` | Enable rate limiting | runtime.config.ts |
| `RATE_LIMIT_MAX` | number | `100` | Max requests per window | runtime.config.ts |
| `RATE_LIMIT_WINDOW` | number | `60000` | Rate limit window (ms) | runtime.config.ts |
| `REQUEST_TIMEOUT` | number | `30000` | Request timeout (ms) | runtime.config.ts |
| `MAX_UPLOAD_SIZE` | number | `10485760` | Max upload size (bytes, default 10MB) | runtime.config.ts |
| `MAINTENANCE_MODE` | boolean | `false` | Enable maintenance mode | runtime.config.ts |
| `MAINTENANCE_MESSAGE` | string | `'System is under maintenance...'` | Maintenance message | runtime.config.ts |

## Database

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `DATABASE_URL` | string | `''` | Database connection URL | database.config.ts |
| `DATABASE_PROVIDER` | enum | `'postgres'` | Provider: `postgres`, `mysql`, `sqlite`, `mssql`, `mongodb` | database.config.ts |
| `DATABASE_CONNECTION_TIMEOUT` | number | `5000` | Connection timeout (ms) | database.config.ts |
| `DATABASE_SSL` | boolean | `false` | Enable SSL connection | database.config.ts |

## Services - Email

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `MAIL_HOST` | string | `'smtp.example.com'` | SMTP host | services.config.ts |
| `MAIL_PORT` | number | `587` | SMTP port | services.config.ts |
| `MAIL_USERNAME` | string | `''` | SMTP username | services.config.ts |
| `MAIL_PASSWORD` | string | `''` | SMTP password | services.config.ts |
| `MAIL_FROM_ADDRESS` | string | `'no-reply@example.com'` | From email address | services.config.ts |
| `MAIL_SECURE` | boolean | `false` | Use TLS/SSL | services.config.ts |

## Services - JWT

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `JWT_SECRET` | string | `'change-me'` | JWT secret key | services.config.ts |
| `JWT_EXPIRES_IN` | string | `'1h'` | Token expiration | services.config.ts |
| `JWT_AUDIENCE` | string | `'fluxstack'` | JWT audience | services.config.ts |
| `JWT_ISSUER` | string | `'fluxstack'` | JWT issuer | services.config.ts |

## Services - Storage

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `STORAGE_DRIVER` | enum | `'local'` | Storage driver: `local`, `s3` | services.config.ts |
| `STORAGE_LOCAL_DIR` | string | `'uploads'` | Local storage directory | services.config.ts |
| `STORAGE_S3_BUCKET` | string | `''` | S3 bucket name | services.config.ts |
| `STORAGE_S3_REGION` | string | `''` | S3 region | services.config.ts |
| `STORAGE_S3_ENDPOINT` | string | `''` | S3 endpoint URL | services.config.ts |

## Services - Redis

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `REDIS_ENABLED` | boolean | `false` | Enable Redis | services.config.ts |
| `REDIS_URL` | string | `'redis://localhost:6379'` | Redis connection URL | services.config.ts |

## System

| Variable | Type | Default | Description | Config File |
|----------|------|---------|-------------|-------------|
| `USER` | string | `''` | Current user (Unix) | system.config.ts |
| `USERNAME` | string | `''` | Current user (Windows) | system.config.ts |
| `HOME` | string | `''` | Home directory (Unix) | system.config.ts |
| `USERPROFILE` | string | `''` | Home directory (Windows) | system.config.ts |
| `PWD` | string | `''` | Current working directory | system.config.ts |
| `PATH` | string | `''` | System PATH | system.config.ts |
| `SHELL` | string | `''` | Shell executable | system.config.ts |
| `TERM` | string | `''` | Terminal type | system.config.ts |
| `LANG` | string | `'en_US.UTF-8'` | System language | system.config.ts |
| `TMPDIR` | string | `''` | Temporary directory | system.config.ts |
| `CI` | boolean | `false` | Running in CI environment | system.config.ts |

## Validation Rules

### Port Numbers
- Must be between 1 and 65535
- Validated on startup

### Rate Limiting
- `RATE_LIMIT_MAX` must be positive
- `RATE_LIMIT_WINDOW` must be positive

### Metrics
- `METRICS_INTERVAL` must be at least 1000ms

### Profiling
- `PROFILING_SAMPLE_RATE` must be between 0 and 1

### API Prefix
- Must start with `/`

### Timeouts
- `REQUEST_TIMEOUT` must be positive
- `DATABASE_CONNECTION_TIMEOUT` must be positive

## Type Casting

### String to Number
```bash
PORT=3000  # → 3000 (number)
```

### String to Boolean
```bash
ENABLE_FEATURE=true   # → true
ENABLE_FEATURE=1      # → true
ENABLE_FEATURE=yes    # → true
ENABLE_FEATURE=on     # → true
ENABLE_FEATURE=false  # → false
```

### String to Array
```bash
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
# → ['http://localhost:3000', 'http://localhost:5173']
```

### String to Object
```bash
METADATA='{"key":"value"}'  # → { key: "value" }
```

## Related

- [Declarative System](./declarative-system.md) - Config schema and validation
- [Runtime Reload](./runtime-reload.md) - Reloadable configuration
