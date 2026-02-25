# EasyModel

Collaborative ER diagram designer with multi-ORM code generation. Built with FluxStack (Bun + Elysia + React 19 + Tailwind v4).

## Getting Started

```bash
# Start development
bun run dev

# Build for production
bun run build

# Start production server
bun run start
```

## Project Structure

```
EasyModel/
├── core/                    # FluxStack framework
├── app/
│   ├── server/
│   │   ├── generators/      # 8 code generators (Sequelize, Prisma, TypeORM, Drizzle, MongoDB, SQL Raw)
│   │   ├── diff/            # Schema diff engine for incremental migrations
│   │   ├── validators/      # Schema validation
│   │   ├── live/            # LiveSchemaDesigner (real-time collaboration)
│   │   └── routes/          # API routes
│   ├── client/
│   │   ├── components/designer/  # Canvas, Toolbox, FieldRow, Modals
│   │   └── pages/           # DesignerPage
│   └── shared/
│       └── types/           # Schema types (FieldProperties, SchemaModel, etc.)
└── package.json
```

## Supported Generators

| Generator | Dialects | Migrations |
|-----------|----------|------------|
| **Sequelize JS** | PostgreSQL, MySQL, SQLite, MSSQL | Full incremental |
| **Sequelize TS** | PostgreSQL, MySQL, SQLite, MSSQL | Full incremental |
| **Prisma** | PostgreSQL, MySQL, SQLite, SQL Server, MongoDB | `prisma migrate` |
| **TypeORM** | PostgreSQL, MySQL, SQLite, MSSQL | `typeorm migration:generate` |
| **Drizzle** | PostgreSQL, MySQL, SQLite | `drizzle-kit generate` |
| **MongoDB JS** | MongoDB | N/A |
| **MongoDB TS** | MongoDB | N/A |
| **SQL Raw** | PostgreSQL, MySQL, SQLite, MSSQL | DDL only |

## Features

- Real-time collaborative editing via rooms
- Drag-and-drop field types from toolbox
- Visual ER diagram with associations (1:1, 1:M, M:N)
- 24 field types with dialect-aware mappings
- STRING/CHAR length, DECIMAL precision/scale support
- ENUM editor with dynamic tags
- Schema import/export (JSON)
- Generate ZIP with full project scaffolding
- Incremental migration history (Sequelize)

## Learn More

- **FluxStack Docs**: [FluxStack Repository](https://github.com/MarcosBrendonDePaula/FluxStack)

---

Built with FluxStack
