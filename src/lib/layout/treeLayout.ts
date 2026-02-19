import { Person, Relationship } from '@/types';

export interface NodePosition {
    x: number;
    y: number;
    isClone?: boolean;   // R11: this node is a clone ghost
    cloneOf?: string;    // R11: original person ID this is a clone of
}

export interface LayoutResult {
    positions: Map<string, NodePosition>;
    clones: Map<string, string>;  // clonePersonId → originalPersonId
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLE POSITION CALCULATION (for new persons - avoids expensive layout)
// ═══════════════════════════════════════════════════════════════════════════════

const NODE_WIDTH = 140;
const NODE_HEIGHT = 100;

export interface ViewportInfo {
    pan: { x: number; y: number };
    zoom: number;
    containerWidth: number;
    containerHeight: number;
}

/**
 * Calculate a simple position for a new person without running full layout.
 * This is O(1) and should be used when adding new persons to avoid delays.
 */
export function calculateSimplePosition(
    newPerson: Person,
    existingPositions: Map<string, NodePosition>,
    personsMap: Map<string, Person>,
    viewport?: ViewportInfo
): NodePosition {
    for (const parentId of newPerson.relationships.parentIds) {
        const parentPos = existingPositions.get(parentId);
        if (parentPos) {
            const siblingCount = personsMap.get(parentId)?.relationships.childIds.length ?? 1;
            const offsetX = (Math.random() - 0.5) * (siblingCount * 50);
            return {
                x: parentPos.x + offsetX,
                y: parentPos.y + NODE_HEIGHT + 100 + Math.random() * 50
            };
        }
    }

    for (const spouseId of newPerson.relationships.spouseIds) {
        const spousePos = existingPositions.get(spouseId);
        if (spousePos) {
            return {
                x: spousePos.x + NODE_WIDTH + 30,
                y: spousePos.y
            };
        }
    }

    if (existingPositions.size > 0) {
        let minX = Infinity;
        let maxY = 0;
        existingPositions.forEach(pos => {
            minX = Math.min(minX, pos.x);
            maxY = Math.max(maxY, pos.y);
        });
        return {
            x: minX + (Math.random() * 100),
            y: maxY + NODE_HEIGHT + 80 + (Math.random() * 50)
        };
    }

    return {
        x: 100 + Math.random() * 50,
        y: 100 + Math.random() * 50
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT SPACING RULES (logic reference)
// ═══════════════════════════════════════════════════════════════════════════════
//
// L1: rankSep    — Vertical gap between generation rows
//                  Controls how far parents are above children.
//                  Too large = tree looks sparse vertically
//                  Too small = generations overlap
//
// L2: nodeSep    — Horizontal gap between sibling clusters (same row)
//                  This is the spacing between two sibling families.
//                  Also used as base for TREE_GAP (cross-lineage trees).
//
// L3: spouseGap  — Gap between husband and wife nodes within one cluster
//                  Should be small to keep couples visually united.
//
// L4: margin     — Canvas edge padding (top/left)
//
// L5: minGap     — Minimum gap enforced during overlap resolution
//                  Safety buffer so nodes never touch/overlap.
//
// L6: orphanGap  — Vertical gap between main tree and orphan section
//
// L7: TREE_GAP   — Horizontal gap between cross-lineage related trees
//                  = nodeSep * 1.5 (related families stay close)
//
// L8: GROUP_GAP  — Horizontal gap between completely unrelated tree groups
//                  = orphanGap (separated clearly from each other)
//
export interface LayoutConfig {
    rankSep: number;    // L1
    nodeSep: number;    // L2
    spouseGap: number;  // L3
    margin: number;     // L4
    minGap: number;     // L5
    orphanGap: number;  // L6
    treeGapMultiplier: number;  // L7
    groupGapMultiplier: number; // L8
    siblingStackThreshold: number; // L9: max children before grid layout
}

export interface LayoutRules {
    sortByBirthDate: boolean;    // R3: sort children by birth date
    centerParent: boolean;       // R4: center parent above children
    crossLineageGrouping: boolean; // R7: group cross-lineage trees
    overlapResolution: boolean;  // R6: per-row overlap fix
    spouseOrdering: boolean;     // R2: husband-wife ordering rules
    largestGroupFirst: boolean;  // R5: largest root group placed first
    showOrphans: boolean;        // R8: show orphan nodes in grid
    normalizePositions: boolean; // R9: normalize coordinates to top-left
    compactApportioning: boolean;   // R10: proportional subtree shifting to fill gaps
    cycleBreaking: 'off' | 'clone' | 'crosslink'; // R11: pedigree collapse handling
    multiSpouseMode: 'default' | 'chronological' | 'childCount'; // R12: multi-spouse grouping
    generationAlignment: 'strict' | 'loose'; // R13: generation Y alignment mode
    siblingStacking: boolean;       // R14: grid layout for large sibling sets
    groupPacking: boolean;          // R15: bin-pack disconnected groups
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
    rankSep: 120,     // L1: vertical gap between generations
    nodeSep: 20,      // L2: horizontal gap between sibling clusters
    spouseGap: 20,    // L3: gap between spouses in a cluster
    margin: 30,       // L4: canvas margin
    minGap: 15,       // L5: minimum gap for collision resolution
    orphanGap: 80,    // L6: gap before orphan section
    treeGapMultiplier: 1.2,  // L7: multiplier for cross-lineage tree gap
    groupGapMultiplier: 3,   // L8: multiplier for unrelated group gap
    siblingStackThreshold: 6,  // L9: grid layout threshold
};

export const DEFAULT_LAYOUT_RULES: LayoutRules = {
    sortByBirthDate: true,
    centerParent: true,
    crossLineageGrouping: true,
    overlapResolution: true,
    spouseOrdering: true,
    largestGroupFirst: true,
    showOrphans: true,
    normalizePositions: true,
    compactApportioning: true,
    cycleBreaking: 'off',
    multiSpouseMode: 'chronological',
    generationAlignment: 'strict',
    siblingStacking: true,
    groupPacking: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// WALKER'S ALGORITHM — Bottom-up recursive subtree layout for family trees
// ═══════════════════════════════════════════════════════════════════════════════
//
// Algorithm Overview:
// 1. Identify visible nodes (handle collapsed subtrees)
// 2. Cluster spouses into layout units
// 3. Build parent→children tree (cluster level)
// 4. Assign generations via BFS from roots
// 5. Recursively layout each subtree bottom-up (Walker's algorithm)
//    - Leaf nodes: width = cluster width
//    - Parent nodes: children placed left-to-right, parent centered above
//    - Subtree width = MAX(own cluster width, total children width)
// 6. Place root trees side by side (cross-lineage trees close together)
// 7. Resolve any remaining overlaps
// 8. Expand cluster positions to individual person positions
// 9. Handle orphans
// 10. Normalize coordinates

export function calculateTreeLayout(
    persons: Person[],
    collapsedIds: Set<string> = new Set(),
    relationships: Relationship[] = [],
    generationMap?: Map<string, number>,
    configOverride?: Partial<LayoutConfig>,
    rulesOverride?: Partial<LayoutRules>
): LayoutResult {
    const posMap = new Map<string, NodePosition>();
    const cloneMap = new Map<string, string>();   // R11 clones
    if (persons.length === 0) return { positions: posMap, clones: cloneMap };

    const personsMap = new Map(persons.map(p => [p.personId, p]));
    const config = { ...DEFAULT_LAYOUT_CONFIG, ...configOverride };
    const rules = { ...DEFAULT_LAYOUT_RULES, ...rulesOverride };

    // --- 1. Identify Visible Nodes ---
    const visibleIds = new Set<string>();
    const roots = persons.filter(p => !p.relationships.parentIds.some(pid => personsMap.has(pid)));

    const queue = [...roots];
    persons.forEach(p => {
        if (!p.relationships.parentIds.some(pid => personsMap.has(pid)) && !roots.includes(p)) {
            queue.push(p);
        }
    });

    const processedForVisibility = new Set<string>();
    while (queue.length > 0) {
        const p = queue.shift()!;
        if (processedForVisibility.has(p.personId)) continue;
        processedForVisibility.add(p.personId);
        visibleIds.add(p.personId);

        p.relationships.spouseIds.forEach(sId => {
            if (personsMap.has(sId) && !processedForVisibility.has(sId)) {
                queue.push(personsMap.get(sId)!);
            }
        });

        if (!collapsedIds.has(p.personId)) {
            p.relationships.childIds.forEach(cId => {
                if (personsMap.has(cId)) {
                    queue.push(personsMap.get(cId)!);
                }
            });
        }
    }

    const visiblePersons = persons.filter(p => visibleIds.has(p.personId));

    // Pre-build relationship lookup map — O(1) instead of O(n) per lookup
    const relMap = new Map<string, Relationship>();
    relationships.forEach(r => {
        const key = [r.person1Id, r.person2Id].sort().join('|');
        relMap.set(key, r);
    });

    // --- 2. Cluster Spouses ---
    const personToCluster = new Map<string, string>();
    const clusters = new Map<string, { members: Person[], w: number, h: number }>();
    const sortedPersons = [...visiblePersons].sort((a, b) => a.personId.localeCompare(b.personId));

    sortedPersons.forEach(person => {
        if (personToCluster.has(person.personId)) return;

        const clusterId = `cluster-${person.personId}`;
        const members: Person[] = [person];
        personToCluster.set(person.personId, clusterId);

        const spouseQueue = [...person.relationships.spouseIds];
        const visitedSpouses = new Set<string>();

        while (spouseQueue.length > 0) {
            const sId = spouseQueue.shift()!;
            if (visitedSpouses.has(sId)) continue;
            visitedSpouses.add(sId);

            if (visibleIds.has(sId)) {
                const spouse = personsMap.get(sId);
                if (spouse && !personToCluster.has(sId)) {
                    members.push(spouse);
                    personToCluster.set(sId, clusterId);
                    spouse.relationships.spouseIds.forEach(nextS => {
                        if (!visitedSpouses.has(nextS) && nextS !== person.personId) {
                            spouseQueue.push(nextS);
                        }
                    });
                }
            }
        }

        // Marriage order-based sorting
        const getMarriageOrder = (personA: Person, personB: Person): number => {
            const key = [personA.personId, personB.personId].sort().join('|');
            const rel = relMap.get(key);
            return rel?.marriage?.marriageOrder ?? 1;
        };

        // R12: Child count-based sorting (for multi-spouse mode)
        const getSharedChildCount = (parent1: Person, parent2: Person): number => {
            const p1Children = new Set(parent1.relationships.childIds);
            return parent2.relationships.childIds.filter(cId => p1Children.has(cId)).length;
        };

        const wives = members.filter(m => m.gender === 'female');
        const husband = members.find(m => m.gender === 'male');
        const wifeCount = wives.length;

        // SPOUSE LAYOUT RULES (R2 + R12):
        // - 1 wife: [Husband] - [Wife]
        // - 2 wives: [Wife 1] - [Husband] - [Wife 2] (centered)
        // - 3+ wives: [Husband] - [Wife 1] - [Wife 2] - ... (sequential)
        const sortWives = (w: Person[]) => {
            if (!husband || w.length < 2) return;
            if (rules.multiSpouseMode === 'childCount') {
                w.sort((a, b) => getSharedChildCount(husband, b) - getSharedChildCount(husband, a));
            } else {
                // chronological (default) — by marriage order
                w.sort((a, b) => getMarriageOrder(husband, a) - getMarriageOrder(husband, b));
            }
        };

        if (rules.spouseOrdering && wifeCount === 2 && husband) {
            sortWives(wives);
            members.length = 0;
            members.push(wives[0], husband, wives[1]);
        } else if (rules.spouseOrdering) {
            members.sort((a, b) => {
                if (a.gender === 'male' && b.gender !== 'male') return -1;
                if (a.gender !== 'male' && b.gender === 'male') return 1;
                if (a.gender === 'female' && b.gender === 'female' && husband) {
                    if (rules.multiSpouseMode === 'childCount') {
                        const countA = getSharedChildCount(husband, a);
                        const countB = getSharedChildCount(husband, b);
                        if (countA !== countB) return countB - countA;
                    } else {
                        const orderA = getMarriageOrder(husband, a);
                        const orderB = getMarriageOrder(husband, b);
                        if (orderA !== orderB) return orderA - orderB;
                    }
                }
                return a.personId.localeCompare(b.personId);
            });
        }

        const width = (members.length * NODE_WIDTH) + ((members.length - 1) * config.spouseGap);
        clusters.set(clusterId, { members, w: width, h: NODE_HEIGHT });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. BUILD CLUSTER TREE (parent→children + child→parent maps)
    // ═══════════════════════════════════════════════════════════════════════════

    // Sort children by birthDate or birthOrder (eldest first = left)
    const sortChildIds = (childIds: string[]): string[] => {
        if (!rules.sortByBirthDate) return [...childIds]; // R3 disabled: no sorting
        return [...childIds].sort((a, b) => {
            const childA = personsMap.get(a);
            const childB = personsMap.get(b);
            if (!childA || !childB) return 0;

            const dateA = childA.birthDate ? new Date(childA.birthDate).getTime() : Infinity;
            const dateB = childB.birthDate ? new Date(childB.birthDate).getTime() : Infinity;
            if (dateA !== Infinity && dateB !== Infinity && dateA !== dateB) return dateA - dateB;

            const orderA = childA.birthOrder ?? Infinity;
            const orderB = childB.birthOrder ?? Infinity;
            if (orderA !== Infinity && orderB !== Infinity && orderA !== orderB) return orderA - orderB;

            if (dateA !== Infinity && dateB === Infinity) return -1;
            if (dateB !== Infinity && dateA === Infinity) return 1;
            if (orderA !== Infinity && orderB === Infinity) return -1;
            if (orderB !== Infinity && orderA === Infinity) return 1;

            return 0;
        });
    };

    // Identify clusters connected to tree (have parent or child edges)
    const clustersInGraph = new Set<string>();
    clusters.forEach((data, id) => {
        for (const m of data.members) {
            if (m.relationships.parentIds.some(pid => visibleIds.has(pid)) ||
                m.relationships.childIds.some(cid => visibleIds.has(cid))) {
                clustersInGraph.add(id);
                break;
            }
        }
    });

    // Build parent→children map (cluster level)
    const clusterChildren = new Map<string, string[]>();
    const clusterParent = new Map<string, string>();
    {
        const processed = new Set<string>();
        visiblePersons.forEach(person => {
            const parentCid = personToCluster.get(person.personId);
            if (!parentCid || !clustersInGraph.has(parentCid) || processed.has(parentCid)) return;
            processed.add(parentCid);

            const parentCluster = clusters.get(parentCid);
            if (!parentCluster) return;

            // Collect all children across all members
            const allChildIds: string[] = [];
            parentCluster.members.forEach(member => {
                member.relationships.childIds.forEach(childId => {
                    if (visibleIds.has(childId) && !allChildIds.includes(childId)) {
                        allChildIds.push(childId);
                    }
                });
            });

            // Sort by birth date
            const sortedChildren = sortChildIds(allChildIds);

            // Map to child cluster IDs (deduplicate)
            const childCids: string[] = [];
            for (const childId of sortedChildren) {
                const childCid = personToCluster.get(childId);
                if (!childCid || !clustersInGraph.has(childCid) || childCid === parentCid) continue;
                if (!childCids.includes(childCid)) {
                    childCids.push(childCid);
                    // Primary parent only (first wins — avoids DAG issues in recursion)
                    if (!clusterParent.has(childCid)) {
                        clusterParent.set(childCid, parentCid);
                    }
                }
            }

            if (childCids.length > 0) {
                clusterChildren.set(parentCid, childCids);
            }
        });
    }

    // Find root clusters (no parent in tree)
    const rootClusters: string[] = [];
    clustersInGraph.forEach(cid => {
        if (!clusterParent.has(cid)) rootClusters.push(cid);
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. GENERATION ASSIGNMENT (BFS from roots)
    // ═══════════════════════════════════════════════════════════════════════════
    const clusterGen = new Map<string, number>();
    {
        const personGen = new Map<string, number>();
        const layoutRoots: string[] = [];
        visiblePersons.forEach(p => {
            if (!p.relationships.parentIds.some(pid => visibleIds.has(pid))) {
                layoutRoots.push(p.personId);
            }
        });

        // BFS through parent→child edges
        for (const rootId of layoutRoots) {
            const bfsQueue: Array<{ id: string; gen: number }> = [{ id: rootId, gen: 1 }];
            while (bfsQueue.length > 0) {
                const { id, gen } = bfsQueue.shift()!;
                const existing = personGen.get(id);
                if (existing !== undefined && gen <= existing) continue;
                personGen.set(id, gen);

                const person = personsMap.get(id);
                if (!person) continue;
                for (const childId of person.relationships?.childIds || []) {
                    if (visibleIds.has(childId)) {
                        const childExisting = personGen.get(childId);
                        if (childExisting === undefined || gen + 1 > childExisting) {
                            bfsQueue.push({ id: childId, gen: gen + 1 });
                        }
                    }
                }
            }
        }

        // Spouses share MAX generation
        visiblePersons.forEach(p => {
            const myGen = personGen.get(p.personId);
            if (myGen === undefined) return;
            for (const spouseId of p.relationships.spouseIds) {
                const spouseGen = personGen.get(spouseId);
                if (spouseGen !== undefined) {
                    const maxGen = Math.max(myGen, spouseGen);
                    personGen.set(p.personId, maxGen);
                    personGen.set(spouseId, maxGen);
                }
            }
        });

        // Cluster generation = MAX of member generations
        clustersInGraph.forEach(cid => {
            const data = clusters.get(cid);
            if (!data) return;
            let maxGen = 0;
            for (const member of data.members) {
                const gen = personGen.get(member.personId);
                if (gen !== undefined && gen > maxGen) maxGen = gen;
            }
            if (maxGen > 0) clusterGen.set(cid, maxGen);
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. WALKER'S RECURSIVE SUBTREE LAYOUT
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // For each cluster, recursively layout its children first (bottom-up),
    // then center the parent above them. This guarantees:
    // - Parents always centered above their children
    // - Siblings always adjacent and ordered by birth date
    // - Subtrees compact with no wasted space
    // - No overlap within a single root tree

    const clusterPositions = new Map<string, { x: number, y: number }>();
    const rowHeight = NODE_HEIGHT + config.rankSep;

    // Returns the total width of the subtree rooted at this cluster.
    // Places the cluster (and recursively all descendants) starting at x offset.
    const layoutSubtree = (cid: string, x: number): number => {
        const data = clusters.get(cid);
        if (!data) return 0;

        const gen = clusterGen.get(cid) ?? 1;
        let y = config.margin + (gen - 1) * rowHeight;

        // R13: Loose generation alignment — offset Y to reduce edge crossing
        if (rules.generationAlignment === 'loose') {
            const children = clusterChildren.get(cid);
            const childCount = children?.length ?? 0;
            // Nodes with more children drift very slightly down (max 20% of rankSep)
            const maxOffset = config.rankSep * 0.2;
            const offset = Math.min(childCount * 4, maxOffset);
            y += offset;
        }

        const children = clusterChildren.get(cid);
        const ownWidth = data.w;

        // LEAF node — just place it
        if (!children || children.length === 0) {
            clusterPositions.set(cid, { x: x + ownWidth / 2, y });
            return ownWidth;
        }

        // ─── R14: SIBLING STACKING (Grid Layout) ─────────────────────────
        // When there are many children, arrange them in a multi-row grid
        // instead of a single long horizontal row.
        const useGrid = rules.siblingStacking &&
            children.length > config.siblingStackThreshold;

        if (useGrid) {
            const cols = Math.ceil(Math.sqrt(children.length));
            const rows = Math.ceil(children.length / cols);

            // Layout each child subtree to determine its width
            const childWidths: number[] = [];
            for (const childCid of children) {
                const cw = layoutSubtree(childCid, 0); // temporary x=0
                childWidths.push(cw);
            }

            // Find the max width per column for uniform grid
            const colWidths: number[] = new Array(cols).fill(0);
            for (let i = 0; i < children.length; i++) {
                const col = i % cols;
                colWidths[col] = Math.max(colWidths[col], childWidths[i]);
            }

            // Total grid width = sum of column widths + gaps
            const gridWidth = colWidths.reduce((s, w) => s + w, 0) +
                (cols - 1) * config.nodeSep;

            // Row height = rankSep (same as generation gap)
            const rowHeight = config.rankSep * 0.65;

            // Place each child in its grid cell
            const childCenters: number[] = [];
            for (let i = 0; i < children.length; i++) {
                const row = Math.floor(i / cols);
                const col = i % cols;

                // Calculate column start X
                let colX = x;
                for (let c = 0; c < col; c++) {
                    colX += colWidths[c] + config.nodeSep;
                }

                const childCid = children[i];
                const childPos = clusterPositions.get(childCid);
                if (childPos) {
                    // Shift from temp position to actual grid cell
                    const targetX = colX + colWidths[col] / 2;
                    const deltaX = targetX - childPos.x;
                    const deltaY = row * rowHeight;
                    // Shift X
                    shiftSubtree(childCid, deltaX);
                    // Shift Y for extra rows
                    if (deltaY !== 0) {
                        shiftSubtreeY(childCid, deltaY);
                    }
                    childCenters.push(targetX);
                }
            }

            const totalWidth = Math.max(ownWidth, gridWidth);
            const gridMidpoint = x + gridWidth / 2;

            if (ownWidth > gridWidth) {
                const parentCenter = x + ownWidth / 2;
                const shift = parentCenter - gridMidpoint;
                for (const childCid of children) {
                    shiftSubtree(childCid, shift);
                }
                clusterPositions.set(cid, { x: parentCenter, y });
            } else if (rules.centerParent) {
                clusterPositions.set(cid, { x: gridMidpoint, y });
            } else {
                clusterPositions.set(cid, { x: x + ownWidth / 2, y });
            }

            return totalWidth;
        }

        // ─── Default: Single-row layout (original Walker's) ──────────────
        // Recursively layout all children left-to-right
        let childX = x;
        const childCenters: number[] = [];

        for (const childCid of children) {
            const cw = layoutSubtree(childCid, childX);
            const childPos = clusterPositions.get(childCid);
            childCenters.push(childPos?.x ?? (childX + cw / 2));
            childX += cw + config.nodeSep;
        }

        const totalChildrenWidth = childX - x - config.nodeSep;

        // Center parent above the span of children centers
        const leftChild = childCenters[0];
        const rightChild = childCenters[childCenters.length - 1];
        const childrenMidpoint = (leftChild + rightChild) / 2;

        const finalWidth = Math.max(ownWidth, totalChildrenWidth);

        if (ownWidth > totalChildrenWidth) {
            // Parent wider than children: center children under parent
            const parentCenter = x + ownWidth / 2;
            const shift = parentCenter - childrenMidpoint;
            for (const childCid of children) {
                shiftSubtree(childCid, shift);
            }
            clusterPositions.set(cid, { x: parentCenter, y });
        } else if (rules.centerParent) {
            // Children wider: parent centers above children
            clusterPositions.set(cid, { x: childrenMidpoint, y });
        } else {
            // R4 disabled: parent at left edge of children
            clusterPositions.set(cid, { x: x + ownWidth / 2, y });
        }

        return finalWidth;
    };

    // Shift a cluster and ALL its descendants by deltaX
    const shiftSubtree = (cid: string, deltaX: number) => {
        const pos = clusterPositions.get(cid);
        if (pos) {
            pos.x += deltaX;
        }
        const ch = clusterChildren.get(cid);
        if (ch) {
            for (const childCid of ch) {
                shiftSubtree(childCid, deltaX);
            }
        }
    };

    // Shift a cluster and ALL its descendants by deltaY (for R14 grid stacking)
    const shiftSubtreeY = (cid: string, deltaY: number) => {
        const pos = clusterPositions.get(cid);
        if (pos) {
            pos.y += deltaY;
        }
        const ch = clusterChildren.get(cid);
        if (ch) {
            for (const childCid of ch) {
                shiftSubtreeY(childCid, deltaY);
            }
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. LAYOUT ROOT TREES SIDE BY SIDE
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // 6a: Group connected root trees (cross-lineage marriages make two
    //     separate root trees "connected" — place them close together)
    // 6b: Layout each group

    // Map every cluster to its root ancestor
    const clusterToRoot = new Map<string, string>();
    const assignRoot = (cid: string, rootCid: string) => {
        clusterToRoot.set(cid, rootCid);
        const ch = clusterChildren.get(cid);
        if (ch) {
            for (const childCid of ch) {
                assignRoot(childCid, rootCid);
            }
        }
    };
    for (const rootCid of rootClusters) {
        assignRoot(rootCid, rootCid);
    }

    // Find cross-lineage connections (spouses from different root trees)
    // R11 Clone mode: Instead of connecting trees, clone the spouse into the receiving tree
    const rootConnections = new Map<string, Set<string>>();
    for (const rootCid of rootClusters) {
        rootConnections.set(rootCid, new Set());
    }

    const clonedPairs = new Set<string>(); // track "personA|personB" pairs already cloned

    visiblePersons.forEach(person => {
        const cid = personToCluster.get(person.personId);
        if (!cid) return;
        const myRoot = clusterToRoot.get(cid);

        person.relationships.spouseIds.forEach(spouseId => {
            const spouseCid = personToCluster.get(spouseId);
            if (!spouseCid) return;
            const spouseRoot = clusterToRoot.get(spouseCid);

            if (myRoot && spouseRoot && myRoot !== spouseRoot) {
                // R11 Clone mode: create a ghost clone instead of connecting trees
                if (rules.cycleBreaking === 'clone') {
                    const pairKey = [person.personId, spouseId].sort().join('|');
                    if (clonedPairs.has(pairKey)) return;
                    clonedPairs.add(pairKey);

                    // Clone the spouse into person's tree (the person who has children in this tree)
                    const spouse = personsMap.get(spouseId);
                    if (!spouse) return;

                    const clonePersonId = `clone-${spouseId}-in-${cid}`;
                    const cloneClusterId = `clone-cluster-${spouseId}-for-${cid}`;

                    // Create a single-member clone cluster
                    clusters.set(cloneClusterId, {
                        members: [{ ...spouse, personId: clonePersonId }],
                        w: NODE_WIDTH,
                        h: NODE_HEIGHT
                    });

                    // Map clone to its cluster
                    personToCluster.set(clonePersonId, cloneClusterId);
                    clustersInGraph.add(cloneClusterId);

                    // Make the clone cluster a child-less sibling attached to the same parent as `cid`
                    const parentOfLocal = clusterParent.get(cid);
                    if (parentOfLocal) {
                        clusterParent.set(cloneClusterId, parentOfLocal);
                        const siblings = clusterChildren.get(parentOfLocal);
                        if (siblings) {
                            // Insert clone right after the local cluster
                            const localIdx = siblings.indexOf(cid);
                            siblings.splice(localIdx + 1, 0, cloneClusterId);
                        }
                    }

                    // Assign clone to same root tree
                    clusterToRoot.set(cloneClusterId, myRoot);

                    // Assign same generation as the local cluster
                    const localGen = clusterGen.get(cid);
                    if (localGen !== undefined) {
                        clusterGen.set(cloneClusterId, localGen);
                    }

                    // Record in clone map for rendering
                    cloneMap.set(clonePersonId, spouseId);
                } else {
                    // Default: connect root trees for grouping
                    rootConnections.get(myRoot)?.add(spouseRoot);
                    rootConnections.get(spouseRoot)?.add(myRoot);
                }
            }
        });
    });

    // BFS to group connected root trees (or skip if R7 disabled)
    const visitedRoots = new Set<string>();
    const rootGroups: string[][] = [];

    if (rules.crossLineageGrouping) {
        for (const rootCid of rootClusters) {
            if (visitedRoots.has(rootCid)) continue;
            const group: string[] = [];
            const bfs = [rootCid];
            while (bfs.length > 0) {
                const r = bfs.shift()!;
                if (visitedRoots.has(r)) continue;
                visitedRoots.add(r);
                group.push(r);
                const connected = rootConnections.get(r);
                if (connected) {
                    for (const conn of connected) {
                        if (!visitedRoots.has(conn)) bfs.push(conn);
                    }
                }
            }
            rootGroups.push(group);
        }
    } else {
        // R7 disabled: each root is its own group
        for (const rootCid of rootClusters) {
            rootGroups.push([rootCid]);
        }
    }

    // Largest group first (R5)
    if (rules.largestGroupFirst) {
        rootGroups.sort((a, b) => b.length - a.length);
    }

    // Layout each group — related trees close, unrelated trees far
    const GROUP_GAP = Math.round(config.nodeSep * (config.groupGapMultiplier ?? 3));   // L8
    const TREE_GAP = Math.round(config.nodeSep * (config.treeGapMultiplier ?? 1.2));   // L7

    // First pass: layout each group to determine bounding boxes
    interface GroupBBox { groupIdx: number; w: number; h: number; trees: string[]; }
    const groupBoxes: GroupBBox[] = [];

    for (let gi = 0; gi < rootGroups.length; gi++) {
        const group = rootGroups[gi];
        let groupX = 0;
        for (const rootCid of group) {
            const w = layoutSubtree(rootCid, groupX);
            groupX += w + TREE_GAP;
        }
        const groupWidth = groupX - TREE_GAP;

        // Calculate group height from cluster positions
        let maxY = 0;
        const computeMaxY = (cid: string) => {
            const pos = clusterPositions.get(cid);
            const cl = clusters.get(cid);
            if (pos && cl) {
                maxY = Math.max(maxY, pos.y + cl.h / 2);
            }
            const ch = clusterChildren.get(cid);
            if (ch) ch.forEach(c => computeMaxY(c));
        };
        group.forEach(r => computeMaxY(r));

        groupBoxes.push({ groupIdx: gi, w: groupWidth, h: maxY, trees: group });
    }

    // R15: Bin-pack groups into rows for balanced aspect ratio
    if (rules.groupPacking && groupBoxes.length > 1) {
        // Estimate target width: aim for roughly square/16:9 aspect ratio
        const totalArea = groupBoxes.reduce((s, g) => s + g.w * Math.max(g.h, 200), 0);
        const targetWidth = Math.max(
            Math.sqrt(totalArea * (16 / 9)),
            groupBoxes[0].w + GROUP_GAP  // at least fit the largest group
        );

        // Simple row-based packing
        let curRowX = 0;
        let curRowY = 0;
        let curRowMaxH = 0;

        for (const box of groupBoxes) {
            // Would this group exceed the target width? Start new row
            if (curRowX > 0 && curRowX + box.w > targetWidth) {
                curRowY += curRowMaxH + GROUP_GAP;
                curRowX = 0;
                curRowMaxH = 0;
            }

            // Shift all clusters in this group to their packed position
            // Currently they are at x=0..groupWidth, y based on generation
            // We need to shift by (curRowX - 0, curRowY - 0)
            const shiftX = curRowX;
            const shiftY = curRowY;

            for (const rootCid of box.trees) {
                if (shiftX !== 0) shiftSubtree(rootCid, shiftX);
                if (shiftY !== 0) shiftSubtreeY(rootCid, shiftY);
            }

            curRowX += box.w + GROUP_GAP;
            curRowMaxH = Math.max(curRowMaxH, box.h);
        }
    } else {
        // Original linear layout: place groups side by side
        let globalXOffset = 0;
        for (let gi = 0; gi < groupBoxes.length; gi++) {
            const box = groupBoxes[gi];
            // Groups are already laid out starting from x=0, shift them
            if (globalXOffset !== 0) {
                for (const rootCid of box.trees) {
                    shiftSubtree(rootCid, globalXOffset);
                }
            }
            globalXOffset += box.w + GROUP_GAP;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 6.5. OVERLAP RESOLUTION (per-row scan)
    // ═══════════════════════════════════════════════════════════════════════════
    // Walker's algorithm guarantees no overlap within a single root tree,
    // but cross-lineage clusters may cause overlaps between trees.
    if (rules.overlapResolution) {
        const byRow = new Map<number, string[]>();
        for (const [cid, pos] of clusterPositions) {
            const ry = Math.round(pos.y / 10) * 10;
            if (!byRow.has(ry)) byRow.set(ry, []);
            byRow.get(ry)!.push(cid);
        }

        for (const [, ids] of byRow) {
            if (ids.length < 2) continue;
            ids.sort((a, b) => (clusterPositions.get(a)?.x ?? 0) - (clusterPositions.get(b)?.x ?? 0));

            for (let i = 1; i < ids.length; i++) {
                const prevPos = clusterPositions.get(ids[i - 1]);
                const currPos = clusterPositions.get(ids[i]);
                const prevData = clusters.get(ids[i - 1]);
                const currData = clusters.get(ids[i]);
                if (!prevPos || !currPos || !prevData || !currData) continue;

                const minX = prevPos.x + prevData.w / 2 + config.minGap + currData.w / 2;
                if (currPos.x < minX) {
                    const shift = minX - currPos.x;
                    for (let j = i; j < ids.length; j++) {
                        const p = clusterPositions.get(ids[j]);
                        if (p) p.x += shift;
                    }
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 6.6. COMPACT APPORTIONING — R10
    // ═══════════════════════════════════════════════════════════════════════════
    // After overlap resolution, scan each row for excess gaps. If adjacent
    // clusters have no tree relationship blocking them, shift them closer
    // proportionally to fill empty space (Walker apportion-style).
    if (rules.compactApportioning) {
        const byRow = new Map<number, string[]>();
        for (const [cid, pos] of clusterPositions) {
            const ry = Math.round(pos.y / 10) * 10;
            if (!byRow.has(ry)) byRow.set(ry, []);
            byRow.get(ry)!.push(cid);
        }

        for (const [, ids] of byRow) {
            if (ids.length < 3) continue;
            ids.sort((a, b) => (clusterPositions.get(a)?.x ?? 0) - (clusterPositions.get(b)?.x ?? 0));

            // Identify internal clusters (not first or last in row) that have
            // excess gap on both sides — shift them to center of their neighbors
            for (let i = 1; i < ids.length - 1; i++) {
                const prev = clusterPositions.get(ids[i - 1]);
                const curr = clusterPositions.get(ids[i]);
                const next = clusterPositions.get(ids[i + 1]);
                if (!prev || !curr || !next) continue;

                const prevData = clusters.get(ids[i - 1]);
                const currData = clusters.get(ids[i]);
                const nextData = clusters.get(ids[i + 1]);
                if (!prevData || !currData || !nextData) continue;

                // Only compact if this cluster is NOT a parent/child of neighbors
                // (we don't want to break the parent-centered layout)
                const isRelated = (a: string, b: string) =>
                    clusterChildren.get(a)?.includes(b) || clusterChildren.get(b)?.includes(a);

                if (isRelated(ids[i], ids[i - 1]) || isRelated(ids[i], ids[i + 1])) continue;

                // Calculate ideal centered position between neighbors
                const leftEdge = prev.x + prevData.w / 2 + config.minGap + currData.w / 2;
                const rightEdge = next.x - nextData.w / 2 - config.minGap - currData.w / 2;
                const idealX = (leftEdge + rightEdge) / 2;

                // Only shift if it reduces the gap (don't expand)
                if (Math.abs(idealX - curr.x) > config.minGap) {
                    const shift = idealX - curr.x;
                    shiftSubtree(ids[i], shift);
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 7. EXPAND TO INDIVIDUAL POSITIONS
    // ═══════════════════════════════════════════════════════════════════════════
    let currentMaxY = 0;

    clustersInGraph.forEach(clusterId => {
        const data = clusters.get(clusterId);
        const centerPos = clusterPositions.get(clusterId);
        if (!data || !centerPos) return;

        currentMaxY = Math.max(currentMaxY, centerPos.y + NODE_HEIGHT / 2);
        const startX = centerPos.x - (data.w / 2);

        data.members.forEach((member, index) => {
            const memberX = startX + (index * (NODE_WIDTH + config.spouseGap));
            const originalId = cloneMap.get(member.personId);
            posMap.set(member.personId, {
                x: memberX,
                y: centerPos.y - (NODE_HEIGHT / 2),
                ...(originalId ? { isClone: true, cloneOf: originalId } : {})
            });
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 8. HANDLE ORPHANS — R8 (no parent AND no child connections — grid layout)
    // ═══════════════════════════════════════════════════════════════════════════
    if (rules.showOrphans) {
        const orphansY = currentMaxY + config.orphanGap;
        let orphanCurrentX = 50;
        let orphanRow = 0;
        const MAX_ORPHANS_PER_ROW = 8;
        let orphansInCurrentRow = 0;

        clusters.forEach((data, id) => {
            if (!clustersInGraph.has(id)) {
                const startX = orphanCurrentX;
                const rowY = orphansY + orphanRow * (NODE_HEIGHT + 80);
                data.members.forEach((member, index) => {
                    const memberX = startX + (index * (NODE_WIDTH + config.spouseGap));
                    posMap.set(member.personId, {
                        x: memberX,
                        y: rowY
                    });
                });
                orphanCurrentX += data.w + config.nodeSep;
                orphansInCurrentRow++;
                if (orphansInCurrentRow >= MAX_ORPHANS_PER_ROW) {
                    orphanCurrentX = 50;
                    orphanRow++;
                    orphansInCurrentRow = 0;
                }
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 9. NORMALIZE — R9: shift everything so top-left starts at (margin, margin)
    // ═══════════════════════════════════════════════════════════════════════════
    if (rules.normalizePositions) {
        let minX = Infinity;
        let minY = Infinity;
        posMap.forEach(pos => {
            minX = Math.min(minX, pos.x);
            minY = Math.min(minY, pos.y);
        });

        if (minX !== Infinity) {
            const offsetX = config.margin - minX;
            const offsetY = config.margin - minY;
            posMap.forEach((pos, id) => {
                posMap.set(id, { x: pos.x + offsetX, y: pos.y + offsetY });
            });
        }
    }

    return { positions: posMap, clones: cloneMap };
}
