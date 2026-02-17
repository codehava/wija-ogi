// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Dynamic Generation Calculator
// Based on WIJA Blueprint v5.0
// NO STORED GENERATION FIELD - Calculated at runtime using BFS
// ═══════════════════════════════════════════════════════════════════════════════

import { Person } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────────
// GENERATION LABELS (Indonesian)
// ─────────────────────────────────────────────────────────────────────────────────

const GENERATION_LABELS: Record<number, string> = {
    1: 'Leluhur',
    2: 'Anak',
    3: 'Cucu',
    4: 'Cicit',
    5: 'Canggah',
    6: 'Wareng',
    7: 'Udeg-udeg',
    8: 'Gantung Siwur'
};

// ─────────────────────────────────────────────────────────────────────────────────
// CORE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Calculate generation for a SINGLE person at RUNTIME using BFS algorithm
 * @param personId - ID of the person to calculate generation for
 * @param rootId - ID of the root ancestor
 * @param personsMap - Map of all persons (id -> Person)
 * @returns Generation number (1-based), or -1 if not connected
 */
export function calculateGeneration(
    personId: string,
    rootId: string,
    personsMap: Map<string, Person>
): number {
    if (!personId || !rootId || personsMap.size === 0) return -1;
    if (personId === rootId) return 1;

    const visited = new Set<string>();
    const queue: Array<{ id: string; gen: number }> = [{ id: rootId, gen: 1 }];

    while (queue.length > 0) {
        const { id, gen } = queue.shift()!;

        if (visited.has(id)) continue;
        visited.add(id);

        if (id === personId) return gen;

        const person = personsMap.get(id);
        if (!person) continue;

        // Add children (next generation)
        const childIds = person.relationships?.childIds || [];
        for (const childId of childIds) {
            if (!visited.has(childId)) {
                queue.push({ id: childId, gen: gen + 1 });
            }
        }
    }

    return -1; // Not connected to root
}

/**
 * Get generation label in Indonesian
 * @param gen - Generation number
 * @returns Indonesian label for the generation
 */
export function getGenerationLabel(gen: number): string {
    if (gen < 1) return 'Tidak terhubung';
    return GENERATION_LABELS[gen] || `Generasi ke-${gen}`;
}

/**
 * P1 FIX: Calculate generations for ALL persons in a SINGLE BFS pass — O(n)
 * Previously each person triggered a separate BFS (O(n²)).
 * Now does a single BFS from root, visiting each person exactly once.
 * 
 * @param persons - Array of all persons
 * @param rootId - ID of the root ancestor
 * @returns Map of personId -> generation number
 */
export function calculateAllGenerations(
    persons: Person[],
    rootId: string
): Map<string, number> {
    const personsMap = new Map<string, Person>();
    persons.forEach(p => personsMap.set(p.personId, p));

    return calculateAllGenerationsFromMap(rootId, personsMap);
}

/**
 * Single-pass BFS generation calculator using a pre-built personsMap.
 * This is the core O(n) implementation used by both calculateAllGenerations
 * and the useFamilyTree hook.
 */
export function calculateAllGenerationsFromMap(
    rootId: string,
    personsMap: Map<string, Person>
): Map<string, number> {
    const generations = new Map<string, number>();
    if (!rootId || personsMap.size === 0) return generations;

    const queue: Array<{ id: string; gen: number }> = [{ id: rootId, gen: 1 }];

    while (queue.length > 0) {
        const { id, gen } = queue.shift()!;
        if (generations.has(id)) continue;
        generations.set(id, gen);

        const person = personsMap.get(id);
        if (!person) continue;

        const childIds = person.relationships?.childIds || [];
        for (const childId of childIds) {
            if (!generations.has(childId)) {
                queue.push({ id: childId, gen: gen + 1 });
            }
        }
    }

    return generations;
}

/**
 * Multi-root generation calculator.
 * Finds ALL root ancestors (persons with no parents in the tree),
 * runs BFS from each, and merges results.
 * For persons reachable from multiple roots (cross-lineage marriages),
 * keeps the MINIMUM generation number to align cross-lineage generations.
 *
 * @param personsMap - Map of all persons (id -> Person)
 * @returns Map of personId -> generation number (1-based)
 */
export function calculateMultiRootGenerations(
    personsMap: Map<string, Person>
): Map<string, number> {
    const generations = new Map<string, number>();
    if (personsMap.size === 0) return generations;

    // Find all root ancestors: persons whose parentIds don't reference anyone in the tree
    const roots: Person[] = [];
    for (const person of personsMap.values()) {
        const hasParentInTree = (person.relationships?.parentIds || [])
            .some(pid => personsMap.has(pid));
        if (!hasParentInTree) {
            roots.push(person);
        }
    }

    // If no roots found, fall back to isRootAncestor flag
    if (roots.length === 0) {
        const flaggedRoot = findRootAncestor([...personsMap.values()]);
        if (flaggedRoot) roots.push(flaggedRoot);
    }

    // BFS from each root, keeping minimum generation for cross-linked persons
    for (const root of roots) {
        const queue: Array<{ id: string; gen: number }> = [{ id: root.personId, gen: 1 }];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const { id, gen } = queue.shift()!;
            if (visited.has(id)) continue;
            visited.add(id);

            // Keep minimum generation if already assigned from another root's BFS
            const existing = generations.get(id);
            if (existing === undefined || gen < existing) {
                generations.set(id, gen);
            }

            const person = personsMap.get(id);
            if (!person) continue;

            // Traverse to spouses (same generation)
            for (const spouseId of person.relationships?.spouseIds || []) {
                if (!visited.has(spouseId)) {
                    queue.push({ id: spouseId, gen });
                }
            }

            // Traverse to children (next generation)
            for (const childId of person.relationships?.childIds || []) {
                if (!visited.has(childId)) {
                    queue.push({ id: childId, gen: gen + 1 });
                }
            }
        }
    }

    return generations;
}

/**
 * Get the maximum generation depth in the tree
 * @param persons - Array of all persons
 * @param rootId - ID of the root ancestor
 * @returns Maximum generation number
 */
export function getMaxGeneration(
    persons: Person[],
    rootId: string
): number {
    const generations = calculateAllGenerations(persons, rootId);
    let maxGen = 0;

    for (const gen of generations.values()) {
        if (gen > maxGen) maxGen = gen;
    }

    return maxGen;
}

/**
 * Get persons grouped by generation
 * @param persons - Array of all persons
 * @param rootId - ID of the root ancestor
 * @returns Object with generation numbers as keys and arrays of persons as values
 */
export function groupByGeneration(
    persons: Person[],
    rootId: string
): Record<number, Person[]> {
    const personsMap = new Map<string, Person>();
    persons.forEach(p => personsMap.set(p.personId, p));

    const generations = calculateAllGenerationsFromMap(rootId, personsMap);
    const groups: Record<number, Person[]> = {};

    for (const person of persons) {
        const gen = generations.get(person.personId);
        if (gen === undefined || gen === -1) continue;

        if (!groups[gen]) {
            groups[gen] = [];
        }
        groups[gen].push(person);
    }

    return groups;
}

/**
 * Find the root ancestor from a list of persons
 * @param persons - Array of all persons
 * @returns Root ancestor person, or undefined
 */
export function findRootAncestor(persons: Person[]): Person | undefined {
    return persons.find(p => p.isRootAncestor);
}

/**
 * Get generation statistics
 * @param persons - Array of all persons
 * @param rootId - ID of the root ancestor
 * @returns Statistics about generations
 */
export function getGenerationStats(
    persons: Person[],
    rootId: string
): {
    totalGenerations: number;
    personsByGeneration: Record<number, number>;
    disconnectedCount: number;
} {
    const groups = groupByGeneration(persons, rootId);
    const generations = Object.keys(groups).map(Number);

    const personsByGeneration: Record<number, number> = {};
    for (const [gen, personList] of Object.entries(groups)) {
        personsByGeneration[Number(gen)] = personList.length;
    }

    // Count disconnected persons
    const connectedCount = Object.values(groups).flat().length;
    const disconnectedCount = persons.length - connectedCount;

    return {
        totalGenerations: generations.length > 0 ? Math.max(...generations) : 0,
        personsByGeneration,
        disconnectedCount
    };
}
