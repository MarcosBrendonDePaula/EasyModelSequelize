export { generatorRegistry } from './registry'
export type { CodeGenerator, GeneratorMetadata } from './types'

// Register built-in generators
import { SequelizeGenerator } from './sequelize.generator'
import { SequelizeTSGenerator } from './sequelize-ts.generator'
import { MongoDBGenerator } from './mongodb.generator'
import { MongoDBTSGenerator } from './mongodb-ts.generator'
import { PrismaGenerator } from './prisma.generator'
import { TypeORMGenerator } from './typeorm.generator'
import { DrizzleGenerator } from './drizzle.generator'
import { SQLRawGenerator } from './sql-raw.generator'
import { generatorRegistry } from './registry'

// Sequelize JS — all dialects
generatorRegistry.register(new SequelizeGenerator('postgres'))
generatorRegistry.register(new SequelizeGenerator('mysql'))
generatorRegistry.register(new SequelizeGenerator('sqlite'))
generatorRegistry.register(new SequelizeGenerator('mssql'))

// Sequelize TS — all dialects
generatorRegistry.register(new SequelizeTSGenerator('postgres'))
generatorRegistry.register(new SequelizeTSGenerator('mysql'))
generatorRegistry.register(new SequelizeTSGenerator('sqlite'))
generatorRegistry.register(new SequelizeTSGenerator('mssql'))

// MongoDB
generatorRegistry.register(new MongoDBGenerator())
generatorRegistry.register(new MongoDBTSGenerator())

// Prisma — all dialects
generatorRegistry.register(new PrismaGenerator('postgresql'))
generatorRegistry.register(new PrismaGenerator('mysql'))
generatorRegistry.register(new PrismaGenerator('sqlite'))
generatorRegistry.register(new PrismaGenerator('sqlserver'))
generatorRegistry.register(new PrismaGenerator('mongodb'))

// TypeORM — all dialects
generatorRegistry.register(new TypeORMGenerator('postgres'))
generatorRegistry.register(new TypeORMGenerator('mysql'))
generatorRegistry.register(new TypeORMGenerator('sqlite'))
generatorRegistry.register(new TypeORMGenerator('mssql'))

// Drizzle — postgres, mysql, sqlite
generatorRegistry.register(new DrizzleGenerator('postgres'))
generatorRegistry.register(new DrizzleGenerator('mysql'))
generatorRegistry.register(new DrizzleGenerator('sqlite'))

// SQL Raw — all dialects
generatorRegistry.register(new SQLRawGenerator('postgres'))
generatorRegistry.register(new SQLRawGenerator('mysql'))
generatorRegistry.register(new SQLRawGenerator('sqlite'))
generatorRegistry.register(new SQLRawGenerator('mssql'))
