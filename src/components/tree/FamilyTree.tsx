// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Family Tree Component (React Flow Edition)
// Professional tree layout using dagre algorithm + React Flow rendering
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    BackgroundVariant,
    type Node,
    type Edge,
    type NodeChange,
    type NodePositionChange,
    useReactFlow,
    ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import { Person, Relationship, ScriptMode } from '@/types';
import { findRootAncestor, calculateAllGenerations } from '@/lib/generation/calculator';
import { TreeSearch } from './TreeSearch';
import { MaleNode } from './nodes/MaleNode';
import { FemaleNode } from './nodes/FemaleNode';
import { JunctionNode } from './nodes/JunctionNode';
import { calculateTreeLayout, calculateSimplePosition, ViewportInfo } from '@/lib/layout/treeLayout';

export interface FamilyTreeProps {
    persons: Person[];
    relationships: Relationship[];
    scriptMode?: ScriptMode;
    onPersonClick?: (person: Person) => void;
    selectedPersonId?: string | null;
    editable?: boolean;
    onAddPerson?: () => void;
    familyName?: string;
    familyId?: string;
    onPositionChange?: (personId: string, position: { x: number; y: number }) => void;
    onAllPositionsChange?: (positions: Map<string, { x: number; y: number }>) => void;
}

// Layout constants
const NODE_WIDTH = 140;
const NODE_HEIGHT = 100;
const SHAPE_HEIGHT = 56; // Height of the shape area (circle/triangle)

// Adaptive sizing
function getAdaptiveSizes(personCount: number) {
    if (personCount > 200) return { nodeWidth: 100, nodeHeight: 80, shapeSize: 36 };
    if (personCount > 100) return { nodeWidth: 120, nodeHeight: 90, shapeSize: 44 };
    return { nodeWidth: 140, nodeHeight: 100, shapeSize: 56 };
}

// Custom node types for React Flow
const nodeTypes = {
    male: MaleNode,
    female: FemaleNode,
    junction: JunctionNode,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Inner component that uses React Flow hooks (must be inside ReactFlowProvider)
// ═══════════════════════════════════════════════════════════════════════════════
function FamilyTreeInner({
    persons,
    relationships,
    scriptMode = 'both',
    onPersonClick,
    selectedPersonId,
    editable = false,
    onAddPerson,
    familyName = 'Pohon Keluarga',
    familyId,
    onPositionChange,
    onAllPositionsChange
}: FamilyTreeProps) {
    const reactFlowInstance = useReactFlow();
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    // State
    const [isInitialized, setIsInitialized] = useState(false);
    const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
    const [ancestryPathIds, setAncestryPathIds] = useState<Set<string>>(new Set());
    const [hoveredPerson, setHoveredPerson] = useState<{ person: Person; x: number; y: number } | null>(null);
    const [isArranging, setIsArranging] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

    // Refs
    const initialLayoutRef = useRef<Map<string, { x: number; y: number }> | null>(null);
    const prevPersonCount = useRef(0);
    const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
    const reactFlowRef = useRef<HTMLDivElement>(null);

    // Adaptive sizes
    const adaptiveSizes = useMemo(() => getAdaptiveSizes(persons.length), [persons.length]);

    // Build persons map
    const personsMap = useMemo(() => {
        const map = new Map<string, Person>();
        persons.forEach(p => map.set(p.personId, p));
        return map;
    }, [persons]);

    // Highlighted IDs set
    const highlightedSet = useMemo(() => new Set(highlightedIds), [highlightedIds]);

    // Get saved positions
    const savedPositions = useMemo(() => {
        const map = new Map<string, { x: number; y: number }>();
        persons.forEach(p => {
            if (p.position && p.position.x !== undefined && p.position.y !== undefined) {
                map.set(p.personId, { x: p.position.x, y: p.position.y });
            }
        });
        return map;
    }, [persons]);

    // Detect GEDCOM imports
    useEffect(() => {
        const currentCount = persons.length;
        const prevCount = prevPersonCount.current;
        if (prevCount > 0 && currentCount > prevCount + 10) {
            initialLayoutRef.current = null;
            setIsInitialized(false);
        }
        prevPersonCount.current = currentCount;
    }, [persons.length]);

    // Calculate dagre layout (cached)
    const getInitialDagreLayout = useCallback(() => {
        if (initialLayoutRef.current) return initialLayoutRef.current;
        const hasArrangedPositions = persons.some(p => p.position?.fixed === true);
        if (hasArrangedPositions) {
            initialLayoutRef.current = new Map();
            return initialLayoutRef.current;
        }
        initialLayoutRef.current = calculateTreeLayout(persons, collapsedIds, relationships);
        return initialLayoutRef.current;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Ancestry path tracing
    const traceAncestryPath = useCallback((personId: string): Set<string> => {
        const path = new Set<string>();
        const visited = new Set<string>();
        const queue = [personId];
        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);
            path.add(currentId);
            const person = personsMap.get(currentId);
            if (!person) continue;
            person.relationships.parentIds.forEach(parentId => {
                if (!visited.has(parentId)) queue.push(parentId);
            });
        }
        return path;
    }, [personsMap]);

    // Convert persons + positions to React Flow nodes and edges
    const buildNodesAndEdges = useCallback((
        posMap: Map<string, { x: number; y: number }>,
        currentSelectedId: string | null | undefined,
        currentHighlighted: Set<string>,
        currentAncestryPath: Set<string>,
        currentScriptMode: string,
        currentAdaptiveSizes: { nodeWidth: number; nodeHeight: number; shapeSize: number },
    ) => {
        const rfNodes: Node[] = [];
        const rfEdges: Edge[] = [];
        const drawnPairs = new Set<string>();
        // Map: "parentId1-parentId2" (sorted) → junction node ID
        const coupleJunctions = new Map<string, string>();

        // Build person nodes
        persons.forEach(person => {
            const pos = posMap.get(person.personId);
            if (!pos) return;

            const displayName = [person.firstName, person.middleName, person.lastName]
                .filter(Boolean).join(' ') || person.fullName || person.firstName || 'N/A';
            const lontaraFullName = person.lontaraName
                ? [person.lontaraName.first, person.lontaraName.middle, person.lontaraName.last].filter(Boolean).join(' ')
                : '';

            rfNodes.push({
                id: person.personId,
                type: person.gender === 'female' ? 'female' : 'male',
                position: { x: pos.x, y: pos.y },
                data: {
                    label: displayName,
                    person: {
                        personId: person.personId,
                        firstName: person.firstName,
                        fullName: person.fullName,
                        gender: person.gender,
                        photoUrl: person.photoUrl,
                        lontaraName: person.lontaraName,
                        biography: person.biography,
                        title: person.title,
                        reignTitle: person.reignTitle,
                    },
                    displayName,
                    lontaraFullName,
                    shapeSize: currentAdaptiveSizes.shapeSize,
                    scriptMode: currentScriptMode,
                    isSelected: person.personId === currentSelectedId,
                    isHighlighted: currentHighlighted.has(person.personId),
                    isOnAncestryPath: currentAncestryPath.has(person.personId),
                    hasAncestryActive: currentAncestryPath.size > 0,
                    onHover: (rect: DOMRect) => {
                        setHoveredPerson({ person, x: rect.right + 8, y: rect.top });
                    },
                    onHoverEnd: () => setHoveredPerson(null),
                },
            });
        });

        // ── Build spouse edges + junction nodes ──
        // Single Bezier curve from husband to wife.
        // Junction node only used as invisible anchor for child edges.
        persons.forEach(person => {
            person.relationships.spouseIds.forEach(spouseId => {
                const coupleKey = [person.personId, spouseId].sort().join('-');
                if (drawnPairs.has(coupleKey)) return;
                drawnPairs.add(coupleKey);

                const pos1 = posMap.get(person.personId);
                const pos2 = posMap.get(spouseId);
                if (!pos1 || !pos2) return;

                // Determine left/right
                const leftId = pos1.x < pos2.x ? person.personId : spouseId;
                const rightId = pos1.x < pos2.x ? spouseId : person.personId;
                const leftPos = pos1.x < pos2.x ? pos1 : pos2;
                const rightPos = pos1.x < pos2.x ? pos2 : pos1;

                // Single Bezier curve: left spouse → right spouse
                rfEdges.push({
                    id: `spouse-${coupleKey}`,
                    source: leftId,
                    target: rightId,
                    sourceHandle: 'right',
                    targetHandle: 'left',
                    type: 'default', // Bezier curve — one smooth unbroken line
                    style: { stroke: '#ec4899', strokeWidth: 2 },
                });

                // Invisible junction node at midpoint (only for child edge routing)
                const junctionId = `junction-${coupleKey}`;
                const midX = (leftPos.x + rightPos.x + NODE_WIDTH) / 2;
                const midY = (leftPos.y + rightPos.y) / 2 + currentAdaptiveSizes.shapeSize / 2;

                rfNodes.push({
                    id: junctionId,
                    type: 'junction',
                    position: { x: midX, y: midY },
                    data: { label: '' },
                    draggable: false,
                    selectable: false,
                });
                coupleJunctions.set(coupleKey, junctionId);
            });
        });

        // ── Build parent-child edges ──
        // Children connect FROM the couple's junction node (not from individual parents)
        persons.forEach(person => {
            if (person.relationships.parentIds.length === 0) return;

            const parentIds = person.relationships.parentIds.filter(pid => posMap.has(pid));
            if (parentIds.length === 0) return;

            const childEdgeKey = `child-to-${person.personId}`;
            if (drawnPairs.has(childEdgeKey)) return;
            drawnPairs.add(childEdgeKey);

            // Check ancestry path
            const isOnPath = currentAncestryPath.size > 0 &&
                currentAncestryPath.has(person.personId) &&
                parentIds.some(pid => currentAncestryPath.has(pid));

            const edgeStyle = {
                stroke: isOnPath ? '#f59e0b' : '#0d9488',
                strokeWidth: isOnPath ? 3 : 1.8,
                opacity: currentAncestryPath.size > 0 ? (isOnPath ? 1 : 0.25) : 0.65,
            };

            // If child has 2 parents that form a couple, connect from junction
            if (parentIds.length >= 2) {
                const coupleKey = [parentIds[0], parentIds[1]].sort().join('-');
                const junctionId = coupleJunctions.get(coupleKey);

                if (junctionId) {
                    // Connect: junction → child (Bezier curve)
                    rfEdges.push({
                        id: `child-${coupleKey}-${person.personId}`,
                        source: junctionId,
                        target: person.personId,
                        sourceHandle: 'bottom',
                        targetHandle: 'top',
                        type: 'default', // Bezier curve
                        style: edgeStyle,
                    });
                    return;
                }
            }

            // Fallback: single parent → child directly
            const parentId = parentIds[0];
            rfEdges.push({
                id: `child-${parentId}-${person.personId}`,
                source: parentId,
                target: person.personId,
                sourceHandle: 'bottom',
                targetHandle: 'top',
                type: 'default',
                style: edgeStyle,
            });
        });

        return { rfNodes, rfEdges };
    }, [persons]);

    // Initialize positions and build React Flow nodes/edges
    useEffect(() => {
        if (persons.length === 0) return;

        let posMap: Map<string, { x: number; y: number }>;

        if (!isInitialized) {
            posMap = new Map();
            const hasArrangedPositions = persons.some(p => p.position?.fixed === true);

            if (hasArrangedPositions) {
                persons.forEach(p => {
                    if (savedPositions.has(p.personId)) {
                        posMap.set(p.personId, savedPositions.get(p.personId)!);
                    } else {
                        const simplePos = calculateSimplePosition(p, posMap, personsMap);
                        posMap.set(p.personId, simplePos);
                    }
                });
            } else {
                const dagrePositions = getInitialDagreLayout();
                persons.forEach(p => {
                    const pos = dagrePositions.get(p.personId);
                    if (pos) {
                        posMap.set(p.personId, pos);
                    } else {
                        const simplePos = calculateSimplePosition(p, posMap, personsMap);
                        posMap.set(p.personId, simplePos);
                    }
                });
            }

            positionsRef.current = posMap;
            setIsInitialized(true);
        } else {
            // Check for new persons
            posMap = new Map(positionsRef.current);
            let hasNewPersons = false;

            persons.forEach(p => {
                if (!posMap.has(p.personId)) {
                    const savedPos = savedPositions.get(p.personId);
                    if (savedPos) {
                        posMap.set(p.personId, savedPos);
                    } else {
                        const simplePos = calculateSimplePosition(p, posMap, personsMap);
                        posMap.set(p.personId, simplePos);
                    }
                    hasNewPersons = true;
                }
            });

            if (hasNewPersons) {
                positionsRef.current = posMap;
            } else {
                posMap = positionsRef.current;
            }
        }

        const { rfNodes, rfEdges } = buildNodesAndEdges(
            posMap,
            selectedPersonId,
            highlightedSet,
            ancestryPathIds,
            scriptMode || 'both',
            adaptiveSizes,
        );

        setNodes(rfNodes);
        setEdges(rfEdges);

        // Fit view on first load
        if (!isInitialized || prevPersonCount.current === 0) {
            setTimeout(() => {
                reactFlowInstance.fitView({ padding: 0.15 });
            }, 100);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [persons, isInitialized, selectedPersonId, highlightedSet, ancestryPathIds, scriptMode, adaptiveSizes]);

    // Handle node position changes (drag)
    const handleNodesChange = useCallback((changes: NodeChange<Node>[]) => {
        onNodesChange(changes);

        // Update our position ref when nodes are dragged
        const posChanges = changes.filter(
            (c): c is NodePositionChange => c.type === 'position' && c.position !== undefined
        );
        if (posChanges.length > 0) {
            const newPosMap = new Map(positionsRef.current);
            posChanges.forEach(change => {
                if (change.position) {
                    newPosMap.set(change.id, { x: change.position.x, y: change.position.y });
                }
            });
            positionsRef.current = newPosMap;

            // Recalculate junction positions when spouse nodes are dragged
            const draggedPersonIds = posChanges
                .filter(c => c.position && !c.id.startsWith('junction-'))
                .map(c => c.id);

            if (draggedPersonIds.length > 0) {
                setNodes(prevNodes => {
                    const nodeMap = new Map(prevNodes.map(n => [n.id, n]));
                    let changed = false;

                    draggedPersonIds.forEach(personId => {
                        const person = personsMap.get(personId);
                        if (!person) return;

                        person.relationships.spouseIds.forEach(spouseId => {
                            const coupleKey = [personId, spouseId].sort().join('-');
                            const junctionId = `junction-${coupleKey}`;
                            const junctionNode = nodeMap.get(junctionId);
                            if (!junctionNode) return;

                            // Get current positions of both spouses from the live node positions
                            const personNode = nodeMap.get(personId);
                            const spouseNode = nodeMap.get(spouseId);
                            if (!personNode || !spouseNode) return;

                            // Determine left/right consistently (same as initial layout)
                            const p1 = personNode.position;
                            const p2 = spouseNode.position;
                            const leftPos = p1.x < p2.x ? p1 : p2;
                            const rightPos = p1.x < p2.x ? p2 : p1;

                            // Midpoint between right-handle of left spouse and left-handle of right spouse
                            const midX = (leftPos.x + rightPos.x + NODE_WIDTH) / 2;
                            // Stay at vertical midpoint of both spouses (follows the Bezier curve center)
                            const midY = (leftPos.y + rightPos.y) / 2 + adaptiveSizes.shapeSize / 2;

                            if (junctionNode.position.x !== midX || junctionNode.position.y !== midY) {
                                nodeMap.set(junctionId, {
                                    ...junctionNode,
                                    position: { x: midX, y: midY },
                                });
                                changed = true;
                            }
                        });
                    });

                    return changed ? Array.from(nodeMap.values()) : prevNodes;
                });
            }
        }
    }, [onNodesChange, personsMap, adaptiveSizes, setNodes]);

    // Save positions after drag ends
    const handleNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
        if (onAllPositionsChange) {
            onAllPositionsChange(positionsRef.current);
        } else if (onPositionChange) {
            onPositionChange(node.id, { x: node.position.x, y: node.position.y });
        }
    }, [onAllPositionsChange, onPositionChange]);

    // Handle node click
    const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
        const person = personsMap.get(node.id);
        if (person) {
            onPersonClick?.(person);
            setAncestryPathIds(traceAncestryPath(person.personId));
        }
    }, [personsMap, onPersonClick, traceAncestryPath]);

    // Clear ancestry on pane click
    const handlePaneClick = useCallback(() => {
        setAncestryPathIds(new Set());
        setHoveredPerson(null);
    }, []);

    // Focus on person (for search)
    const focusOnPerson = useCallback((personId: string) => {
        const pos = positionsRef.current.get(personId);
        if (!pos) return;

        reactFlowInstance.setCenter(pos.x + NODE_WIDTH / 2, pos.y + NODE_HEIGHT / 2, {
            zoom: Math.max(reactFlowInstance.getZoom(), 0.8),
            duration: 500,
        });
        setHighlightedIds([personId]);
    }, [reactFlowInstance]);

    // Auto arrange
    const handleAutoArrange = useCallback(async () => {
        if (!familyId) return;
        setIsArranging(true);

        setTimeout(async () => {
            try {
                const newPositions = calculateTreeLayout(persons, collapsedIds, relationships);
                positionsRef.current = newPositions;

                const { rfNodes, rfEdges } = buildNodesAndEdges(
                    newPositions,
                    selectedPersonId,
                    highlightedSet,
                    ancestryPathIds,
                    scriptMode || 'both',
                    adaptiveSizes,
                );

                setNodes(rfNodes);
                setEdges(rfEdges);

                setTimeout(() => {
                    reactFlowInstance.fitView({ padding: 0.15, duration: 500 });
                }, 50);

                if (onAllPositionsChange) {
                    await onAllPositionsChange(newPositions);
                }
            } catch (error) {
                console.error('Failed to arrange:', error);
            } finally {
                setIsArranging(false);
            }
        }, 300);
    }, [persons, collapsedIds, relationships, familyId, onAllPositionsChange, buildNodesAndEdges,
        selectedPersonId, highlightedSet, ancestryPathIds, scriptMode, adaptiveSizes, setNodes, setEdges, reactFlowInstance]);

    // PDF Export (WYSIWYG — hi-res capture by expanding container to full tree size)
    const handleExportPDF = useCallback(async () => {
        if (isExporting || persons.length === 0) return;
        setIsExporting(true);
        toast('📸 Mempersiapkan PDF hi-res...', { duration: 3000 });

        try {
            const container = reactFlowRef.current;
            if (!container) throw new Error('React Flow container not found');

            // Save original state
            const prevViewport = reactFlowInstance.getViewport();
            const prevWidth = container.style.width;
            const prevHeight = container.style.height;
            const prevPosition = container.style.position;
            const prevOverflow = container.style.overflow;

            // Calculate full tree bounds from node positions
            const posMap = positionsRef.current;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            posMap.forEach(pos => {
                minX = Math.min(minX, pos.x);
                minY = Math.min(minY, pos.y);
                maxX = Math.max(maxX, pos.x + NODE_WIDTH + 40); // extra for text overflow
                maxY = Math.max(maxY, pos.y + NODE_HEIGHT + 60); // extra for labels
            });
            const padding = 60;
            minX -= padding; minY -= padding;
            maxX += padding; maxY += padding;

            const treeWidth = maxX - minX;
            const treeHeight = maxY - minY;

            // Choose a zoom that keeps nodes readable but image not too huge
            // For large trees (200+), use 0.5; for small trees, use 1.0
            const exportZoom = persons.length > 150 ? 0.5 : persons.length > 50 ? 0.7 : 1.0;
            const canvasWidth = Math.ceil(treeWidth * exportZoom);
            const canvasHeight = Math.ceil(treeHeight * exportZoom);

            // Temporarily expand container to full tree size
            container.style.width = `${canvasWidth}px`;
            container.style.height = `${canvasHeight}px`;
            container.style.position = 'absolute';
            container.style.overflow = 'hidden';

            // Set viewport so entire tree is visible at our chosen zoom
            reactFlowInstance.setViewport({
                x: -minX * exportZoom,
                y: -minY * exportZoom,
                zoom: exportZoom,
            });

            // Wait for React Flow to re-render at new size
            await new Promise(r => setTimeout(r, 500));

            // Hide UI overlays for clean capture
            const overlays = container.querySelectorAll<HTMLElement>(
                '.react-flow__controls, .react-flow__minimap, .react-flow__background, .react-flow__attribution'
            );
            overlays.forEach(el => el.style.display = 'none');

            const controlPanels = container.querySelectorAll<HTMLElement>('.absolute.z-10');
            const hiddenPanels: HTMLElement[] = [];
            controlPanels.forEach(el => {
                if (el.closest('.react-flow__renderer')) return;
                hiddenPanels.push(el);
                el.style.display = 'none';
            });

            // Capture the full tree as hi-res PNG
            const rfViewport = container.querySelector<HTMLElement>('.react-flow__renderer')
                || container;

            const dataUrl = await toPng(rfViewport, {
                cacheBust: true,
                pixelRatio: 2,
                width: canvasWidth,
                height: canvasHeight,
                backgroundColor: '#fafaf9',
                filter: (node: HTMLElement) => {
                    const cls = node.className?.toString?.() || '';
                    if (cls.includes('react-flow__controls')) return false;
                    if (cls.includes('react-flow__minimap')) return false;
                    if (cls.includes('react-flow__attribution')) return false;
                    if (cls.includes('react-flow__background')) return false;
                    return true;
                },
            });

            // Restore everything immediately
            overlays.forEach(el => el.style.display = '');
            hiddenPanels.forEach(el => el.style.display = '');
            container.style.width = prevWidth;
            container.style.height = prevHeight;
            container.style.position = prevPosition;
            container.style.overflow = prevOverflow;
            reactFlowInstance.setViewport(prevViewport);

            // Build PDF from the hi-res image
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = reject;
                img.src = dataUrl;
            });

            const imgWidth = img.naturalWidth;
            const imgHeight = img.naturalHeight;
            const aspectRatio = imgWidth / imgHeight;

            let pdfWidth: number, pdfHeight: number;
            if (aspectRatio > 1.4) { pdfWidth = 297; pdfHeight = 210; }
            else { pdfWidth = 210; pdfHeight = 297; }

            const marginTop = 20, marginBottom = 15, marginSide = 10;
            const availableWidth = pdfWidth - (marginSide * 2);
            const availableHeight = pdfHeight - marginTop - marginBottom;
            const ratio = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);
            const finalWidth = imgWidth * ratio;
            const finalHeight = imgHeight * ratio;
            const xOffset = (pdfWidth - finalWidth) / 2;
            const yOffset = marginTop + (availableHeight - finalHeight) / 2;

            const pdf = new jsPDF({
                orientation: aspectRatio > 1.4 ? 'landscape' : 'portrait',
                unit: 'mm', format: 'a4'
            });

            // Header
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text(familyName, pdfWidth / 2, 12, { align: 'center' });
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(100, 100, 100);
            pdf.text('Pohon Keluarga', pdfWidth / 2, 18, { align: 'center' });
            pdf.setTextColor(0, 0, 0);

            // Tree image
            pdf.addImage(dataUrl, 'PNG', xOffset, yOffset + 5, finalWidth, finalHeight);

            // Footer
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            const createdDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            pdf.text(`Created by WIJA apps • ${createdDate}`, pdfWidth / 2, pdfHeight - 5, { align: 'center' });

            const safeName = familyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
            const timestamp = new Date().toISOString().slice(0, 10);
            pdf.save(`${safeName}-${timestamp}.pdf`);

            toast.success('✅ PDF berhasil didownload!');
        } catch (error) {
            console.error('PDF export error:', error);
            toast.error('Gagal mengexport PDF. Silakan coba lagi.');
            // Attempt to restore on error
            if (reactFlowRef.current) {
                reactFlowRef.current.style.width = '';
                reactFlowRef.current.style.height = '';
                reactFlowRef.current.style.position = '';
                reactFlowRef.current.style.overflow = '';
            }
        } finally {
            setIsExporting(false);
        }
    }, [isExporting, persons.length, familyName, reactFlowInstance]);

    // MiniMap node colors
    const minimapNodeColor = useCallback((node: Node) => {
        return node.type === 'female' ? '#ec4899' : '#3b82f6';
    }, []);

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
        <div ref={reactFlowRef} className="relative h-full w-full">
            {/* Top Controls */}
            <div className="absolute top-3 left-3 z-10 flex gap-2 print:hidden">
                <div className="controls-panel flex gap-1.5 bg-white rounded-lg shadow p-1.5 border border-stone-200"
                    onMouseDown={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className={`px-3 h-8 flex items-center justify-center gap-1 rounded text-sm font-medium border cursor-pointer select-none transition-colors ${isExporting ? 'bg-blue-100 text-blue-400 border-blue-200 cursor-wait'
                            : 'hover:bg-blue-50 text-blue-600 border-blue-200'
                            }`}
                        title="Export ke file PDF"
                    >
                        {isExporting ? '⏳' : '📥'} PDF
                    </button>
                    <div className="w-px bg-stone-200 mx-0.5"></div>
                    <button
                        onClick={handleAutoArrange}
                        disabled={isArranging}
                        className={`px-3 h-8 flex items-center justify-center gap-1 rounded text-sm font-medium border transition-colors ${isArranging ? 'bg-teal-100 text-teal-700 border-teal-300 cursor-wait'
                            : 'hover:bg-teal-50 text-teal-600 border-teal-200'
                            }`}
                        title="Auto rapikan layout"
                        type="button"
                    >
                        {isArranging ? '⏳ Merapikan...' : '✨ Rapihkan'}
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="absolute top-3 right-3 z-10 print:hidden">
                <TreeSearch
                    persons={persons}
                    onSelect={focusOnPerson}
                    onHighlight={setHighlightedIds}
                    className="w-64"
                />
            </div>

            {/* Legend */}
            <div className="absolute bottom-3 left-3 z-10 text-xs bg-white/90 px-3 py-2 rounded-lg shadow border border-stone-200 print:hidden">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                        <div className="w-4 h-0.5 bg-pink-500"></div>
                        <span className="text-stone-500">Pasangan</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-4 h-0.5 bg-teal-600"></div>
                        <span className="text-stone-500">Orang tua-Anak</span>
                    </div>
                    <span className="text-stone-400">• {persons.length} anggota</span>
                </div>
            </div>

            {/* React Flow Canvas */}
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                onNodeDragStop={handleNodeDragStop}
                onPaneClick={handlePaneClick}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.15 }}
                minZoom={0.05}
                maxZoom={3}
                attributionPosition="bottom-right"
                defaultEdgeOptions={{
                    type: 'default', // Bezier curves
                }}
                style={{ background: '#fafaf9' }}
                proOptions={{ hideAttribution: true }}
            >
                <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#d6d3d1" />
                <Controls
                    position="bottom-right"
                    showInteractive={false}
                    style={{ marginBottom: 60 }}
                />
                <MiniMap
                    nodeColor={minimapNodeColor}
                    nodeStrokeWidth={2}
                    zoomable
                    pannable
                    position="bottom-right"
                    style={{ width: 180, height: 120 }}
                />
            </ReactFlow>

            {/* Hover Tooltip */}
            {hoveredPerson && (() => {
                const hp = hoveredPerson;
                const hpName = [hp.person.firstName, hp.person.middleName, hp.person.lastName].filter(Boolean).join(' ') || hp.person.fullName || 'N/A';
                const spNames = hp.person.relationships.spouseIds
                    .map(sid => personsMap.get(sid))
                    .filter(Boolean)
                    .map(s => s!.firstName || s!.fullName || '');
                const cCount = persons.filter(p => p.relationships.parentIds.includes(hp.person.personId)).length;
                return (
                    <div
                        className="fixed z-[100] bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-stone-200 p-3 pointer-events-none"
                        style={{
                            left: Math.min(hp.x, typeof window !== 'undefined' ? window.innerWidth - 260 : hp.x),
                            top: Math.max(8, hp.y),
                            maxWidth: 240,
                        }}
                    >
                        <div className="font-semibold text-sm text-stone-800 leading-tight">{hpName}</div>
                        <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-1.5">
                            <span>{hp.person.gender === 'male' ? '♂ Laki-laki' : hp.person.gender === 'female' ? '♀ Perempuan' : '● Lainnya'}</span>
                        </div>
                        {hp.person.biography && (
                            <div className="text-xs text-stone-600 mt-1 line-clamp-2 italic">{hp.person.biography}</div>
                        )}
                        <div className="mt-1.5 pt-1.5 border-t border-stone-100 text-xs text-stone-500 space-y-0.5">
                            {spNames.length > 0 && <div>💑 {spNames.join(', ')}</div>}
                            {cCount > 0 && <div>👶 {cCount} anak</div>}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main export — wraps with ReactFlowProvider
// ═══════════════════════════════════════════════════════════════════════════════
export function FamilyTree(props: FamilyTreeProps) {
    return (
        <ReactFlowProvider>
            <FamilyTreeInner {...props} />
        </ReactFlowProvider>
    );
}

export default FamilyTree;
