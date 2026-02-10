// Migration endpoint - creates all tables directly
// DELETE THIS FILE after tables are created!
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST() {
    const results: string[] = [];

    try {
        // 1. Users table
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255),
                email VARCHAR(255) NOT NULL UNIQUE,
                email_verified TIMESTAMP,
                image VARCHAR(500),
                password_hash VARCHAR(255),
                preferred_script VARCHAR(10) DEFAULT 'both',
                preferred_theme VARCHAR(10) DEFAULT 'light',
                preferred_language VARCHAR(5) DEFAULT 'id',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        results.push('✅ users');

        // 2. Accounts table
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS accounts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(255) NOT NULL,
                provider VARCHAR(255) NOT NULL,
                provider_account_id VARCHAR(255) NOT NULL,
                refresh_token TEXT,
                access_token TEXT,
                expires_at INTEGER,
                token_type VARCHAR(255),
                scope VARCHAR(255),
                id_token TEXT,
                session_state VARCHAR(255)
            )
        `);
        results.push('✅ accounts');

        // 3. Sessions table
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_token VARCHAR(255) NOT NULL UNIQUE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires TIMESTAMP NOT NULL
            )
        `);
        results.push('✅ sessions');

        // 4. Verification Tokens table
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS verification_tokens (
                identifier VARCHAR(255) NOT NULL,
                token VARCHAR(255) NOT NULL UNIQUE,
                expires TIMESTAMP NOT NULL
            )
        `);
        results.push('✅ verification_tokens');

        // 5. Trees table
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS trees (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                display_name VARCHAR(255),
                slug VARCHAR(255) UNIQUE,
                owner_id UUID REFERENCES users(id),
                root_ancestor_id UUID,
                script_mode VARCHAR(10) DEFAULT 'both',
                theme VARCHAR(10) DEFAULT 'light',
                language VARCHAR(5) DEFAULT 'id',
                plan VARCHAR(20) DEFAULT 'free',
                plan_status VARCHAR(20) DEFAULT 'active',
                member_count INTEGER DEFAULT 0,
                person_count INTEGER DEFAULT 0,
                relationship_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        results.push('✅ trees');

        // 6. Tree Members table
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS tree_members (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role VARCHAR(20) NOT NULL DEFAULT 'viewer',
                display_name VARCHAR(255),
                linked_person_id UUID,
                joined_at TIMESTAMP DEFAULT NOW(),
                invited_by UUID,
                last_active_at TIMESTAMP DEFAULT NOW()
            )
        `);
        await db.execute(sql`
            CREATE UNIQUE INDEX IF NOT EXISTS tree_members_tree_user_idx 
            ON tree_members(tree_id, user_id)
        `);
        results.push('✅ tree_members');

        // 7. Persons table
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS persons (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
                gedcom_id VARCHAR(50),
                first_name VARCHAR(255) NOT NULL,
                middle_name VARCHAR(255),
                last_name VARCHAR(255) NOT NULL,
                full_name VARCHAR(500),
                lontara_first_name TEXT,
                lontara_middle_name TEXT,
                lontara_last_name TEXT,
                lontara_first_name_custom TEXT,
                lontara_middle_name_custom TEXT,
                lontara_last_name_custom TEXT,
                gender VARCHAR(10) NOT NULL DEFAULT 'unknown',
                birth_date VARCHAR(20),
                birth_place VARCHAR(500),
                birth_place_lontara TEXT,
                birth_order INTEGER,
                death_date VARCHAR(20),
                death_place VARCHAR(500),
                death_place_lontara TEXT,
                is_living BOOLEAN DEFAULT true,
                occupation VARCHAR(255),
                biography TEXT,
                spouse_ids JSONB DEFAULT '[]'::jsonb,
                parent_ids JSONB DEFAULT '[]'::jsonb,
                child_ids JSONB DEFAULT '[]'::jsonb,
                sibling_ids JSONB DEFAULT '[]'::jsonb,
                is_root_ancestor BOOLEAN DEFAULT false,
                position_x REAL DEFAULT 0,
                position_y REAL DEFAULT 0,
                position_fixed BOOLEAN DEFAULT false,
                photo_url VARCHAR(500),
                thumbnail_url VARCHAR(500),
                created_by UUID,
                updated_by UUID,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        await db.execute(sql`
            CREATE INDEX IF NOT EXISTS persons_tree_idx ON persons(tree_id)
        `);
        results.push('✅ persons');

        // 8. Relationships table
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS relationships (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
                gedcom_family_id VARCHAR(50),
                type VARCHAR(20) NOT NULL,
                person1_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
                person2_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
                marriage_date VARCHAR(20),
                marriage_place VARCHAR(500),
                marriage_place_lontara TEXT,
                marriage_status VARCHAR(20),
                marriage_order INTEGER,
                biological_parent BOOLEAN DEFAULT true,
                divorce_date VARCHAR(20),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS relationships_tree_idx ON relationships(tree_id)`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS relationships_person1_idx ON relationships(person1_id)`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS relationships_person2_idx ON relationships(person2_id)`);
        results.push('✅ relationships');

        // 9. Sources table
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS sources (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
                gedcom_id VARCHAR(50),
                title TEXT NOT NULL,
                author TEXT,
                publisher TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        results.push('✅ sources');

        // 10. Media table
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS media (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
                gedcom_id VARCHAR(50),
                person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
                file_path VARCHAR(500),
                file_type VARCHAR(50),
                title VARCHAR(255),
                s3_key VARCHAR(500),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        results.push('✅ media');

        // 11. Invitations table
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS invitations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
                tree_name VARCHAR(255),
                email VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'viewer',
                invited_by UUID REFERENCES users(id),
                invited_by_name VARCHAR(255),
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                responded_at TIMESTAMP
            )
        `);
        results.push('✅ invitations');

        // 12. Activities table
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS activities (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
                action VARCHAR(50) NOT NULL,
                description TEXT,
                target_id UUID,
                target_type VARCHAR(20),
                performed_by UUID REFERENCES users(id),
                performed_by_name VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS activities_tree_idx ON activities(tree_id)`);
        results.push('✅ activities');

        return NextResponse.json({
            status: 'success',
            tables: results,
            message: 'All tables created successfully! You can delete this endpoint now.',
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            status: 'error',
            tablesCreated: results,
            error: message,
        }, { status: 500 });
    }
}
