import dagre from 'dagre';
import { Person, Relationship } from '@/types';
import { calculateMultiRootGenerations } from '@/lib/generation/calculator';

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

// Standardized layout spacing — consistent regardless of tree size
const LAYOUT_CONFIG = {
    rankSep: 100,     // Vertical gap between generations
    nodeSep: 40,      // Horizontal gap between sibling clusters
    spouseGap: 30,    // Gap between spouses in a cluster
    margin: 50,       // Canvas margin
    minGap: 25,       // Minimum gap for collision resolution
    orphanGap: 150,   // Gap before orphan section
};

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

    // P3 FIX: Pre-build relationship lookup map — O(1) instead of O(n) per lookup
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

        // P3 FIX: Use pre-built map instead of relationships.find()
        const getMarriageOrder = (personA: Person, personB: Person): number => {
            const key = [personA.personId, personB.personId].sort().join('|');
            const rel = relMap.get(key);
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

        const width = (members.length * NODE_WIDTH) + ((members.length - 1) * config.spouseGap);
        clusters.set(clusterId, { members, w: width, h: NODE_HEIGHT });
    });

    // --- 3. Build Dagre Graph ---

    const g = new dagre.graphlib.Graph();
    // Use tight-tree ranker for large trees (significantly fewer edge crossings)
    // and network-simplex for smaller trees (better centering)
    const useRanker = persons.length > 80 ? 'tight-tree' : 'network-simplex';
    g.setGraph({
        rankdir: 'TB',
        ranksep: config.rankSep,
        nodesep: config.nodeSep,
        marginx: config.margin,
        marginy: config.margin,
        ranker: useRanker,
        align: 'UL',               // Up-left alignment for better top-down centering
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

    // --- 3.5. Title-based alignment is done POST-dagre (see step 6.8) ---
    // Previously this section added heavy chain-edges between same-title persons
    // which collapsed the entire dagre layout into a single vertical column.

    // --- 4. Run Dagre Layout ---
    dagre.layout(g);

    // --- 5. Extract Positions ---
    const clusterPositions = new Map<string, { x: number, y: number }>();
    g.nodes().forEach(id => {
        const n = g.node(id);
        if (n) clusterPositions.set(id, { x: n.x, y: n.y });
    });

    // --- 5.5. GENERATION Y-NORMALIZATION ---
    // Force all same-generation clusters to the same Y row.
    // This aligns multi-root lineages (Arumpone, Soppeng) side-by-side.
    const genMap = generationMap ?? calculateMultiRootGenerations(personsMap);

    if (genMap.size > 0) {
        // Determine generation for each cluster (use representative member)
        const clusterGen = new Map<string, number>();
        clustersInGraph.forEach(clusterId => {
            const data = clusters.get(clusterId);
            if (!data) return;
            // Use the minimum generation among cluster members
            let minGen = Infinity;
            for (const member of data.members) {
                const gen = genMap.get(member.personId);
                if (gen !== undefined && gen < minGen) minGen = gen;
            }
            if (minGen !== Infinity) {
                clusterGen.set(clusterId, minGen);
            }
        });

        // Compute target Y for each generation
        const genYTarget = new Map<number, number>();
        const rowHeight = NODE_HEIGHT + config.rankSep;
        for (const gen of new Set(clusterGen.values())) {
            genYTarget.set(gen, config.margin + (gen - 1) * rowHeight);
        }

        // Override Y positions to align by generation
        for (const [clusterId, gen] of clusterGen) {
            const pos = clusterPositions.get(clusterId);
            const targetY = genYTarget.get(gen);
            if (pos && targetY !== undefined) {
                pos.y = targetY;
                clusterPositions.set(clusterId, pos);
            }
        }
    }

    // --- 6. MULTI-PASS COLLISION RESOLUTION ---
    // More passes for larger trees, dynamic gap based on tree size
    const MIN_GAP = config.minGap;
    const MAX_PASSES = persons.length > 100 ? 15 : 8;

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

    // --- 6.7. PARENT CENTERING PASS (bottom-up) ---
    // Center each parent cluster above the midpoint of its children for pyramid look.
    // Process from deepest generation upward so adjustments cascade.
    const centeringPasses = 3;
    for (let cp = 0; cp < centeringPasses; cp++) {
        const processedForCentering = new Set<string>();

        // Build parent→children map for clusters
        const parentChildClusters = new Map<string, string[]>();
        visiblePersons.forEach(person => {
            const parentClusterId = personToCluster.get(person.personId);
            if (!parentClusterId || !clustersInGraph.has(parentClusterId)) return;
            if (processedForCentering.has(parentClusterId)) return;
            processedForCentering.add(parentClusterId);

            const parentCluster = clusters.get(parentClusterId);
            if (!parentCluster) return;

            const childClusterIds: string[] = [];
            parentCluster.members.forEach(member => {
                member.relationships.childIds.forEach(childId => {
                    if (!visibleIds.has(childId)) return;
                    const childClusterId = personToCluster.get(childId);
                    if (childClusterId && clustersInGraph.has(childClusterId) && !childClusterIds.includes(childClusterId)) {
                        childClusterIds.push(childClusterId);
                    }
                });
            });

            if (childClusterIds.length > 0) {
                parentChildClusters.set(parentClusterId, childClusterIds);
            }
        });

        // Sort parent clusters by depth (deepest children first = bottom-up)
        const clusterDepths = new Map<string, number>();
        const getClusterDepth = (cid: string, visited: Set<string> = new Set()): number => {
            if (visited.has(cid)) return 0;
            visited.add(cid);
            if (clusterDepths.has(cid)) return clusterDepths.get(cid)!;
            const children = parentChildClusters.get(cid) ?? [];
            const depth = children.length > 0 ? 1 + Math.max(...children.map(c => getClusterDepth(c, visited))) : 0;
            clusterDepths.set(cid, depth);
            return depth;
        };
        for (const cid of parentChildClusters.keys()) {
            getClusterDepth(cid);
        }

        // Process from shallowest depth to deepest (leaf parents first, then up)
        const sortedParents = [...parentChildClusters.entries()]
            .sort(([a], [b]) => (clusterDepths.get(a) ?? 0) - (clusterDepths.get(b) ?? 0));

        for (const [parentCid, childCids] of sortedParents) {
            const parentPos = clusterPositions.get(parentCid);
            if (!parentPos) continue;

            // Compute center X of all children
            let sumX = 0;
            let count = 0;
            for (const childCid of childCids) {
                const childPos = clusterPositions.get(childCid);
                if (childPos) {
                    sumX += childPos.x;
                    count++;
                }
            }
            if (count === 0) continue;

            const childrenCenterX = sumX / count;
            const desiredX = childrenCenterX;

            // Only move if it doesn't cause collisions with same-rank neighbors
            const parentY = Math.round(parentPos.y / 10) * 10;
            const sameRank: string[] = [];
            for (const [cid, pos] of clusterPositions) {
                if (cid !== parentCid && Math.round(pos.y / 10) * 10 === parentY) {
                    sameRank.push(cid);
                }
            }

            // Check if desired position would overlap with neighbors
            const parentCluster = clusters.get(parentCid);
            if (!parentCluster) continue;
            const halfW = parentCluster.w / 2;
            let canMove = true;

            for (const neighborCid of sameRank) {
                const neighborPos = clusterPositions.get(neighborCid);
                const neighborCluster = clusters.get(neighborCid);
                if (!neighborPos || !neighborCluster) continue;

                const neighborHalfW = neighborCluster.w / 2;
                const distance = Math.abs(desiredX - neighborPos.x);
                if (distance < halfW + neighborHalfW + MIN_GAP) {
                    canMove = false;
                    break;
                }
            }

            if (canMove) {
                parentPos.x = desiredX;
                clusterPositions.set(parentCid, parentPos);
            }
        }
    }

    // --- 6.8. TITLE-BASED COLUMN SOFT-NUDGE ---
    // Softly nudge same-title clusters toward their group median X.
    // This creates visible vertical clustering without collapsing the layout.
    {
        const titleGroups = new Map<string, string[]>(); // titleKey → clusterIds

        clustersInGraph.forEach(clusterId => {
            const data = clusters.get(clusterId);
            if (!data) return;

            for (const member of data.members) {
                // Use reignTitle for specific titles like "Arumpone", "Soppeng"
                let key = member.reignTitle?.trim();
                if (!key && member.title && member.title !== 'other') {
                    key = member.title;
                }
                if (key) {
                    const normalizedKey = key.toLowerCase();
                    if (!titleGroups.has(normalizedKey)) {
                        titleGroups.set(normalizedKey, []);
                    }
                    const group = titleGroups.get(normalizedKey)!;
                    if (!group.includes(clusterId)) {
                        group.push(clusterId);
                    }
                    break; // Use the first member's title for the cluster
                }
            }
        });

        // For each title group with 2+ clusters, nudge toward median X
        const NUDGE_STRENGTH = 0.6; // 60% toward median (soft, avoids collapse)

        titleGroups.forEach((clusterIds) => {
            if (clusterIds.length < 2) return;

            // Compute median X of the group
            const xPositions = clusterIds
                .map(id => clusterPositions.get(id)?.x)
                .filter((x): x is number => x !== undefined)
                .sort((a, b) => a - b);

            if (xPositions.length < 2) return;
            const medianX = xPositions[Math.floor(xPositions.length / 2)];

            // Nudge each cluster toward the median
            for (const clusterId of clusterIds) {
                const pos = clusterPositions.get(clusterId);
                const clusterData = clusters.get(clusterId);
                if (!pos || !clusterData) continue;

                const desiredX = pos.x + (medianX - pos.x) * NUDGE_STRENGTH;

                // Check for collisions with same-generation neighbors
                const posY = Math.round(pos.y / 10) * 10;
                const halfW = clusterData.w / 2;
                let canMove = true;

                for (const [neighborId, neighborPos] of clusterPositions) {
                    if (neighborId === clusterId) continue;
                    if (Math.round(neighborPos.y / 10) * 10 !== posY) continue;

                    const neighborData = clusters.get(neighborId);
                    if (!neighborData) continue;

                    const neighborHalfW = neighborData.w / 2;
                    const distance = Math.abs(desiredX - neighborPos.x);
                    if (distance < halfW + neighborHalfW + MIN_GAP) {
                        canMove = false;
                        break;
                    }
                }

                if (canMove) {
                    pos.x = desiredX;
                    clusterPositions.set(clusterId, pos);
                }
            }
        });
    }

    // --- 7. Expand to Individual Positions ---
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

    // --- 8. Handle Orphans --- place in a grid instead of single row
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
