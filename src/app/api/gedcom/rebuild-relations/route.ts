// POST /api/gedcom/rebuild-relations
// Rebuild denormalized relationship arrays on persons from the relationships table
// Use this to fix trees that were imported before the denormalization fix

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { persons, relationships } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { isFamilyMember } from '@/lib/services/families';
import { safeErrorResponse, applyRateLimit } from '@/lib/apiHelpers';
import { RATE_LIMITS } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
    try {
        // Rate limit: 3 per minute for sensitive operations
        const rateLimited = applyRateLimit(request, RATE_LIMITS.SENSITIVE);
        if (rateLimited) return rateLimited;

        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { treeId } = body;

        if (!treeId) {
            return NextResponse.json({ error: 'treeId is required' }, { status: 400 });
        }

        const isMember = await isFamilyMember(treeId, session.user.id);
        if (!isMember) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Fetch all relationships for this tree
        const rels = await db.select().from(relationships).where(eq(relationships.treeId, treeId));

        // Build maps
        const spouseMap = new Map<string, Set<string>>();
        const parentMap = new Map<string, Set<string>>();
        const childMap = new Map<string, Set<string>>();

        for (const rel of rels) {
            if (rel.type === 'spouse') {
                if (!spouseMap.has(rel.person1Id)) spouseMap.set(rel.person1Id, new Set());
                if (!spouseMap.has(rel.person2Id)) spouseMap.set(rel.person2Id, new Set());
                spouseMap.get(rel.person1Id)!.add(rel.person2Id);
                spouseMap.get(rel.person2Id)!.add(rel.person1Id);
            } else if (rel.type === 'parent-child') {
                // person1 = parent, person2 = child
                if (!parentMap.has(rel.person2Id)) parentMap.set(rel.person2Id, new Set());
                parentMap.get(rel.person2Id)!.add(rel.person1Id);
                if (!childMap.has(rel.person1Id)) childMap.set(rel.person1Id, new Set());
                childMap.get(rel.person1Id)!.add(rel.person2Id);
            }
        }

        // Compute siblings
        const siblingMap = new Map<string, Set<string>>();
        for (const [, children] of childMap) {
            const childArray = Array.from(children);
            for (const child of childArray) {
                if (!siblingMap.has(child)) siblingMap.set(child, new Set());
                for (const sibling of childArray) {
                    if (sibling !== child) {
                        siblingMap.get(child)!.add(sibling);
                    }
                }
            }
        }

        // Batch update all affected persons
        const allPersonIds = new Set([
            ...spouseMap.keys(),
            ...parentMap.keys(),
            ...childMap.keys(),
            ...siblingMap.keys(),
        ]);

        let updatedCount = 0;
        for (const personId of allPersonIds) {
            const updates: Record<string, string[]> = {};
            if (spouseMap.has(personId)) updates.spouseIds = Array.from(spouseMap.get(personId)!);
            if (parentMap.has(personId)) updates.parentIds = Array.from(parentMap.get(personId)!);
            if (childMap.has(personId)) updates.childIds = Array.from(childMap.get(personId)!);
            if (siblingMap.has(personId)) updates.siblingIds = Array.from(siblingMap.get(personId)!);

            await db.update(persons)
                .set(updates)
                .where(eq(persons.id, personId));
            updatedCount++;
        }

        // ── Auto-detect root ancestor if not already set ──
        const treePersons = await db.select().from(persons).where(eq(persons.treeId, treeId));
        const hasRoot = treePersons.some(p => p.isRootAncestor === true);

        if (!hasRoot) {
            // Find person with no parents (not in parentMap) and most children
            const candidates = treePersons.filter(
                p => !parentMap.has(p.id) || parentMap.get(p.id)!.size === 0
            );

            if (candidates.length > 0) {
                let bestRootId = candidates[0].id;
                let maxChildren = 0;

                for (const c of candidates) {
                    const childCount = childMap.has(c.id) ? childMap.get(c.id)!.size : 0;
                    if (childCount > maxChildren) {
                        maxChildren = childCount;
                        bestRootId = c.id;
                    }
                }

                await db.update(persons)
                    .set({ isRootAncestor: true })
                    .where(eq(persons.id, bestRootId));
            }
        }

        return NextResponse.json({
            message: 'Relationships rebuilt successfully',
            totalRelationships: rels.length,
            personsUpdated: updatedCount,
            spouseLinks: spouseMap.size,
            parentLinks: parentMap.size,
            childLinks: childMap.size,
            siblingLinks: siblingMap.size,
        });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to rebuild relations');
    }
}
