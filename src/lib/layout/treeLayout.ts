import dagre from 'dagre';
import { Person, Relationship } from '@/types';

interface NodePosition {
    x: number;
    y: number;
}

// Layout Constants - REDUCED for compact view
const NODE_WIDTH = 220;
const NODE_HEIGHT = 130;
const SPOUSE_GAP = 25;    // Gap between spouses
const RANK_SEP = 160;     // Vertical gap (was 220)
const NODE_SEP = 80;      // Horizontal gap (was 150)

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
    const g = new dagre.graphlib.Graph();
    g.setGraph({
        rankdir: 'TB',
        ranksep: RANK_SEP,
        nodesep: NODE_SEP,
        marginx: 50,
        marginy: 50
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
                g.setEdge(sourceCluster, targetCluster, { weight: 100, minlen: 1 });
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

    // --- 6. PARENT SIDE ALIGNMENT POST-PROCESSING ---
    // For each couple (cluster with 2+ members), check each member's parents
    // and position parent cluster to align with that member's side in the couple
    // WITH PUSH-APART COLLISION RESOLUTION

    const MIN_GAP = 60; // Minimum gap between clusters

    // Helper: Calculate overlap amount between two clusters at same Y level
    const getOverlapAmount = (clusterId1: string, x1: number, clusterId2: string): number => {
        if (clusterId1 === clusterId2) return 0;

        const cluster1 = clusters.get(clusterId1);
        const pos2 = clusterPositions.get(clusterId2);
        const cluster2 = clusters.get(clusterId2);

        if (!cluster1 || !pos2 || !cluster2) return 0;

        // Check Y level - only care about same generation
        const pos1 = clusterPositions.get(clusterId1);
        if (!pos1 || Math.abs(pos1.y - pos2.y) > 10) return 0;

        // Calculate bounding boxes
        const left1 = x1 - cluster1.w / 2;
        const right1 = x1 + cluster1.w / 2;
        const left2 = pos2.x - cluster2.w / 2;
        const right2 = pos2.x + cluster2.w / 2;

        // Check for overlap
        if (right1 + MIN_GAP < left2 || right2 + MIN_GAP < left1) {
            return 0; // No overlap
        }

        // Calculate overlap amount
        if (x1 < pos2.x) {
            // cluster1 is on left, needs to push cluster2 right
            return (right1 + MIN_GAP) - left2;
        } else {
            // cluster1 is on right, needs to push cluster2 left
            return (right2 + MIN_GAP) - left1;
        }
    };

    clusters.forEach((data, clusterId) => {
        if (!clustersInGraph.has(clusterId)) return;
        if (data.members.length < 2) return; // Only process actual couples

        const clusterPos = clusterPositions.get(clusterId);
        if (!clusterPos) return;

        data.members.forEach((member, memberIndex) => {
            // Calculate member's center X within the cluster
            const memberCenterX = clusterPos.x - (data.w / 2) +
                (memberIndex * (NODE_WIDTH + SPOUSE_GAP)) +
                (NODE_WIDTH / 2);

            // Find this member's parents that have a cluster in the graph
            member.relationships.parentIds.forEach(parentId => {
                const parentClusterId = personToCluster.get(parentId);
                if (!parentClusterId || !clustersInGraph.has(parentClusterId)) return;

                const parentClusterPos = clusterPositions.get(parentClusterId);
                if (!parentClusterPos) return;

                // Check if parent cluster is actually ABOVE this cluster
                if (parentClusterPos.y >= clusterPos.y) return;

                const parentCluster = clusters.get(parentClusterId);
                if (!parentCluster) return;

                // Check how many child clusters this parent cluster connects to
                let childClusterCount = 0;
                parentCluster.members.forEach(pm => {
                    pm.relationships.childIds.forEach(pcid => {
                        const childCluster = personToCluster.get(pcid);
                        if (childCluster && clustersInGraph.has(childCluster)) {
                            childClusterCount++;
                        }
                    });
                });

                // Only attempt alignment if parent has few child connections
                if (childClusterCount <= 2) {
                    // First, move parent to target position
                    parentClusterPos.x = memberCenterX;
                    clusterPositions.set(parentClusterId, parentClusterPos);

                    // Then, push apart any colliding clusters
                    for (const [otherClusterId, otherPos] of clusterPositions) {
                        if (otherClusterId === parentClusterId) continue;

                        const overlap = getOverlapAmount(parentClusterId, memberCenterX, otherClusterId);
                        if (overlap > 0) {
                            // Push the other cluster away
                            if (otherPos.x > memberCenterX) {
                                // Other is on right, push it further right
                                otherPos.x += overlap;
                            } else {
                                // Other is on left, push it further left
                                otherPos.x -= overlap;
                            }
                            clusterPositions.set(otherClusterId, otherPos);
                        }
                    }
                }
            });
        });
    });

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
            orphanCurrentX += data.w + NODE_SEP;
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
