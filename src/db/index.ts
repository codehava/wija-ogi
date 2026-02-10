// ═══════════════════════════════════════════════════════════════════════════════
// WIJA 3 - Database Connection (PostgreSQL via postgres.js)
// ═══════════════════════════════════════════════════════════════════════════════

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// Create postgres.js connection
// Use max 1 connection for serverless/edge (Next.js API routes)
const client = postgres(connectionString, {
    max: process.env.NODE_ENV === 'production' ? 10 : 3,
    idle_timeout: 20,
    connect_timeout: 10,
});

// Create Drizzle instance with schema
export const db = drizzle(client, { schema });

// Export for use in other modules
export { schema };
export type Database = typeof db;
