import dagre from 'dagre';
import { Person } from '@/types';

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

export function calculateTreeLayout(persons: Person[], collapsedIds: Set<string> = new Set()): Map<string, NodePosition> {
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

        // SPOUSE RULE: Male left, Female right
        members.sort((a, b) => {
            if (a.gender === 'male' && b.gender !== 'male') return -1;
            if (a.gender !== 'male' && b.gender === 'male') return 1;
            return a.personId.localeCompare(b.personId);
        });

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

    // Add Edges
    const addedEdges = new Set<string>();
    visiblePersons.forEach(person => {
        const sourceCluster = personToCluster.get(person.personId);
        if (!sourceCluster || !clustersInGraph.has(sourceCluster)) return;

        person.relationships.childIds.forEach(childId => {
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
