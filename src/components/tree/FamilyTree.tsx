// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Family Tree Component
// Professional tree layout using dagre algorithm
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';

import domtoimage from 'dom-to-image-more';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
import { Person, Relationship, ScriptMode } from '@/types';
import { findRootAncestor, calculateAllGenerations } from '@/lib/generation/calculator';
import { TreeSearch } from './TreeSearch';
import { TreeMinimap } from './TreeMinimap';

export interface FamilyTreeProps {
    persons: Person[];
    relationships: Relationship[];
    scriptMode?: ScriptMode;
    onPersonClick?: (person: Person) => void;
    selectedPersonId?: string | null;
    editable?: boolean;
    onAddPerson?: () => void;
    familyName?: string;
    familyId?: string; // Required to save positions
    onPositionChange?: (personId: string, position: { x: number; y: number }) => void;
    onAllPositionsChange?: (positions: Map<string, { x: number; y: number }>) => void; // Save all positions at once
}

// Layout constants — Traditional Bugis tree: shape + name below
const NODE_WIDTH = 140; // Fixed width for all nodes (shapes are centered)
const NODE_HEIGHT = 100; // For layout engine spacing calculations
const SHAPE_SIZE = 56; // Circle/triangle diameter
const CANVAS_PADDING = 150;

// Node width is fixed at NODE_WIDTH for consistent connection endpoints

interface NodePosition {
    x: number;
    y: number;
}

// Calculate layout using custom algorithm with dagre
import { calculateTreeLayout, calculateSimplePosition, ViewportInfo } from '@/lib/layout/treeLayout';


export function FamilyTree({
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
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [hasAutoFitted, setHasAutoFitted] = useState(false);
    const dragStartPos = useRef<{ x: number, y: number } | null>(null);
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

    // Track current viewport for new person placement (ref to avoid effect re-triggers)
    const viewportRef = useRef({ pan: { x: 0, y: 0 }, zoom: 1 });
    // Keep ref in sync with state
    viewportRef.current = { pan, zoom };

    // Node positions (can be dragged)
    const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(new Map());
    const [isInitialized, setIsInitialized] = useState(false);

    // Track person count to detect GEDCOM imports (large batch additions)
    const prevPersonCount = useRef(0);
    useEffect(() => {
        const currentCount = persons.length;
        const prevCount = prevPersonCount.current;
        // If person count increased by 10+ (likely a GEDCOM import), re-layout
        if (prevCount > 0 && currentCount > prevCount + 10) {
            initialLayoutRef.current = null;
            setIsInitialized(false);
            setHasAutoFitted(false);
        }
        prevPersonCount.current = currentCount;
    }, [persons.length]);

    // Dragging state
    const [draggingNode, setDraggingNode] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Canvas panning
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    // Search highlight state
    const [highlightedIds, setHighlightedIds] = useState<string[]>([]);

    // Focus on person (for search navigation)
    const focusOnPerson = useCallback((personId: string) => {
        const pos = nodePositions.get(personId);
        if (!pos || !containerRef.current) return;

        const container = containerRef.current;
        const centerX = container.clientWidth / 2;
        const centerY = container.clientHeight / 2;

        // Calculate pan to center on person
        const targetZoom = Math.max(zoom, 0.8); // Ensure visible
        const newPanX = centerX - (pos.x + NODE_WIDTH / 2) * targetZoom;
        const newPanY = centerY - (pos.y + NODE_HEIGHT / 2) * targetZoom;

        setZoom(targetZoom);
        setPan({ x: newPanX, y: newPanY });
        setHighlightedIds([personId]);
    }, [nodePositions, zoom]);

    // Build persons map
    const personsMap = useMemo(() => {
        const map = new Map<string, Person>();
        persons.forEach(p => map.set(p.personId, p));
        return map;
    }, [persons]);

    // Get saved positions from persons data (stored in Firestore)
    const savedPositions = useMemo(() => {
        const map = new Map<string, NodePosition>();
        persons.forEach(p => {
            // Check if person has a valid saved position (not just default random)
            if (p.position && p.position.x !== undefined && p.position.y !== undefined) {
                map.set(p.personId, { x: p.position.x, y: p.position.y });
            }
        });
        return map;
    }, [persons]);

    // PERFORMANCE OPTIMIZATION: Only run dagre layout on first load OR when "Rapihkan" is clicked
    // For new persons, use fast O(1) calculateSimplePosition instead of O(n²) dagre
    const initialLayoutRef = useRef<Map<string, NodePosition> | null>(null);

    // Calculate dagre layout ONLY on first load when no saved positions exist
    // This is lazy-evaluated and cached in ref
    const getInitialDagreLayout = useCallback(() => {
        if (initialLayoutRef.current) return initialLayoutRef.current;

        // Check if tree was already arranged (has fixed positions)
        const hasArrangedPositions = persons.some(p => p.position?.fixed === true);

        if (hasArrangedPositions) {
            // Tree was already arranged - don't run dagre, use saved positions
            initialLayoutRef.current = new Map();
            return initialLayoutRef.current;
        }

        // First time load without saved positions - run dagre once
        initialLayoutRef.current = calculateTreeLayout(persons, collapsedIds, relationships);
        return initialLayoutRef.current;
    }, []); // Empty deps - only called once on first load

    // Initialize positions on first load - prefer saved positions from Firestore
    useEffect(() => {
        if (!isInitialized && persons.length > 0) {
            const initialMap = new Map<string, NodePosition>();

            // Check if tree was already arranged
            const hasArrangedPositions = persons.some(p => p.position?.fixed === true);

            if (hasArrangedPositions) {
                // Use saved positions, calculate simple positions for any missing
                persons.forEach(p => {
                    if (savedPositions.has(p.personId)) {
                        initialMap.set(p.personId, savedPositions.get(p.personId)!);
                    } else {
                        // New person without saved position - use simple position
                        const simplePos = calculateSimplePosition(p, initialMap, personsMap);
                        initialMap.set(p.personId, simplePos);
                    }
                });
            } else {
                // First load - run dagre layout ONCE
                const dagrePositions = getInitialDagreLayout();
                persons.forEach(p => {
                    const pos = dagrePositions.get(p.personId);
                    if (pos) {
                        initialMap.set(p.personId, pos);
                    } else {
                        // Fallback for any missed persons
                        const simplePos = calculateSimplePosition(p, initialMap, personsMap);
                        initialMap.set(p.personId, simplePos);
                    }
                });
            }

            if (initialMap.size > 0) {
                setNodePositions(initialMap);
                setIsInitialized(true);
            }
        }
    }, [persons, savedPositions, personsMap, isInitialized, getInitialDagreLayout]);

    // Update positions when new persons are added - use SIMPLE POSITION (fast O(1))
    useEffect(() => {
        if (!isInitialized) return;

        setNodePositions(prev => {
            const newMap = new Map(prev);
            let hasChange = false;

            // Build viewport info using REF (to get latest values without re-triggering effect)
            const currentViewport = viewportRef.current;
            const viewport: ViewportInfo = {
                pan: currentViewport.pan,
                zoom: currentViewport.zoom,
                containerWidth: containerRef.current?.clientWidth ?? 800,
                containerHeight: containerRef.current?.clientHeight ?? 600
            };

            persons.forEach(p => {
                if (!newMap.has(p.personId)) {
                    // New person - use saved position if available, otherwise SIMPLE position (not dagre!)
                    const savedPos = savedPositions.get(p.personId);
                    if (savedPos) {
                        newMap.set(p.personId, savedPos);
                    } else {
                        // PERFORMANCE: Use simple O(1) position instead of O(n²) dagre
                        // Pass viewport so new person appears in current view
                        const simplePos = calculateSimplePosition(p, newMap, personsMap, viewport);
                        newMap.set(p.personId, simplePos);
                    }
                    hasChange = true;
                }
            });

            return hasChange ? newMap : prev;
        });
    }, [persons, savedPositions, personsMap, isInitialized]);

    // Get current positions (no longer depends on calculatedPositions - avoiding re-triggers)
    const positions = useMemo(() => {
        if (nodePositions.size > 0) return nodePositions;
        // Fallback for edge cases - this should rarely happen now
        return new Map<string, NodePosition>();
    }, [nodePositions]);

    // Highlighted IDs set for quick lookup
    const highlightedSet = useMemo(() => new Set(highlightedIds), [highlightedIds]);

    // VIRTUALIZATION: Only render persons visible in viewport + buffer
    const visiblePersons = useMemo(() => {
        if (!containerRef.current || positions.size === 0) return persons;

        const buffer = 300; // Render nodes slightly outside viewport
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;

        // Calculate viewport bounds in canvas coordinates
        const viewLeft = -pan.x / zoom - buffer;
        const viewTop = -pan.y / zoom - buffer;
        const viewRight = (-pan.x + containerWidth) / zoom + buffer;
        const viewBottom = (-pan.y + containerHeight) / zoom + buffer;

        return persons.filter(p => {
            const pos = positions.get(p.personId);
            if (!pos) return false;

            // Check if node (with its size) intersects viewport
            const nodeRight = pos.x + NODE_WIDTH;
            const nodeBottom = pos.y + NODE_HEIGHT;

            return pos.x < viewRight && nodeRight > viewLeft &&
                pos.y < viewBottom && nodeBottom > viewTop;
        });
    }, [persons, positions, pan, zoom]);

    // Calculate generation for each person (for color bands)
    const generations = useMemo(() => {
        const rootAncestor = findRootAncestor(persons);
        if (!rootAncestor) return new Map<string, number>();
        return calculateAllGenerations(persons, rootAncestor.personId);
    }, [persons]);

    // Generation color palette (soft pastels for visual appeal)
    const GENERATION_COLORS = [
        'from-amber-100 to-amber-50 border-amber-300',     // Gen 1 - Root
        'from-orange-100 to-orange-50 border-orange-300',  // Gen 2
        'from-rose-100 to-rose-50 border-rose-300',        // Gen 3
        'from-fuchsia-100 to-fuchsia-50 border-fuchsia-300', // Gen 4
        'from-violet-100 to-violet-50 border-violet-300',  // Gen 5
        'from-indigo-100 to-indigo-50 border-indigo-300',  // Gen 6
        'from-sky-100 to-sky-50 border-sky-300',          // Gen 7
        'from-cyan-100 to-cyan-50 border-cyan-300',       // Gen 8+
    ];

    // Calculate connections based on current positions
    const connections = useMemo(() => {
        const connLines: Array<{ id: string; d: string; color: string; type: 'spouse' | 'parent-child' | 'vertical-drop' | 'marriage-dot' }> = [];
        const drawnPairs = new Set<string>();
        const coupleConnectors = new Map<string, { centerX: number; centerY: number; bottomY: number }>();

        const shapeCenterY = SHAPE_SIZE / 2; // Center of the shape vertically

        // First pass: Draw spouse connections
        persons.forEach(person => {
            const pos1 = positions.get(person.personId);
            if (!pos1) return;

            person.relationships.spouseIds.forEach(spouseId => {
                const key = [person.personId, spouseId].sort().join('-spouse-');
                if (drawnPairs.has(key)) return;
                drawnPairs.add(key);

                const pos2 = positions.get(spouseId);
                if (!pos2) return;

                const leftPos = pos1.x < pos2.x ? pos1 : pos2;
                const rightPos = pos1.x < pos2.x ? pos2 : pos1;

                // Connect at the center of shapes
                const y1 = leftPos.y + shapeCenterY;
                const y2 = rightPos.y + shapeCenterY;
                const x1 = leftPos.x + NODE_WIDTH / 2 + SHAPE_SIZE / 2 + 2;
                const x2 = rightPos.x + NODE_WIDTH / 2 - SHAPE_SIZE / 2 - 2;

                // Horizontal line between spouses (clean, straight)
                connLines.push({
                    id: `spouse-${key}`,
                    d: `M ${x1} ${y1} L ${x2} ${y2}`,
                    color: '#f472b6',
                    type: 'spouse'
                });

                // Marriage dot at midpoint
                const centerX = (leftPos.x + rightPos.x + NODE_WIDTH) / 2;
                const centerY = (y1 + y2) / 2;
                connLines.push({
                    id: `marriage-dot-${key}`,
                    d: `M ${centerX} ${centerY} m -4,0 a 4,4 0 1,0 8,0 a 4,4 0 1,0 -8,0`,
                    color: '#f472b6',
                    type: 'marriage-dot'
                });

                // Store connector for child connections
                const coupleKey = [person.personId, spouseId].sort().join('-');
                const bottomY = Math.max(leftPos.y, rightPos.y) + SHAPE_SIZE + 4;
                coupleConnectors.set(coupleKey, { centerX, centerY, bottomY });
            });
        });

        // Second pass: Draw parent-child connections with smooth rounded corners
        const childrenByParentPair = new Map<string, string[]>();

        persons.forEach(person => {
            if (person.relationships.parentIds.length > 0) {
                const parentKey = [...person.relationships.parentIds].sort().join('|||');
                if (!childrenByParentPair.has(parentKey)) {
                    childrenByParentPair.set(parentKey, []);
                }
                const children = childrenByParentPair.get(parentKey)!;
                if (!children.includes(person.personId)) {
                    children.push(person.personId);
                }
            }
        });

        const R = 12; // Corner radius for smooth bends

        childrenByParentPair.forEach((childIds, parentKey) => {
            const parentIds = parentKey.split('|||');
            const validParentIds = parentIds.filter(pid => positions.has(pid) && personsMap.has(pid));
            if (validParentIds.length === 0) return;

            const firstParentPos = positions.get(validParentIds[0])!;

            // Find parent drop point
            let dropX: number;
            let dropStartY: number;

            if (validParentIds.length >= 2) {
                const coupleKey = validParentIds.slice(0, 2).sort().join('-');
                const connector = coupleConnectors.get(coupleKey);
                if (connector) {
                    dropX = connector.centerX;
                    dropStartY = connector.bottomY;
                } else {
                    const parent2Pos = positions.get(validParentIds[1]);
                    if (parent2Pos) {
                        dropX = (firstParentPos.x + parent2Pos.x + NODE_WIDTH) / 2;
                        dropStartY = Math.max(firstParentPos.y, parent2Pos.y) + SHAPE_SIZE + 4;
                    } else {
                        dropX = firstParentPos.x + NODE_WIDTH / 2;
                        dropStartY = firstParentPos.y + SHAPE_SIZE + 4;
                    }
                }
            } else {
                dropX = firstParentPos.x + NODE_WIDTH / 2;
                dropStartY = firstParentPos.y + SHAPE_SIZE + 4;
            }

            // Get valid children sorted left-to-right
            const validChildren = childIds
                .map(id => ({ id, pos: positions.get(id) }))
                .filter(c => c.pos !== undefined)
                .sort((a, b) => a.pos!.x - b.pos!.x);

            if (validChildren.length === 0) return;

            // Horizontal bar Y position (midpoint between parent and closest child)
            const closestChildTop = Math.min(...validChildren.map(c => c.pos!.y));
            const barY = dropStartY + (closestChildTop - dropStartY) * 0.45;

            // 1) Vertical line: parent → horizontal bar
            connLines.push({
                id: `parent-drop-${parentKey}`,
                d: `M ${dropX} ${dropStartY} L ${dropX} ${barY}`,
                color: '#a8a29e',
                type: 'vertical-drop'
            });

            if (validChildren.length === 1) {
                const child = validChildren[0];
                const childCenterX = child.pos!.x + NODE_WIDTH / 2;
                const childTop = child.pos!.y;

                if (Math.abs(childCenterX - dropX) < 2) {
                    // Straight vertical line
                    connLines.push({
                        id: `child-drop-${child.id}`,
                        d: `M ${dropX} ${barY} L ${childCenterX} ${childTop}`,
                        color: '#a8a29e',
                        type: 'parent-child'
                    });
                } else {
                    // Rounded corner path: horizontal then vertical
                    const dir = childCenterX > dropX ? 1 : -1;
                    connLines.push({
                        id: `child-drop-${child.id}`,
                        d: `M ${dropX} ${barY} L ${childCenterX - dir * R} ${barY} Q ${childCenterX} ${barY}, ${childCenterX} ${barY + R} L ${childCenterX} ${childTop}`,
                        color: '#a8a29e',
                        type: 'parent-child'
                    });
                }
            } else {
                // Multiple children: horizontal bar with rounded corners + vertical drops
                const leftChildX = validChildren[0].pos!.x + NODE_WIDTH / 2;
                const rightChildX = validChildren[validChildren.length - 1].pos!.x + NODE_WIDTH / 2;

                // 2) Horizontal bar
                connLines.push({
                    id: `hbar-${parentKey}`,
                    d: `M ${leftChildX} ${barY} L ${rightChildX} ${barY}`,
                    color: '#a8a29e',
                    type: 'parent-child'
                });

                // 3) Vertical drops with smooth corners
                validChildren.forEach(child => {
                    const childCenterX = child.pos!.x + NODE_WIDTH / 2;
                    const childTop = child.pos!.y;

                    connLines.push({
                        id: `child-drop-${child.id}`,
                        d: `M ${childCenterX} ${barY} L ${childCenterX} ${childTop}`,
                        color: '#a8a29e',
                        type: 'parent-child'
                    });
                });
            }
        });

        return connLines;
    }, [persons, positions, personsMap]);

    // Canvas size - dynamically calculated with extra space for panning in all directions
    const canvasSize = useMemo(() => {
        if (positions.size === 0) {
            return { width: 1200, height: 800 }; // Default for empty canvas
        }

        let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
        positions.forEach(pos => {
            minX = Math.min(minX, pos.x);
            minY = Math.min(minY, pos.y);
            maxX = Math.max(maxX, pos.x + NODE_WIDTH);
            maxY = Math.max(maxY, pos.y + NODE_HEIGHT);
        });

        // Calculate content bounds
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;

        // Add moderate padding for comfortable panning (not too wide)
        const EXTRA_SPACE = 200; // Reduced from 500
        const width = Math.max(contentWidth + EXTRA_SPACE * 2, 1200);
        const height = Math.max(contentHeight + EXTRA_SPACE * 2, 800);

        return { width, height };
    }, [positions]);

    // Auto-fit zoom on first load for large trees
    useEffect(() => {
        if (!hasAutoFitted && positions.size > 0 && containerRef.current) {
            const container = containerRef.current;
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;

            // Calculate the zoom level needed to fit the entire tree
            const zoomX = containerWidth / canvasSize.width;
            const zoomY = containerHeight / canvasSize.height;
            const fitZoom = Math.min(zoomX, zoomY, 1); // Cap at 1 (100%)

            // Only auto-fit if tree is larger than viewport
            if (fitZoom < 0.9) {
                // Use a slightly lower zoom to leave some margin
                const targetZoom = Math.max(fitZoom * 0.95, 0.1);
                setZoom(targetZoom);

                // Center the tree
                const scaledWidth = canvasSize.width * targetZoom;
                const scaledHeight = canvasSize.height * targetZoom;
                const centerX = (containerWidth - scaledWidth) / 2;
                const centerY = (containerHeight - scaledHeight) / 2;
                setPan({ x: Math.max(0, centerX), y: Math.max(0, centerY) });
            }

            setHasAutoFitted(true);
        }
    }, [hasAutoFitted, positions.size, canvasSize, containerRef]);

    // Node drag handlers
    const handleNodeMouseDown = useCallback((e: React.MouseEvent, personId: string) => {
        e.stopPropagation();
        const pos = positions.get(personId);
        if (!pos) return;

        // Track starting position for drag detection
        dragStartPos.current = { x: e.clientX, y: e.clientY };
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

    const handleMouseUp = useCallback((e: React.MouseEvent) => {
        // Check if this was a drag or a click (moved more than 5px = drag)
        const wasDrag = dragStartPos.current && (
            Math.abs(e.clientX - dragStartPos.current.x) > 5 ||
            Math.abs(e.clientY - dragStartPos.current.y) > 5
        );

        if (wasDrag && draggingNode) {
            // Save ALL positions to Firestore after drag (not just the dragged node)
            if (onAllPositionsChange) {
                // Save all current positions
                onAllPositionsChange(nodePositions);
            } else if (onPositionChange) {
                // Fallback: save only the dragged node position
                const newPos = nodePositions.get(draggingNode);
                if (newPos) {
                    onPositionChange(draggingNode, { x: newPos.x, y: newPos.y });
                }
            }
        }

        if (!wasDrag && draggingNode) {
            // This was a click, not a drag - trigger person click
            const person = persons.find(p => p.personId === draggingNode);
            if (person) {
                onPersonClick?.(person);
            }
        }

        dragStartPos.current = null;
        setDraggingNode(null);
        setIsPanning(false);
    }, [draggingNode, persons, onPersonClick, nodePositions, onPositionChange, onAllPositionsChange]);

    const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        // Don't start panning if clicking on a node, button, or control element
        if (target.closest('.tree-node') || target.tagName === 'BUTTON') return;

        setIsPanning(true);
        setPanStart({
            x: e.clientX - pan.x,
            y: e.clientY - pan.y
        });
    }, [pan]);

    const toggleCollapse = useCallback((id: string) => {
        setCollapsedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const getDescendantCount = useCallback((personId: string) => {
        const children = persons.filter(p => p.relationships.parentIds.includes(personId));
        let count = children.length;
        children.forEach(c => {
            count += getDescendantCount(c.personId);
        });
        return count;
    }, [persons]);

    // Zoom controls - extended range for large trees
    const handleZoomIn = () => setZoom(z => Math.min(z + 0.15, 3)); // Up to 300% for details
    const handleZoomOut = () => setZoom(z => Math.max(z - 0.15, 0.05)); // Down to 5% for overview
    const handleZoomReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

    // ═══════════════════════════════════════════════════════════════════════════════
    // MOBILE TOUCH GESTURES - Pinch to zoom + Two-finger pan
    // ═══════════════════════════════════════════════════════════════════════════════
    interface TouchPoint { clientX: number; clientY: number; }
    const touchStartRef = useRef<{ touches: TouchPoint[]; zoom: number; pan: { x: number; y: number } } | null>(null);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            // Two-finger gesture - store initial state
            e.preventDefault();
            touchStartRef.current = {
                touches: [e.touches[0], e.touches[1]],
                zoom,
                pan
            };
        }
    }, [zoom, pan]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 2 && touchStartRef.current) {
            e.preventDefault();
            const { touches: startTouches, zoom: startZoom, pan: startPan } = touchStartRef.current;

            // Calculate initial distance between fingers
            const startDist = Math.hypot(
                startTouches[1].clientX - startTouches[0].clientX,
                startTouches[1].clientY - startTouches[0].clientY
            );

            // Calculate current distance
            const currentDist = Math.hypot(
                e.touches[1].clientX - e.touches[0].clientX,
                e.touches[1].clientY - e.touches[0].clientY
            );

            // Calculate zoom scale
            const scale = currentDist / startDist;
            const newZoom = Math.min(Math.max(startZoom * scale, 0.05), 3);

            // Calculate pan delta (average movement of both fingers)
            const startCenterX = (startTouches[0].clientX + startTouches[1].clientX) / 2;
            const startCenterY = (startTouches[0].clientY + startTouches[1].clientY) / 2;
            const currentCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const currentCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

            setZoom(newZoom);
            setPan({
                x: startPan.x + (currentCenterX - startCenterX),
                y: startPan.y + (currentCenterY - startCenterY)
            });
        }
    }, []);

    const handleTouchEnd = useCallback(() => {
        touchStartRef.current = null;
    }, []);

    // Fit to screen function
    const handleFitToScreen = useCallback(() => {
        if (!containerRef.current || positions.size === 0) return;

        const container = containerRef.current;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        const zoomX = containerWidth / canvasSize.width;
        const zoomY = containerHeight / canvasSize.height;
        const fitZoom = Math.min(zoomX, zoomY, 1) * 0.95;
        const targetZoom = Math.max(fitZoom, 0.05);

        setZoom(targetZoom);

        // Center the tree
        const scaledWidth = canvasSize.width * targetZoom;
        const scaledHeight = canvasSize.height * targetZoom;
        const centerX = (containerWidth - scaledWidth) / 2;
        const centerY = (containerHeight - scaledHeight) / 2;
        setPan({ x: Math.max(0, centerX), y: Math.max(0, centerY) });
    }, [positions.size, canvasSize]);

    // Mouse wheel/trackpad handler - PAN instead of zoom
    // Zoom is controlled only by buttons
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        // Use deltaX and deltaY to pan the view
        setPan(p => ({
            x: p.x - e.deltaX,
            y: p.y - e.deltaY
        }));
    }, []);

    // Auto arrange using dagre - with visual feedback and auto-save
    const [isArranging, setIsArranging] = useState(false);

    const handleAutoArrange = useCallback(async () => {
        if (!familyId) {
            console.warn('Cannot save positions: familyId is not provided');
            return;
        }

        setIsArranging(true);

        // Small delay for visual feedback
        setTimeout(async () => {
            try {
                const newPositions = calculateTreeLayout(persons, collapsedIds, relationships);

                // Update local state first for immediate feedback
                setNodePositions(new Map(newPositions));
                setPan({ x: 0, y: 0 });
                setZoom(1);

                // Save ALL positions to Firestore automatically
                if (onAllPositionsChange) {
                    await onAllPositionsChange(newPositions);
                }
            } catch (error) {
                console.error('Failed to save arranged positions:', error);
            } finally {
                setIsArranging(false);
            }
        }, 500);
    }, [persons, collapsedIds, relationships, familyId, onAllPositionsChange]);

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
                // Build full name from components
                const displayName = [person.firstName, person.middleName, person.lastName]
                    .filter(Boolean).join(' ') || person.fullName || person.firstName;
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
            toast.error('Gagal mengexport PDF. Silakan coba lagi.');
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
            {/* All Controls - Fixed Position (won't move during pan) */}
            <div className="fixed top-20 left-4 z-30 flex gap-2 print:hidden">
                {/* Add Button */}
                {editable && onAddPerson && (
                    <button
                        onClick={onAddPerson}
                        className="px-4 py-2 bg-teal-500 text-white rounded-lg shadow-lg flex items-center gap-2 hover:bg-teal-600 transition text-sm font-medium"
                    >
                        <span className="text-lg leading-none">+</span>
                        <span>Tambah Anggota</span>
                    </button>
                )}

                {/* Zoom & Tools Panel */}
                <div
                    className="controls-panel flex gap-1.5 bg-white rounded-lg shadow p-1.5 border border-stone-200"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button onClick={handleZoomIn} className="w-8 h-8 flex items-center justify-center hover:bg-stone-100 rounded text-stone-600 font-bold" title="Zoom in">+</button>
                    <button onClick={handleZoomOut} className="w-8 h-8 flex items-center justify-center hover:bg-stone-100 rounded text-stone-600 font-bold" title="Zoom out">−</button>
                    <button onClick={handleZoomReset} className="w-8 h-8 flex items-center justify-center hover:bg-stone-100 rounded text-stone-600" title="Reset 100%">↺</button>
                    <button onClick={handleFitToScreen} className="w-8 h-8 flex items-center justify-center hover:bg-stone-100 rounded text-stone-600" title="Fit to screen">⊡</button>
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
                        disabled={isArranging}
                        className={`px-3 h-8 flex items-center justify-center gap-1 rounded text-sm font-medium border transition-colors ${isArranging
                            ? 'bg-teal-100 text-teal-700 border-teal-300 cursor-wait'
                            : 'hover:bg-teal-50 text-teal-600 border-teal-200'
                            }`}
                        title="Auto rapikan layout"
                        type="button"
                    >
                        {isArranging ? '⏳ Merapikan...' : '✨ Rapihkan'}
                    </button>
                </div>
            </div>

            {/* Search - Top Right */}
            <div className="fixed top-20 right-4 z-30 print:hidden">
                <TreeSearch
                    persons={persons}
                    onSelect={focusOnPerson}
                    onHighlight={setHighlightedIds}
                    className="w-64"
                />
            </div>

            {/* Minimap - Bottom Right */}
            <TreeMinimap
                positions={positions}
                persons={persons}
                canvasSize={canvasSize}
                viewport={{
                    pan,
                    zoom,
                    containerWidth: containerRef.current?.clientWidth ?? 800,
                    containerHeight: containerRef.current?.clientHeight ?? 600
                }}
                onNavigate={setPan}
                className="fixed bottom-20 right-4 z-30 print:hidden"
            />

            {/* Info - Fixed Position */}
            <div className="fixed bottom-4 left-4 z-30 text-xs bg-white/90 px-3 py-2 rounded-lg shadow border border-stone-200 print:hidden">
                <div className="text-stone-600 font-medium">{Math.round(zoom * 100)}% • {persons.length} anggota</div>
                <div className="text-stone-400">Scroll/geser = pan • Drag canvas = geser • Drag node = pindah</div>
            </div>

            {/* Legend - Above Minimap */}
            <div className="fixed bottom-44 right-4 z-30 text-xs bg-white/90 px-3 py-2 rounded-lg shadow border border-stone-200 print:hidden">
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
                style={{
                    overscrollBehavior: 'none',  // Prevent browser back/forward gesture
                    touchAction: 'none'           // Prevent touch gestures
                }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div
                    className="tree-content"
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: 'top left',
                        width: canvasSize.width,
                        height: canvasSize.height,
                        position: 'relative',
                        backgroundColor: '#fafaf9',
                        backgroundImage: 'radial-gradient(circle, #d6d3d1 1px, transparent 1px)',
                        backgroundSize: '24px 24px'
                    }}
                >
                    {/* SVG Connectors */}
                    <svg className="absolute inset-0 pointer-events-none" width={canvasSize.width} height={canvasSize.height}>
                        {connections.map(conn => (
                            <path
                                key={conn.id}
                                d={conn.d}
                                fill={conn.type === 'marriage-dot' ? conn.color : 'none'}
                                stroke={conn.type === 'marriage-dot' ? 'none' : conn.color}
                                strokeWidth={
                                    conn.type === 'spouse' ? 2.5 :
                                        conn.type === 'vertical-drop' ? 2 : 1.8
                                }
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                opacity={conn.type === 'marriage-dot' ? 0.9 : 0.7}
                            />
                        ))}
                    </svg>

                    {/* Person Nodes — Traditional Bugis style: shape + name below */}
                    {visiblePersons.map(person => {
                        const pos = positions.get(person.personId);
                        if (!pos) return null;

                        const displayName = [person.firstName, person.middleName, person.lastName]
                            .filter(Boolean).join(' ') || person.fullName || person.firstName || 'N/A';
                        const isSelected = person.personId === selectedPersonId;
                        const isHighlighted = highlightedSet.has(person.personId);
                        const isDragging = draggingNode === person.personId;

                        const lontaraFullName = person.lontaraName
                            ? [person.lontaraName.first, person.lontaraName.middle, person.lontaraName.last].filter(Boolean).join(' ')
                            : '';
                        // nodeWidth is fixed as NODE_WIDTH for consistent connection endpoints

                        return (
                            <div
                                key={person.personId}
                                className={`tree-node absolute select-none transition-transform ${isDragging ? 'z-50 scale-110 cursor-grabbing' : 'z-10 cursor-grab hover:scale-105'
                                    } ${isSelected ? 'scale-110' : ''} ${isHighlighted ? 'animate-pulse' : ''}`}
                                style={{ left: pos.x, top: pos.y, width: NODE_WIDTH }}
                                onMouseDown={(e) => handleNodeMouseDown(e, person.personId)}
                            >
                                {/* Vertical layout: Shape centered, text below */}
                                <div className="flex flex-col items-center gap-1">
                                    {/* Gender Shape */}
                                    {person.gender === 'female' ? (
                                        /* Inverted Triangle for female */
                                        <div className="relative" style={{ width: SHAPE_SIZE, height: SHAPE_SIZE }}>
                                            <svg width={SHAPE_SIZE} height={SHAPE_SIZE} viewBox="0 0 56 56" className="drop-shadow-lg">
                                                <defs>
                                                    <clipPath id={`tri-${person.personId}`}>
                                                        <polygon points="28,50 4,10 52,10" />
                                                    </clipPath>
                                                    <linearGradient id={`grad-f-${person.personId}`} x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#f9a8d4" />
                                                        <stop offset="100%" stopColor="#ec4899" />
                                                    </linearGradient>
                                                </defs>
                                                {person.photoUrl ? (
                                                    <image
                                                        href={person.photoUrl}
                                                        x="0" y="0" width="56" height="56"
                                                        clipPath={`url(#tri-${person.personId})`}
                                                        preserveAspectRatio="xMidYMid slice"
                                                    />
                                                ) : (
                                                    <polygon
                                                        points="28,50 4,10 52,10"
                                                        fill={`url(#grad-f-${person.personId})`}
                                                    />
                                                )}
                                                <polygon
                                                    points="28,50 4,10 52,10"
                                                    fill="none"
                                                    stroke={isSelected ? '#14b8a6' : isHighlighted ? '#f59e0b' : '#db2777'}
                                                    strokeWidth={isSelected || isHighlighted ? 3 : 2}
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        </div>
                                    ) : (
                                        /* Circle for male / other */
                                        <div
                                            className={`rounded-full overflow-hidden flex items-center justify-center text-white text-lg drop-shadow-lg ${isSelected ? 'ring-3 ring-teal-400 ring-offset-2' :
                                                isHighlighted ? 'ring-3 ring-amber-400 ring-offset-2' : ''
                                                }`}
                                            style={{
                                                width: SHAPE_SIZE, height: SHAPE_SIZE,
                                                background: person.gender === 'male'
                                                    ? 'linear-gradient(135deg, #93c5fd, #3b82f6)'
                                                    : 'linear-gradient(135deg, #c4b5fd, #8b5cf6)',
                                                border: `2px solid ${isSelected ? '#14b8a6' : isHighlighted ? '#f59e0b' : person.gender === 'male' ? '#2563eb' : '#7c3aed'}`
                                            }}
                                        >
                                            {person.photoUrl ? (
                                                <img
                                                    src={person.photoUrl}
                                                    alt={person.firstName}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span className="text-xl font-light opacity-90">
                                                    {person.gender === 'male' ? '♂' : '●'}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Name below shape */}
                                    <div className="text-center w-full px-1">
                                        {(scriptMode === 'latin' || scriptMode === 'both') && (
                                            <div className={`font-medium leading-tight text-stone-700 ${displayName.length > 25 ? 'text-[10px]' : displayName.length > 15 ? 'text-xs' : 'text-xs'
                                                }`}>
                                                {displayName}
                                            </div>
                                        )}
                                        {(scriptMode === 'lontara' || scriptMode === 'both') && lontaraFullName && (
                                            <div className="text-teal-700 font-lontara leading-tight text-[11px] mt-0.5">
                                                {lontaraFullName}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div >
    );
}

export default FamilyTree;
