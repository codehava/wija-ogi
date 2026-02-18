import { Person, Relationship } from '@/types';

interface NodePosition {
    x: number;
    y: number;
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

// Standardized layout spacing
const LAYOUT_CONFIG = {
    rankSep: 180,     // Vertical gap between generations
    nodeSep: 50,      // Horizontal gap between sibling clusters
    spouseGap: 30,    // Gap between spouses in a cluster
    margin: 50,       // Canvas margin
    minGap: 25,       // Minimum gap for collision resolution
    orphanGap: 150,   // Gap before orphan section
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
    generationMap?: Map<string, number>
): Map<string, NodePosition> {
    const posMap = new Map<string, NodePosition>();
    if (persons.length === 0) return posMap;

    const personsMap = new Map(persons.map(p => [p.personId, p]));

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
    const config = LAYOUT_CONFIG;

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

        const wives = members.filter(m => m.gender === 'female');
        const husband = members.find(m => m.gender === 'male');
        const wifeCount = wives.length;

        // SPOUSE LAYOUT RULES:
        // - 1 wife: [Husband] - [Wife]
        // - 2 wives: [Wife 1] - [Husband] - [Wife 2] (centered)
        // - 3+ wives: [Husband] - [Wife 1] - [Wife 2] - ... (sequential)
        if (wifeCount === 2 && husband) {
            wives.sort((a, b) => {
                const orderA = getMarriageOrder(husband, a);
                const orderB = getMarriageOrder(husband, b);
                return orderA - orderB;
            });
            members.length = 0;
            members.push(wives[0], husband, wives[1]);
        } else {
            members.sort((a, b) => {
                if (a.gender === 'male' && b.gender !== 'male') return -1;
                if (a.gender !== 'male' && b.gender === 'male') return 1;
                if (a.gender === 'female' && b.gender === 'female' && husband) {
                    const orderA = getMarriageOrder(husband, a);
                    const orderB = getMarriageOrder(husband, b);
                    if (orderA !== orderB) return orderA - orderB;
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
        const y = config.margin + (gen - 1) * rowHeight;

        const children = clusterChildren.get(cid);
        const ownWidth = data.w;

        // LEAF node — just place it
        if (!children || children.length === 0) {
            clusterPositions.set(cid, { x: x + ownWidth / 2, y });
            return ownWidth;
        }

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
        } else {
            // Children wider: parent centers above children
            clusterPositions.set(cid, { x: childrenMidpoint, y });
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
    const rootConnections = new Map<string, Set<string>>();
    for (const rootCid of rootClusters) {
        rootConnections.set(rootCid, new Set());
    }

    visiblePersons.forEach(person => {
        const cid = personToCluster.get(person.personId);
        if (!cid) return;
        const myRoot = clusterToRoot.get(cid);

        person.relationships.spouseIds.forEach(spouseId => {
            const spouseCid = personToCluster.get(spouseId);
            if (!spouseCid) return;
            const spouseRoot = clusterToRoot.get(spouseCid);

            if (myRoot && spouseRoot && myRoot !== spouseRoot) {
                rootConnections.get(myRoot)?.add(spouseRoot);
                rootConnections.get(spouseRoot)?.add(myRoot);
            }
        });
    });

    // BFS to group connected root trees
    const visitedRoots = new Set<string>();
    const rootGroups: string[][] = [];

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

    // Largest group first
    rootGroups.sort((a, b) => b.length - a.length);

    // Layout each group — related trees close, unrelated trees far
    let globalX = 0;
    const GROUP_GAP = config.orphanGap;
    const TREE_GAP = config.nodeSep * 2;

    for (const group of rootGroups) {
        let groupX = globalX;
        for (const rootCid of group) {
            const w = layoutSubtree(rootCid, groupX);
            groupX += w + TREE_GAP;
        }
        globalX = groupX - TREE_GAP + GROUP_GAP;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 6.5. OVERLAP RESOLUTION (per-row scan)
    // ═══════════════════════════════════════════════════════════════════════════
    // Walker's algorithm guarantees no overlap within a single root tree,
    // but cross-lineage clusters may cause overlaps between trees.
    {
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
            posMap.set(member.personId, {
                x: memberX,
                y: centerPos.y - (NODE_HEIGHT / 2)
            });
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 8. HANDLE ORPHANS (no parent AND no child connections — grid layout)
    // ═══════════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════════
    // 9. NORMALIZE — shift everything so top-left starts at (50, 50)
    // ═══════════════════════════════════════════════════════════════════════════
    let minX = Infinity;
    let minY = Infinity;
    posMap.forEach(pos => {
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
    });

    if (minX !== Infinity) {
        const offsetX = 50 - minX;
        const offsetY = 50 - minY;
        posMap.forEach((pos, id) => {
            posMap.set(id, { x: pos.x + offsetX, y: pos.y + offsetY });
        });
    }

    return posMap;
}
