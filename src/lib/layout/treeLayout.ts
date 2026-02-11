import dagre from 'dagre';
import { Person, Relationship } from '@/types';

interface NodePosition {
    x: number;
    y: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLE POSITION CALCULATION (for new persons - avoids expensive dagre)
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
 * Calculate a simple position for a new person without running full dagre layout.
 * This is O(1) and should be used when adding new persons to avoid 10+ second delays.
 * 
 * Strategy:
 * - If person has a parent with known position → place below parent with offset
 * - If person has a spouse with known position → place next to spouse
 * - Otherwise → place in current viewport area (where user is looking)
 */
export function calculateSimplePosition(
    newPerson: Person,
    existingPositions: Map<string, NodePosition>,
    personsMap: Map<string, Person>,
    viewport?: ViewportInfo
): NodePosition {
    // Try to find a parent with a known position
    for (const parentId of newPerson.relationships.parentIds) {
        const parentPos = existingPositions.get(parentId);
        if (parentPos) {
            // Place below parent with slight random offset to avoid overlap
            const siblingCount = personsMap.get(parentId)?.relationships.childIds.length ?? 1;
            const offsetX = (Math.random() - 0.5) * (siblingCount * 50);
            return {
                x: parentPos.x + offsetX,
                y: parentPos.y + NODE_HEIGHT + 100 + Math.random() * 50
            };
        }
    }

    // Try to find a spouse with a known position
    for (const spouseId of newPerson.relationships.spouseIds) {
        const spousePos = existingPositions.get(spouseId);
        if (spousePos) {
            // Place next to spouse
            return {
                x: spousePos.x + NODE_WIDTH + 30,
                y: spousePos.y
            };
        }
    }

    // Fallback: Place at BOTTOM-LEFT of existing nodes
    // This makes it easy to find new persons
    if (existingPositions.size > 0) {
        let minX = Infinity;
        let maxY = 0;
        existingPositions.forEach(pos => {
            minX = Math.min(minX, pos.x);
            maxY = Math.max(maxY, pos.y);
        });

        // Place below and to the left of existing nodes
        return {
            x: minX + (Math.random() * 100), // Slight random to avoid overlap
            y: maxY + NODE_HEIGHT + 80 + (Math.random() * 50)
        };
    }

    // Empty tree - start at top-left with padding
    return {
        x: 100 + Math.random() * 50,
        y: 100 + Math.random() * 50
    };
}

// Layout Constants for full dagre layout
const SPOUSE_GAP = 80;    // Gap between spouses (wide for Bugis tree style)

// Dynamic spacing based on tree size
function getLayoutSpacing(personCount: number) {
    // Scale spacing up for larger trees to reduce overlap
    const scale = Math.min(personCount / 50, 1); // 0..1 based on tree size
    return {
        rankSep: Math.round(220 + scale * 130),   // 220–350 vertical gap between generations
        nodeSep: Math.round(140 + scale * 80),     // 140–220 horizontal gap between clusters
    };
}

export function calculateTreeLayout(
    persons: Person[],
    collapsedIds: Set<string> = new Set(),
    relationships: Relationship[] = []
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

        // Build a map of spouse relationships for marriageOrder lookup
        const getMarriageOrder = (personA: Person, personB: Person): number => {
            // Find the spouse relationship between these two
            const rel = relationships.find(r =>
                r.type === 'spouse' &&
                ((r.person1Id === personA.personId && r.person2Id === personB.personId) ||
                    (r.person1Id === personB.personId && r.person2Id === personA.personId))
            );
            return rel?.marriage?.marriageOrder ?? 1;
        };

        // Count wives in this cluster
        const wives = members.filter(m => m.gender === 'female');
        const husband = members.find(m => m.gender === 'male');
        const wifeCount = wives.length;

        // SPOUSE LAYOUT RULES:
        // - 1 wife: [Husband] - [Wife] (standard layout)
        // - 2 wives: [Wife 1] - [Husband] - [Wife 2] (husband in center)
        // - 3+ wives: [Husband] - [Wife 1] - [Wife 2] - [Wife 3] (husband left)

        if (wifeCount === 2 && husband) {
            // Special case: 2 wives - husband in the middle
            // Sort wives by marriageOrder
            wives.sort((a, b) => {
                const orderA = getMarriageOrder(husband, a);
                const orderB = getMarriageOrder(husband, b);
                return orderA - orderB;
            });
            // Reorder: [Wife 1] - [Husband] - [Wife 2]
            members.length = 0;
            members.push(wives[0], husband, wives[1]);
        } else {
            // Standard case: husband left, wives sorted by marriageOrder
            members.sort((a, b) => {
                // Males first (husband on left)
                if (a.gender === 'male' && b.gender !== 'male') return -1;
                if (a.gender !== 'male' && b.gender === 'male') return 1;

                // Both are same gender - if both female, sort by marriageOrder
                if (a.gender === 'female' && b.gender === 'female' && husband) {
                    const orderA = getMarriageOrder(husband, a);
                    const orderB = getMarriageOrder(husband, b);
                    if (orderA !== orderB) return orderA - orderB;
                }

                // Fallback to personId for consistent ordering
                return a.personId.localeCompare(b.personId);
            });
        }

        const width = (members.length * NODE_WIDTH) + ((members.length - 1) * SPOUSE_GAP);
        clusters.set(clusterId, { members, w: width, h: NODE_HEIGHT });
    });

    // --- 3. Build Dagre Graph ---
    const { rankSep, nodeSep } = getLayoutSpacing(persons.length);

    const g = new dagre.graphlib.Graph();
    g.setGraph({
        rankdir: 'TB',
        ranksep: rankSep,
        nodesep: nodeSep,
        marginx: 80,
        marginy: 80,
        ranker: 'longest-path',  // Better generation alignment for family trees
        align: 'UL',             // Consistent upper-left alignment within ranks
    });
    g.setDefaultEdgeLabel(() => ({}));

    const clustersInGraph = new Set<string>();

    clusters.forEach((data, id) => {
        let hasEdges = false;
        for (const m of data.members) {
            const hasParents = m.relationships.parentIds.some(pid => visibleIds.has(pid));
            const hasChildren = m.relationships.childIds.some(cid => visibleIds.has(cid));
            if (hasParents || hasChildren) {
                hasEdges = true;
                break;
            }
        }
        if (hasEdges) {
            g.setNode(id, { width: data.w, height: data.h });
            clustersInGraph.add(id);
        }
    });

    // --- Helper: Sort children by birthDate or birthOrder (eldest first = left) ---
    const sortChildIds = (childIds: string[]): string[] => {
        return [...childIds].sort((a, b) => {
            const childA = personsMap.get(a);
            const childB = personsMap.get(b);
            if (!childA || !childB) return 0;

            // First priority: birthDate (earliest first)
            const dateA = childA.birthDate ? new Date(childA.birthDate).getTime() : Infinity;
            const dateB = childB.birthDate ? new Date(childB.birthDate).getTime() : Infinity;
            if (dateA !== Infinity && dateB !== Infinity && dateA !== dateB) {
                return dateA - dateB; // Earlier date first (elder left)
            }

            // Second priority: birthOrder (lower number first)
            const orderA = childA.birthOrder ?? Infinity;
            const orderB = childB.birthOrder ?? Infinity;
            if (orderA !== Infinity && orderB !== Infinity && orderA !== orderB) {
                return orderA - orderB; // Lower order first (elder left)
            }

            // If one has date and other doesn't, dated one comes first
            if (dateA !== Infinity && dateB === Infinity) return -1;
            if (dateB !== Infinity && dateA === Infinity) return 1;

            // If one has birthOrder and other doesn't, ordered one comes first
            if (orderA !== Infinity && orderB === Infinity) return -1;
            if (orderB !== Infinity && orderA === Infinity) return 1;

            return 0; // Keep original order
        });
    };

    // Add Edges (children in sorted order for proper left-to-right placement)
    const addedEdges = new Set<string>();
    visiblePersons.forEach(person => {
        const sourceCluster = personToCluster.get(person.personId);
        if (!sourceCluster || !clustersInGraph.has(sourceCluster)) return;

        // Sort children before adding edges (elder left, younger right)
        const sortedChildIds = sortChildIds(person.relationships.childIds);

        sortedChildIds.forEach(childId => {
            if (!visibleIds.has(childId)) return;
            const targetCluster = personToCluster.get(childId);
            if (!targetCluster || !clustersInGraph.has(targetCluster)) return;
            if (sourceCluster === targetCluster) return;

            const edgeKey = `${sourceCluster}->${targetCluster}`;
            if (!addedEdges.has(edgeKey)) {
                g.setEdge(sourceCluster, targetCluster, { weight: 2, minlen: 1 });
                addedEdges.add(edgeKey);
            }
        });
    });

    // --- 4. Run Dagre Layout ---
    dagre.layout(g);

    // --- 5. Extract Positions ---
    const clusterPositions = new Map<string, { x: number, y: number }>();
    g.nodes().forEach(id => {
        const n = g.node(id);
        if (n) clusterPositions.set(id, { x: n.x, y: n.y });
    });

    // --- 6. MULTI-PASS COLLISION RESOLUTION ---
    // Instead of aggressively moving parents, do gentle multi-pass overlap removal
    const MIN_GAP = 40;
    const MAX_PASSES = 5;

    for (let pass = 0; pass < MAX_PASSES; pass++) {
        let hadOverlap = false;

        // Group clusters by Y level (same generation)
        const byRank = new Map<number, string[]>();
        for (const [id, pos] of clusterPositions) {
            const roundedY = Math.round(pos.y / 10) * 10; // Bucket by ~10px
            if (!byRank.has(roundedY)) byRank.set(roundedY, []);
            byRank.get(roundedY)!.push(id);
        }

        // For each generation row, resolve overlaps left-to-right
        for (const [, ids] of byRank) {
            if (ids.length < 2) continue;

            // Sort by X position
            ids.sort((a, b) => (clusterPositions.get(a)?.x ?? 0) - (clusterPositions.get(b)?.x ?? 0));

            for (let i = 0; i < ids.length - 1; i++) {
                const idA = ids[i];
                const idB = ids[i + 1];
                const posA = clusterPositions.get(idA);
                const posB = clusterPositions.get(idB);
                const clusterA = clusters.get(idA);
                const clusterB = clusters.get(idB);

                if (!posA || !posB || !clusterA || !clusterB) continue;

                const rightEdgeA = posA.x + clusterA.w / 2;
                const leftEdgeB = posB.x - clusterB.w / 2;
                const overlap = rightEdgeA + MIN_GAP - leftEdgeB;

                if (overlap > 0) {
                    hadOverlap = true;
                    // Push apart equally (each moves half)
                    const shift = overlap / 2;
                    posA.x -= shift;
                    posB.x += shift;
                    clusterPositions.set(idA, posA);
                    clusterPositions.set(idB, posB);
                }
            }
        }

        if (!hadOverlap) break; // Converged
    }

    // --- 6.5. SIBLING REORDERING POST-PROCESSING ---
    // Sort child clusters by birthDate/birthOrder (eldest left, youngest right)
    // Group children by their common parent cluster, then reassign X positions

    const processedParentClusters = new Set<string>();

    visiblePersons.forEach(person => {
        const parentClusterId = personToCluster.get(person.personId);
        if (!parentClusterId || !clustersInGraph.has(parentClusterId)) return;
        if (processedParentClusters.has(parentClusterId)) return;
        processedParentClusters.add(parentClusterId);

        // Get all visible children of this parent cluster
        const childClusterIds: string[] = [];
        const parentCluster = clusters.get(parentClusterId);
        if (!parentCluster) return;

        parentCluster.members.forEach(member => {
            member.relationships.childIds.forEach(childId => {
                if (!visibleIds.has(childId)) return;
                const childClusterId = personToCluster.get(childId);
                if (childClusterId && clustersInGraph.has(childClusterId) && !childClusterIds.includes(childClusterId)) {
                    childClusterIds.push(childClusterId);
                }
            });
        });

        if (childClusterIds.length < 2) return; // No need to reorder single child

        // Get current X positions of child clusters
        const childPositions = childClusterIds.map(id => ({
            clusterId: id,
            x: clusterPositions.get(id)?.x ?? 0
        }));

        // Get the actual X positions in sorted order (for reassignment)
        const sortedXPositions = [...childPositions].sort((a, b) => a.x - b.x).map(p => p.x);

        // Sort child clusters by birthDate/birthOrder  
        const sortedChildren = [...childClusterIds].sort((a, b) => {
            // Get representative person from each cluster (prioritize by birthDate/birthOrder)
            const clusterA = clusters.get(a);
            const clusterB = clusters.get(b);
            if (!clusterA || !clusterB) return 0;

            // Get the child members from these clusters
            const childA = clusterA.members.find(m =>
                parentCluster.members.some(p => p.relationships.childIds.includes(m.personId))
            );
            const childB = clusterB.members.find(m =>
                parentCluster.members.some(p => p.relationships.childIds.includes(m.personId))
            );

            if (!childA || !childB) return 0;

            // First priority: birthDate
            const dateA = childA.birthDate ? new Date(childA.birthDate).getTime() : Infinity;
            const dateB = childB.birthDate ? new Date(childB.birthDate).getTime() : Infinity;
            if (dateA !== Infinity && dateB !== Infinity && dateA !== dateB) {
                return dateA - dateB; // Earlier date first (elder left)
            }

            // Second priority: birthOrder
            const orderA = childA.birthOrder ?? Infinity;
            const orderB = childB.birthOrder ?? Infinity;
            if (orderA !== Infinity && orderB !== Infinity && orderA !== orderB) {
                return orderA - orderB; // Lower order first (elder left)
            }

            // If one has data and other doesn't
            if (dateA !== Infinity && dateB === Infinity) return -1;
            if (dateB !== Infinity && dateA === Infinity) return 1;
            if (orderA !== Infinity && orderB === Infinity) return -1;
            if (orderB !== Infinity && orderA === Infinity) return 1;

            return 0;
        });

        // Reassign X positions: eldest gets leftmost position, youngest gets rightmost
        sortedChildren.forEach((clusterId, index) => {
            const pos = clusterPositions.get(clusterId);
            if (pos) {
                pos.x = sortedXPositions[index];
                clusterPositions.set(clusterId, pos);
            }
        });
    });

    // --- 7. Expand to Individual Positions ---
    let currentMaxY = 0;

    clustersInGraph.forEach(clusterId => {
        const data = clusters.get(clusterId);
        const centerPos = clusterPositions.get(clusterId);
        if (!data || !centerPos) return;

        currentMaxY = Math.max(currentMaxY, centerPos.y + NODE_HEIGHT / 2);
        const startX = centerPos.x - (data.w / 2);

        data.members.forEach((member, index) => {
            const memberX = startX + (index * (NODE_WIDTH + SPOUSE_GAP));
            posMap.set(member.personId, {
                x: memberX,
                y: centerPos.y - (NODE_HEIGHT / 2)
            });
        });
    });

    // --- 8. Handle Orphans ---
    const orphansY = currentMaxY + 300;
    let orphanCurrentX = 50;

    clusters.forEach((data, id) => {
        if (!clustersInGraph.has(id)) {
            const startX = orphanCurrentX;
            data.members.forEach((member, index) => {
                const memberX = startX + (index * (NODE_WIDTH + SPOUSE_GAP));
                posMap.set(member.personId, {
                    x: memberX,
                    y: orphansY
                });
            });
            orphanCurrentX += data.w + nodeSep;
        }
    });

    // --- 9. Normalize ---
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
