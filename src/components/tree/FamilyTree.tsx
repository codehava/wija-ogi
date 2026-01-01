// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Family Tree Component
// Professional tree layout using dagre algorithm
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import dagre from 'dagre';
import domtoimage from 'dom-to-image-more';
import jsPDF from 'jspdf';
import { Person, Relationship, ScriptMode } from '@/types';
import { findRootAncestor } from '@/lib/generation/calculator';

export interface FamilyTreeProps {
    persons: Person[];
    relationships: Relationship[];
    scriptMode?: ScriptMode;
    onPersonClick?: (person: Person) => void;
    selectedPersonId?: string | null;
    editable?: boolean;
    onAddPerson?: () => void;
    familyName?: string;
}

// Layout constants
const NODE_WIDTH = 200;
const NODE_HEIGHT = 120;

interface NodePosition {
    x: number;
    y: number;
}

// Calculate layout using dagre
function calculateDagreLayout(persons: Person[]): Map<string, NodePosition> {
    const posMap = new Map<string, NodePosition>();

    if (persons.length === 0) return posMap;

    // Create a new dagre graph
    const g = new dagre.graphlib.Graph();

    // Set graph options for top-to-bottom tree layout with tighter spacing
    g.setGraph({
        rankdir: 'TB',      // Top to Bottom
        nodesep: 30,        // Tighter horizontal separation
        ranksep: 80,        // Vertical separation between generations
        marginx: 40,
        marginy: 40,
        align: 'UL',
        acyclicer: 'greedy',
        ranker: 'tight-tree'  // Use tight-tree for better family grouping
    });

    // Default edge label
    g.setDefaultEdgeLabel(() => ({ weight: 1, minlen: 1 }));

    // Add all persons as nodes
    persons.forEach(person => {
        g.setNode(person.personId, {
            label: person.fullName || person.firstName,
            width: NODE_WIDTH,
            height: NODE_HEIGHT
        });
    });

    // Add edges - both parent-child AND spouse connections
    const addedEdges = new Set<string>();

    persons.forEach(person => {
        // Add spouse edges with high weight to keep couples together
        person.relationships.spouseIds.forEach(spouseId => {
            const edgeKey = [person.personId, spouseId].sort().join('-spouse-');
            if (!addedEdges.has(edgeKey) && persons.some(p => p.personId === spouseId)) {
                // Don't add as edge, just for grouping awareness
                addedEdges.add(edgeKey);
            }
        });

        // Add parent->child edges
        person.relationships.childIds.forEach(childId => {
            const edgeKey = `${person.personId}->${childId}`;
            if (!addedEdges.has(edgeKey) && persons.some(p => p.personId === childId)) {
                g.setEdge(person.personId, childId, { weight: 2, minlen: 1 });
                addedEdges.add(edgeKey);
            }
        });
    });

    // Run the dagre layout algorithm
    dagre.layout(g);

    // Extract positions
    g.nodes().forEach(nodeId => {
        const node = g.node(nodeId);
        if (node) {
            posMap.set(nodeId, {
                x: node.x - NODE_WIDTH / 2,
                y: node.y - NODE_HEIGHT / 2
            });
        }
    });

    // Post-process: Position spouses next to each other on same Y level
    // Male on the left, Female on the right
    const processedSpouses = new Set<string>();
    persons.forEach(person => {
        if (person.relationships.spouseIds.length === 0) return;
        if (processedSpouses.has(person.personId)) return;

        const personPos = posMap.get(person.personId);
        if (!personPos) return;

        person.relationships.spouseIds.forEach(spouseId => {
            if (processedSpouses.has(spouseId)) return;

            const spouse = persons.find(p => p.personId === spouseId);
            if (!spouse) return;

            const spousePos = posMap.get(spouseId);
            if (!spousePos) return;

            const gap = 20;

            // Determine which person should be on the left (male) and right (female)
            // If person is female and spouse is male, swap positions
            if (person.gender === 'female' && spouse.gender === 'male') {
                // Male (spouse) should be on the left, Female (person) on the right
                const leftX = Math.min(personPos.x, spousePos.x);
                posMap.set(spouseId, {
                    x: leftX,
                    y: personPos.y
                });
                posMap.set(person.personId, {
                    x: leftX + NODE_WIDTH + gap,
                    y: personPos.y
                });
            } else {
                // Default: person on left, spouse on right (works for male-female, same gender, or unknown)
                posMap.set(spouseId, {
                    x: personPos.x + NODE_WIDTH + gap,
                    y: personPos.y
                });
            }

            processedSpouses.add(spouseId);
        });

        processedSpouses.add(person.personId);
    });

    // Post-process: Center children under their parents, sorted by birth date (oldest first on left)
    // Track processed parent groups to avoid duplicate processing
    const processedParentGroups = new Set<string>();

    persons.forEach(person => {
        if (person.relationships.childIds.length === 0) return;

        // Create a unique key for this parent group (single parent or couple)
        const parentGroupKey = person.relationships.spouseIds.length > 0
            ? [person.personId, ...person.relationships.spouseIds].sort().join('-')
            : person.personId;

        // Skip if already processed this parent group
        if (processedParentGroups.has(parentGroupKey)) return;
        processedParentGroups.add(parentGroupKey);

        const parentPos = posMap.get(person.personId);
        if (!parentPos) return;

        // Get spouse position if exists
        let coupleCenter = parentPos.x + NODE_WIDTH / 2;
        if (person.relationships.spouseIds.length > 0) {
            const spousePos = posMap.get(person.relationships.spouseIds[0]);
            if (spousePos) {
                coupleCenter = (parentPos.x + spousePos.x + NODE_WIDTH) / 2;
            }
        }

        // Get children with their Person data for birth date sorting
        const childrenWithData = person.relationships.childIds
            .map(id => {
                const childPerson = persons.find(p => p.personId === id);
                return {
                    id,
                    pos: posMap.get(id),
                    birthDate: childPerson?.birthDate || null
                };
            })
            .filter(c => c.pos !== undefined);

        if (childrenWithData.length === 0) return;

        // Sort children by birth date (oldest first = earliest date = left side)
        // Children without birthDate go to the end (right side)
        childrenWithData.sort((a, b) => {
            // Both have no date - keep original order
            if (!a.birthDate && !b.birthDate) return 0;
            // No date goes to the end (right side)
            if (!a.birthDate) return 1;
            if (!b.birthDate) return -1;
            // Compare dates - earlier date (older) should come first (left)
            // Date format is YYYY-MM-DD, so string comparison works
            if (a.birthDate < b.birthDate) return -1;
            if (a.birthDate > b.birthDate) return 1;
            return 0;
        });

        // Get sorted X positions from smallest to largest (left to right)
        const sortedXPositions = childrenWithData
            .map(c => c.pos!.x)
            .sort((a, b) => a - b);

        // Assign positions based on sorted order (oldest gets leftmost position)
        childrenWithData.forEach((child, index) => {
            const pos = posMap.get(child.id);
            if (pos) {
                posMap.set(child.id, { x: sortedXPositions[index], y: pos.y });
            }
        });

        // Calculate new children center after reordering
        const childrenMinX = Math.min(...childrenWithData.map(c => posMap.get(c.id)!.x));
        const childrenMaxX = Math.max(...childrenWithData.map(c => posMap.get(c.id)!.x + NODE_WIDTH));
        const childrenCenter = (childrenMinX + childrenMaxX) / 2;

        // Shift children to center under parents
        const shift = coupleCenter - childrenCenter;
        childrenWithData.forEach(child => {
            const pos = posMap.get(child.id);
            if (pos) {
                posMap.set(child.id, { x: pos.x + shift, y: pos.y });
            }
        });
    });

    // Post-process: Resolve collisions - ensure no overlapping nodes
    const resolveCollisions = () => {
        const padding = 15; // Minimum gap between nodes
        const allNodes = Array.from(posMap.entries()).map(([id, pos]) => ({
            id,
            x: pos.x,
            y: pos.y,
            width: NODE_WIDTH,
            height: NODE_HEIGHT
        }));

        // Group nodes by Y level (same generation)
        const byLevel = new Map<number, typeof allNodes>();
        allNodes.forEach(node => {
            const levelKey = Math.round(node.y / 20) * 20; // Group by ~20px bands
            if (!byLevel.has(levelKey)) byLevel.set(levelKey, []);
            byLevel.get(levelKey)!.push(node);
        });

        // For each level, sort by X and resolve horizontal overlaps
        byLevel.forEach(nodes => {
            nodes.sort((a, b) => a.x - b.x);

            for (let i = 1; i < nodes.length; i++) {
                const prev = nodes[i - 1];
                const curr = nodes[i];

                const minX = prev.x + prev.width + padding;
                if (curr.x < minX) {
                    // Push current node to the right
                    const shift = minX - curr.x;
                    curr.x = minX;
                    posMap.set(curr.id, { x: curr.x, y: curr.y });
                }
            }
        });
    };

    // Run collision resolution multiple times to handle cascading shifts
    for (let i = 0; i < 3; i++) {
        resolveCollisions();
    }

    // FINAL PASS: Sort children by birth date AFTER all collision resolution
    // This ensures children are properly ordered: oldest (left) to youngest (right)
    const processedFinalGroups = new Set<string>();

    persons.forEach(person => {
        if (person.relationships.childIds.length === 0) return;

        // Create unique key for parent group
        const groupKey = person.relationships.spouseIds.length > 0
            ? [person.personId, ...person.relationships.spouseIds].sort().join('-')
            : person.personId;

        if (processedFinalGroups.has(groupKey)) return;
        processedFinalGroups.add(groupKey);

        // Get children with birth dates
        const childrenData = person.relationships.childIds
            .map(id => {
                const child = persons.find(p => p.personId === id);
                const pos = posMap.get(id);
                return {
                    id,
                    pos,
                    birthDate: child?.birthDate || ''
                };
            })
            .filter(c => c.pos !== undefined);

        if (childrenData.length < 2) return; // No need to sort if 0 or 1 child

        // Sort by birth date: oldest first (earliest date = smaller string)
        // Empty birthDate goes to end
        const sortedChildren = [...childrenData].sort((a, b) => {
            if (!a.birthDate && !b.birthDate) return 0;
            if (!a.birthDate) return 1;
            if (!b.birthDate) return -1;
            return a.birthDate.localeCompare(b.birthDate);
        });

        // Get current X positions sorted left to right
        const xPositions = childrenData
            .map(c => c.pos!.x)
            .sort((a, b) => a - b);

        // Assign X positions to children in birth date order
        sortedChildren.forEach((child, index) => {
            const currentPos = posMap.get(child.id);
            if (currentPos) {
                posMap.set(child.id, { x: xPositions[index], y: currentPos.y });
            }
        });
    });

    return posMap;
}

export function FamilyTree({
    persons,
    relationships,
    scriptMode = 'both',
    onPersonClick,
    selectedPersonId,
    editable = false,
    onAddPerson,
    familyName = 'Pohon Keluarga'
}: FamilyTreeProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });

    // Node positions (can be dragged)
    const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(new Map());

    // Dragging state
    const [draggingNode, setDraggingNode] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Canvas panning
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    // Build persons map
    const personsMap = useMemo(() => {
        const map = new Map<string, Person>();
        persons.forEach(p => map.set(p.personId, p));
        return map;
    }, [persons]);

    // Calculate initial positions using dagre
    const initialPositions = useMemo(() => {
        return calculateDagreLayout(persons);
    }, [persons]);

    // Initialize positions on first load
    useEffect(() => {
        if (nodePositions.size === 0 && initialPositions.size > 0) {
            setNodePositions(new Map(initialPositions));
        }
    }, [initialPositions, nodePositions.size]);

    // Update positions when persons change (add new persons)
    useEffect(() => {
        setNodePositions(prev => {
            const newMap = new Map(prev);
            let hasChange = false;
            persons.forEach(p => {
                if (!newMap.has(p.personId)) {
                    const initialPos = initialPositions.get(p.personId);
                    if (initialPos) {
                        newMap.set(p.personId, initialPos);
                        hasChange = true;
                    }
                }
            });
            return hasChange ? newMap : prev;
        });
    }, [persons, initialPositions]);

    // Get current positions
    const positions = useMemo(() => {
        if (nodePositions.size > 0) return nodePositions;
        return initialPositions;
    }, [nodePositions, initialPositions]);

    // Calculate connections based on current positions
    const connections = useMemo(() => {
        const connLines: Array<{ id: string; d: string; color: string; type: 'spouse' | 'parent-child' | 'vertical-drop' }> = [];
        const drawnPairs = new Set<string>();
        const coupleConnectors = new Map<string, { centerX: number; y: number }>();

        // First pass: Draw spouse connections and store connector points
        persons.forEach(person => {
            const pos1 = positions.get(person.personId);
            if (!pos1) return;

            person.relationships.spouseIds.forEach(spouseId => {
                const key = [person.personId, spouseId].sort().join('-spouse-');
                if (drawnPairs.has(key)) return;
                drawnPairs.add(key);

                const pos2 = positions.get(spouseId);
                if (!pos2) return;

                // Get actual edge points for both nodes (handle different Y positions)
                const leftPos = pos1.x < pos2.x ? pos1 : pos2;
                const rightPos = pos1.x < pos2.x ? pos2 : pos1;

                // Calculate connection points on node edges
                const y1 = leftPos.y + NODE_HEIGHT / 2;  // Right edge center of left node
                const y2 = rightPos.y + NODE_HEIGHT / 2; // Left edge center of right node
                const x1 = leftPos.x + NODE_WIDTH;       // Right edge of left node
                const x2 = rightPos.x;                    // Left edge of right node

                const gap = x2 - x1;
                const centerX = (x1 + x2) / 2;
                const centerY = (y1 + y2) / 2;

                // Control points for smooth bezier curve
                const controlOffset = Math.max(gap * 0.3, 20);

                // Draw spouse bezier line (smooth curve connecting both nodes)
                connLines.push({
                    id: `spouse-${key}`,
                    d: `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`,
                    color: '#f472b6',
                    type: 'spouse'
                });

                // Store center point for child connections
                const coupleKey = [person.personId, spouseId].sort().join('-');
                coupleConnectors.set(coupleKey, { centerX, y: centerY });
            });
        });

        // Second pass: Draw parent-child connections
        const childrenByParents = new Map<string, string[]>();

        // Group children by parent couple/single parent
        persons.forEach(person => {
            person.relationships.childIds.forEach(childId => {
                // Create parent key (sorted for couples)
                let parentKey = person.personId;
                if (person.relationships.spouseIds.length > 0) {
                    parentKey = [person.personId, ...person.relationships.spouseIds].sort().join('-');
                }

                if (!childrenByParents.has(parentKey)) {
                    childrenByParents.set(parentKey, []);
                }
                const children = childrenByParents.get(parentKey)!;
                if (!children.includes(childId)) {
                    children.push(childId);
                }
            });
        });

        // Draw connections for each parent group
        childrenByParents.forEach((childIds, parentKey) => {
            const parentIds = parentKey.split('-');
            const firstParent = personsMap.get(parentIds[0]);
            if (!firstParent) return;

            const pos1 = positions.get(parentIds[0]);
            if (!pos1) return;

            // Find connector point (from spouse line or parent center)
            let dropX: number;
            let dropStartY: number;

            if (parentIds.length > 1) {
                // Has spouse - drop from spouse line center
                const coupleKey = parentIds.slice(0, 2).sort().join('-');
                const connector = coupleConnectors.get(coupleKey);
                if (connector) {
                    dropX = connector.centerX;
                    dropStartY = connector.y;
                } else {
                    dropX = pos1.x + NODE_WIDTH / 2;
                    dropStartY = pos1.y + NODE_HEIGHT / 2;
                }
            } else {
                // Single parent - drop from bottom center
                dropX = pos1.x + NODE_WIDTH / 2;
                dropStartY = pos1.y + NODE_HEIGHT;
            }

            // Get valid children positions
            const validChildren = childIds
                .map(id => ({ id, pos: positions.get(id) }))
                .filter(c => c.pos !== undefined)
                .sort((a, b) => a.pos!.x - b.pos!.x);

            if (validChildren.length === 0) return;

            // Calculate horizontal line Y position (midway between parents and children)
            const childTopY = Math.min(...validChildren.map(c => c.pos!.y));
            const midY = dropStartY + (childTopY - dropStartY) * 0.5;

            // For each child, draw a smooth bezier curve from parent drop point
            validChildren.forEach(child => {
                const childCenterX = child.pos!.x + NODE_WIDTH / 2;
                const childTop = child.pos!.y;

                // Create smooth S-curve using cubic bezier
                // Control points make the curve flow smoothly
                const controlY1 = dropStartY + (childTop - dropStartY) * 0.4;
                const controlY2 = dropStartY + (childTop - dropStartY) * 0.6;

                connLines.push({
                    id: `child-curve-${child.id}`,
                    d: `M ${dropX} ${dropStartY} C ${dropX} ${controlY1}, ${childCenterX} ${controlY2}, ${childCenterX} ${childTop}`,
                    color: '#78716c',
                    type: 'parent-child'
                });
            });
        });

        return connLines;
    }, [persons, positions, personsMap]);

    // Canvas size
    const canvasSize = useMemo(() => {
        let maxX = 800, maxY = 500;
        positions.forEach(pos => {
            maxX = Math.max(maxX, pos.x + NODE_WIDTH + 100);
            maxY = Math.max(maxY, pos.y + NODE_HEIGHT + 100);
        });
        return { width: maxX, height: maxY };
    }, [positions]);

    // Node drag handlers
    const handleNodeMouseDown = useCallback((e: React.MouseEvent, personId: string) => {
        e.stopPropagation();
        const pos = positions.get(personId);
        if (!pos) return;

        setDraggingNode(personId);
        setDragOffset({
            x: e.clientX / zoom - pos.x,
            y: e.clientY / zoom - pos.y
        });
    }, [positions, zoom]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (draggingNode) {
            const newX = e.clientX / zoom - dragOffset.x;
            const newY = e.clientY / zoom - dragOffset.y;

            setNodePositions(prev => {
                const newMap = new Map(prev);
                newMap.set(draggingNode, { x: Math.max(0, newX), y: Math.max(0, newY) });
                return newMap;
            });
        } else if (isPanning) {
            setPan({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
            });
        }
    }, [draggingNode, dragOffset, zoom, isPanning, panStart]);

    const handleMouseUp = useCallback(() => {
        setDraggingNode(null);
        setIsPanning(false);
    }, []);

    const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        // Don't start panning if clicking on a node, button, or control element
        if (target.closest('.tree-node') ||
            target.closest('button') ||
            target.tagName === 'BUTTON' ||
            target.closest('.controls-panel')) {
            return;
        }
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }, [pan]);

    // Zoom controls
    const handleZoomIn = () => setZoom(z => Math.min(z + 0.15, 2));
    const handleZoomOut = () => setZoom(z => Math.max(z - 0.15, 0.4));
    const handleZoomReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

    // Auto arrange using dagre
    const handleAutoArrange = useCallback(() => {
        const newPositions = calculateDagreLayout(persons);
        setNodePositions(new Map(newPositions));
        setPan({ x: 0, y: 0 });
    }, [persons]);

    // Direct PDF Export handler - using native SVG generation
    const [isExporting, setIsExporting] = useState(false);

    const handleExportPDF = useCallback(async () => {
        if (isExporting || persons.length === 0) return;

        setIsExporting(true);

        try {
            // Calculate canvas bounds
            let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
            positions.forEach(pos => {
                minX = Math.min(minX, pos.x);
                minY = Math.min(minY, pos.y);
                maxX = Math.max(maxX, pos.x + NODE_WIDTH);
                maxY = Math.max(maxY, pos.y + NODE_HEIGHT);
            });

            // Add padding
            const padding = 40;
            minX -= padding;
            minY -= padding;
            maxX += padding;
            maxY += padding;

            const svgWidth = maxX - minX;
            const svgHeight = maxY - minY;

            // Build SVG string
            let svgContent = `
                <svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="${minX} ${minY} ${svgWidth} ${svgHeight}">
                <style>
                    .node-male { fill: #dbeafe; stroke: #60a5fa; stroke-width: 2; }
                    .node-female { fill: #fce7f3; stroke: #f472b6; stroke-width: 2; }
                    .node-other { fill: #f3e8ff; stroke: #a855f7; stroke-width: 2; }
                    .name-text { font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; fill: #1c1917; }
                    .lontara-text { font-family: 'Noto Sans Buginese', serif; font-size: 11px; fill: #92400e; }
                    .connector { fill: none; stroke-width: 2; stroke-linecap: round; }
                    .spouse-line { stroke: #f472b6; stroke-width: 3; }
                    .child-line { stroke: #78716c; }
                </style>
                <rect x="${minX}" y="${minY}" width="${svgWidth}" height="${svgHeight}" fill="white"/>
            `;

            // Draw connections first (behind nodes)
            connections.forEach(conn => {
                const strokeClass = conn.type === 'spouse' ? 'spouse-line' : 'child-line';
                svgContent += `<path class="connector ${strokeClass}" d="${conn.d}"/>`;
            });

            // Draw nodes
            persons.forEach(person => {
                const pos = positions.get(person.personId);
                if (!pos) return;

                const nodeClass = person.gender === 'female' ? 'node-female' :
                    person.gender === 'male' ? 'node-male' : 'node-other';
                const displayName = person.fullName || person.firstName;
                const rx = 12; // Rounded corners

                // Node rectangle
                svgContent += `<rect class="${nodeClass}" x="${pos.x}" y="${pos.y}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="${rx}"/>`;

                // Icon circle
                const iconFill = person.gender === 'female' ? '#ec4899' :
                    person.gender === 'male' ? '#3b82f6' : '#a855f7';
                svgContent += `<circle cx="${pos.x + 30}" cy="${pos.y + NODE_HEIGHT / 2}" r="20" fill="${iconFill}"/>`;

                // Gender emoji (as text)
                const emoji = person.gender === 'female' ? '👩' : person.gender === 'male' ? '👨' : '👤';
                svgContent += `<text x="${pos.x + 30}" y="${pos.y + NODE_HEIGHT / 2 + 6}" text-anchor="middle" font-size="18">${emoji}</text>`;

                // Name text - wrap if too long
                const textX = pos.x + 55;
                const textY = pos.y + 35;
                const maxWidth = NODE_WIDTH - 60;

                // Split name into lines if needed
                const words = displayName.split(' ');
                let lines: string[] = [];
                let currentLine = '';

                words.forEach(word => {
                    const testLine = currentLine ? `${currentLine} ${word}` : word;
                    if (testLine.length > 12 && currentLine) {
                        lines.push(currentLine);
                        currentLine = word;
                    } else {
                        currentLine = testLine;
                    }
                });
                if (currentLine) lines.push(currentLine);

                // Limit to 2 lines
                lines = lines.slice(0, 2);

                lines.forEach((line, i) => {
                    svgContent += `<text class="name-text" x="${textX}" y="${textY + i * 16}">${escapeXml(line)}</text>`;
                });

                // Lontara text
                if ((scriptMode === 'lontara' || scriptMode === 'both') && person.lontaraName?.first) {
                    const lontaraY = textY + lines.length * 16 + 2;
                    svgContent += `<text class="lontara-text" x="${textX}" y="${lontaraY}">${escapeXml(person.lontaraName.first)}</text>`;
                }
            });

            svgContent += '</svg>';

            // Helper function to escape XML
            function escapeXml(str: string): string {
                return str
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&apos;');
            }

            // Convert SVG to image
            const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
            const svgUrl = URL.createObjectURL(svgBlob);

            const img = new Image();
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = reject;
                img.src = svgUrl;
            });

            // Draw to canvas
            const scale = 2; // High quality
            const canvas = document.createElement('canvas');
            canvas.width = svgWidth * scale;
            canvas.height = svgHeight * scale;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');

            ctx.scale(scale, scale);
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, svgWidth, svgHeight);
            ctx.drawImage(img, 0, 0);

            URL.revokeObjectURL(svgUrl);

            // Create PDF
            const imgData = canvas.toDataURL('image/png');
            const aspectRatio = svgWidth / svgHeight;

            let pdfWidth: number, pdfHeight: number;
            if (aspectRatio > 1.4) {
                pdfWidth = 297;
                pdfHeight = 210;
            } else {
                pdfWidth = 210;
                pdfHeight = 297;
            }

            const marginTop = 20;
            const marginBottom = 15;
            const marginSide = 10;
            const availableWidth = pdfWidth - (marginSide * 2);
            const availableHeight = pdfHeight - marginTop - marginBottom;

            const ratio = Math.min(availableWidth / svgWidth, availableHeight / svgHeight);
            const finalWidth = svgWidth * ratio;
            const finalHeight = svgHeight * ratio;

            const xOffset = (pdfWidth - finalWidth) / 2;
            const yOffset = marginTop + (availableHeight - finalHeight) / 2;

            const pdf = new jsPDF({
                orientation: aspectRatio > 1.4 ? 'landscape' : 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            // Title - Family Name
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text(familyName, pdfWidth / 2, 12, { align: 'center' });

            // Subtitle
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(100, 100, 100);
            pdf.text('Pohon Keluarga', pdfWidth / 2, 18, { align: 'center' });
            pdf.setTextColor(0, 0, 0);

            // Tree image
            pdf.addImage(imgData, 'PNG', xOffset, yOffset + 5, finalWidth, finalHeight);

            // Footer
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            const createdDate = new Date().toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            pdf.text(`Created by WIJA apps • ${createdDate}`, pdfWidth / 2, pdfHeight - 5, { align: 'center' });

            // Save with family name in filename
            const safeName = familyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
            const timestamp = new Date().toISOString().slice(0, 10);
            pdf.save(`${safeName}-${timestamp}.pdf`);

        } catch (error) {
            console.error('PDF export error:', error);
            alert('Gagal mengexport PDF. Silakan coba lagi.');
        } finally {
            setIsExporting(false);
        }
    }, [isExporting, positions, persons, connections, scriptMode, familyName]);

    // Empty state
    if (persons.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-96 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl border-2 border-dashed border-teal-300">
                <div className="text-6xl mb-4">🌱</div>
                <h3 className="text-lg font-semibold text-stone-700 mb-2">Pohon Keluarga Kosong</h3>
                <p className="text-stone-500 mb-4 text-center">Mulai dengan menambahkan leluhur pertama</p>
                {onAddPerson && (
                    <button onClick={onAddPerson} className="px-6 py-3 bg-teal-500 text-white rounded-xl font-medium hover:bg-teal-600 transition shadow-lg">
                        ➕ Tambah Leluhur
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="relative h-full bg-gradient-to-br from-stone-100 to-stone-50 overflow-hidden">
            {/* Controls */}
            <div
                className="controls-panel absolute top-4 right-4 z-30 flex gap-1.5 bg-white rounded-lg shadow p-1.5 border border-stone-200 print:hidden"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
                <button onClick={handleZoomIn} className="w-8 h-8 flex items-center justify-center hover:bg-stone-100 rounded text-stone-600 font-bold" title="Zoom in">+</button>
                <button onClick={handleZoomOut} className="w-8 h-8 flex items-center justify-center hover:bg-stone-100 rounded text-stone-600 font-bold" title="Zoom out">−</button>
                <button onClick={handleZoomReset} className="w-8 h-8 flex items-center justify-center hover:bg-stone-100 rounded text-stone-600" title="Reset view">↺</button>
                <div className="w-px bg-stone-200 mx-0.5"></div>
                {/* Direct PDF Export Button */}
                <button
                    type="button"
                    onClick={handleExportPDF}
                    disabled={isExporting}
                    className={`px-3 h-8 flex items-center justify-center gap-1 rounded text-sm font-medium border cursor-pointer select-none transition-colors ${isExporting
                        ? 'bg-blue-100 text-blue-400 border-blue-200 cursor-wait'
                        : 'hover:bg-blue-50 text-blue-600 border-blue-200'
                        }`}
                    title="Export ke file PDF"
                >
                    {isExporting ? '⏳' : '📥'} PDF
                </button>
                <div className="w-px bg-stone-200 mx-0.5"></div>
                <button
                    onClick={handleAutoArrange}
                    className="px-3 h-8 flex items-center justify-center gap-1 hover:bg-teal-50 rounded text-teal-600 text-sm font-medium border border-teal-200"
                    title="Auto rapikan layout"
                    type="button"
                >
                    ✨ Rapikan
                </button>
            </div>

            {/* Add Button */}
            {editable && onAddPerson && (
                <div className="absolute top-4 left-4 z-30">
                    <button onClick={onAddPerson} className="px-4 py-2 bg-teal-500 text-white rounded-lg shadow-lg flex items-center gap-2 hover:bg-teal-600 transition text-sm font-medium">
                        <span className="text-lg leading-none">+</span>
                        <span>Tambah Anggota</span>
                    </button>
                </div>
            )}

            {/* Info */}
            <div className="absolute bottom-4 left-4 z-30 text-xs bg-white/90 px-3 py-2 rounded-lg shadow border border-stone-200">
                <div className="text-stone-600 font-medium">{Math.round(zoom * 100)}%</div>
                <div className="text-stone-400">Drag node = geser • Drag canvas = pan</div>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 right-4 z-30 text-xs bg-white/90 px-3 py-2 rounded-lg shadow border border-stone-200">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                        <div className="w-4 h-0.5 bg-pink-400"></div>
                        <span className="text-stone-500">Pasangan</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-4 h-0.5 bg-stone-400"></div>
                        <span className="text-stone-500">Orang tua-Anak</span>
                    </div>
                </div>
            </div>

            {/* Canvas */}
            <div
                ref={containerRef}
                className={`w-full h-full ${isPanning ? 'cursor-grabbing' : draggingNode ? 'cursor-move' : 'cursor-grab'}`}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <div
                    className="tree-content"
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: 'top left',
                        width: canvasSize.width,
                        height: canvasSize.height,
                        position: 'relative',
                        backgroundColor: '#ffffff'
                    }}
                >
                    {/* SVG Connectors */}
                    <svg className="absolute inset-0 pointer-events-none" width={canvasSize.width} height={canvasSize.height}>
                        <defs>
                            <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                                <polygon points="0 0, 6 2, 0 4" fill="#78716c" />
                            </marker>
                        </defs>
                        {connections.map(conn => (
                            <path
                                key={conn.id}
                                d={conn.d}
                                fill="none"
                                stroke={conn.color}
                                strokeWidth={conn.type === 'spouse' ? 3 : 2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeDasharray={conn.type === 'spouse' ? '0' : '0'}
                            />
                        ))}
                    </svg>

                    {/* Person Nodes */}
                    {persons.map(person => {
                        const pos = positions.get(person.personId);
                        if (!pos) return null;

                        const genderStyles = {
                            male: { bg: 'bg-gradient-to-br from-blue-50 to-blue-100', border: 'border-blue-400', icon: '👨', accent: 'bg-blue-500' },
                            female: { bg: 'bg-gradient-to-br from-pink-50 to-pink-100', border: 'border-pink-400', icon: '👩', accent: 'bg-pink-500' },
                            other: { bg: 'bg-gradient-to-br from-purple-50 to-purple-100', border: 'border-purple-400', icon: '👤', accent: 'bg-purple-500' },
                            unknown: { bg: 'bg-gradient-to-br from-gray-50 to-gray-100', border: 'border-gray-400', icon: '👤', accent: 'bg-gray-500' }
                        };
                        const style = genderStyles[person.gender] || genderStyles.unknown;
                        const displayName = person.fullName || person.firstName;
                        const isSelected = person.personId === selectedPersonId;
                        const isDragging = draggingNode === person.personId;

                        return (
                            <div
                                key={person.personId}
                                className={`tree-node absolute select-none transition-shadow ${isDragging ? 'z-50 shadow-2xl cursor-grabbing' : 'z-10 cursor-grab'} ${isSelected ? 'ring-4 ring-teal-400 ring-offset-2' : ''}`}
                                style={{ left: pos.x, top: pos.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
                                onMouseDown={(e) => handleNodeMouseDown(e, person.personId)}
                                onClick={(e) => {
                                    if (!isDragging) {
                                        e.stopPropagation();
                                        onPersonClick?.(person);
                                    }
                                }}
                            >
                                <div className={`${style.bg} ${style.border} border-2 rounded-xl p-3 h-full shadow-md hover:shadow-lg transition-all flex items-center gap-3`}>
                                    <div className={`${style.accent} w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0 text-white shadow-sm`}>
                                        {style.icon}
                                    </div>
                                    <div className="flex-1 min-w-0 overflow-hidden">
                                        {(scriptMode === 'latin' || scriptMode === 'both') && (
                                            <div className="text-sm font-semibold text-stone-800 leading-tight break-words line-clamp-2">
                                                {displayName}
                                            </div>
                                        )}
                                        {(scriptMode === 'lontara' || scriptMode === 'both') && person.lontaraName && (
                                            <div className="text-base text-teal-700 font-lontara leading-normal mt-1 break-words">
                                                {person.lontaraName.first}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default FamilyTree;
