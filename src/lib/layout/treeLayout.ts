import dagre from 'dagre';
import { Person } from '@/types';

interface NodePosition {
    x: number;
    y: number;
}

// Layout Constants - INCREASED for anti-overlap
const NODE_WIDTH = 220;
const NODE_HEIGHT = 130;
const SPOUSE_GAP = 30;    // Gap between spouses in a couple
const RANK_SEP = 220;     // Vertical gap between generations (increased)
const NODE_SEP = 150;     // Horizontal gap between separate families (increased significantly)

export function calculateTreeLayout(persons: Person[], collapsedIds: Set<string> = new Set()): Map<string, NodePosition> {
    const posMap = new Map<string, NodePosition>();
    if (persons.length === 0) return posMap;

    const personsMap = new Map(persons.map(p => [p.personId, p]));

    // --- 1. Identify Visible Nodes (Pruning based on Collapse) ---
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

        // Add Spouses - ALWAYS visible if main person is visible
        p.relationships.spouseIds.forEach(sId => {
            if (personsMap.has(sId) && !processedForVisibility.has(sId)) {
                queue.push(personsMap.get(sId)!);
            }
        });

        // Add Children if NOT collapsed
        if (!collapsedIds.has(p.personId)) {
            p.relationships.childIds.forEach(cId => {
                if (personsMap.has(cId)) {
                    queue.push(personsMap.get(cId)!);
                }
            });
        }
    }

    const visiblePersons = persons.filter(p => visibleIds.has(p.personId));

    // --- 2. Cluster Spouses (KEY: Keep couples together) ---
    const personToCluster = new Map<string, string>();
    const clusters = new Map<string, { members: Person[], w: number, h: number }>();
    const sortedPersons = [...visiblePersons].sort((a, b) => a.personId.localeCompare(b.personId));

    sortedPersons.forEach(person => {
        if (personToCluster.has(person.personId)) return;

        const clusterId = `cluster-${person.personId}`;
        const members: Person[] = [person];
        personToCluster.set(person.personId, clusterId);

        // BFS to find all spouses (handles multi-spouse)
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
                    // Add their spouses too (for polygamous cases)
                    spouse.relationships.spouseIds.forEach(nextS => {
                        if (!visitedSpouses.has(nextS) && nextS !== person.personId) {
                            spouseQueue.push(nextS);
                        }
                    });
                }
            }
        }

        // SPOUSE RULE: Sort by gender (Male left, Female right), then by ID for stability
        members.sort((a, b) => {
            if (a.gender === 'male' && b.gender !== 'male') return -1;
            if (a.gender !== 'male' && b.gender === 'male') return 1;
            return a.personId.localeCompare(b.personId);
        });

        // Calculate cluster width: All members + gaps between them
        const width = (members.length * NODE_WIDTH) + ((members.length - 1) * SPOUSE_GAP);
        clusters.set(clusterId, { members, w: width, h: NODE_HEIGHT });
    });

    // --- 3. Build Dagre Graph ---
    const g = new dagre.graphlib.Graph();
    g.setGraph({
        rankdir: 'TB',     // Top to Bottom
        ranksep: RANK_SEP, // Vertical spacing between ranks
        nodesep: NODE_SEP, // Horizontal spacing between nodes in same rank
        marginx: 50,
        marginy: 50
    });
    g.setDefaultEdgeLabel(() => ({}));

    // Identify connected clusters (non-orphans)
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
            // Add node to Dagre with EXACT cluster dimensions
            g.setNode(id, { width: data.w, height: data.h });
            clustersInGraph.add(id);
        }
    });

    // Add Edges with HIGH WEIGHT for vertical alignment
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
                // High weight forces more vertical alignment
                g.setEdge(sourceCluster, targetCluster, { weight: 100, minlen: 1 });
                addedEdges.add(edgeKey);
            }
        });
    });

    // --- 4. Run Dagre Layout ---
    dagre.layout(g);

    // --- 5. Extract Positions & Expand Clusters ---
    const clusterPositions = new Map<string, { x: number, y: number }>();
    g.nodes().forEach(id => {
        const n = g.node(id);
        if (n) clusterPositions.set(id, { x: n.x, y: n.y });
    });

    // NOTE: Removed aggressive Vertical Snap as it causes overlap
    // Dagre's layout with high-weight edges should handle alignment naturally
    // If single-parent alignment is still needed, we can add collision-safe snap later

    let currentMaxY = 0;

    // Expand clusters to individual person positions
    clustersInGraph.forEach(clusterId => {
        const data = clusters.get(clusterId);
        const centerPos = clusterPositions.get(clusterId);
        if (!data || !centerPos) return;

        currentMaxY = Math.max(currentMaxY, centerPos.y + NODE_HEIGHT / 2);

        // Calculate starting X for leftmost member
        const startX = centerPos.x - (data.w / 2);

        data.members.forEach((member, index) => {
            // Position each member in the cluster
            const memberX = startX + (index * (NODE_WIDTH + SPOUSE_GAP));
            posMap.set(member.personId, {
                x: memberX,
                y: centerPos.y - (NODE_HEIGHT / 2)
            });
        });
    });

    // --- 6. Handle Orphans (Place at Bottom) ---
    const orphansY = currentMaxY + 300; // Well below main tree
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

    // --- 7. Normalize to start at (50, 50) ---
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
