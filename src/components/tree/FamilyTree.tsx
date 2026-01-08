// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Family Tree Component
// Professional tree layout using dagre algorithm
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';

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
    familyId?: string; // Required to save positions
    onPositionChange?: (personId: string, position: { x: number; y: number }) => void;
    onAllPositionsChange?: (positions: Map<string, { x: number; y: number }>) => void; // Save all positions at once
}

// Layout constants
const NODE_WIDTH = 220;
const NODE_HEIGHT = 130;
const CANVAS_PADDING = 150; // Padding around the tree

interface NodePosition {
    x: number;
    y: number;
}

// Calculate layout using custom algorithm with dagre
import { calculateTreeLayout } from '@/lib/layout/treeLayout';


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

    // Node positions (can be dragged)
    const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(new Map());
    const [isInitialized, setIsInitialized] = useState(false);

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

    // Calculate layout using dagre (only for persons without saved positions)
    const calculatedPositions = useMemo(() => {
        return calculateTreeLayout(persons, collapsedIds, relationships);
    }, [persons, collapsedIds, relationships]);

    // Initialize positions on first load - prefer saved positions from Firestore
    useEffect(() => {
        if (!isInitialized && persons.length > 0) {
            const initialMap = new Map<string, NodePosition>();

            // Check if most persons have saved positions (meaning tree was arranged before)
            // Use position.fixed flag - set to true when user manually drags a node
            const personsWithSavedPos = persons.filter(p =>
                p.position && p.position.fixed === true
            );

            const useSavedPositions = personsWithSavedPos.length > 0; // If any person has fixed position, use saved positions

            persons.forEach(p => {
                if (useSavedPositions && savedPositions.has(p.personId)) {
                    // Use saved position from Firestore
                    initialMap.set(p.personId, savedPositions.get(p.personId)!);
                } else {
                    // Use calculated position from dagre for new or first-time load
                    const calcPos = calculatedPositions.get(p.personId);
                    if (calcPos) {
                        initialMap.set(p.personId, calcPos);
                    }
                }
            });

            if (initialMap.size > 0) {
                setNodePositions(initialMap);
                setIsInitialized(true);
            }
        }
    }, [persons, savedPositions, calculatedPositions, isInitialized]);

    // Update positions when new persons are added (use dagre for new persons only)
    useEffect(() => {
        if (!isInitialized) return;

        setNodePositions(prev => {
            const newMap = new Map(prev);
            let hasChange = false;
            persons.forEach(p => {
                if (!newMap.has(p.personId)) {
                    // New person - use saved position if available, otherwise dagre
                    const savedPos = savedPositions.get(p.personId);
                    const calcPos = calculatedPositions.get(p.personId);
                    const pos = savedPos || calcPos;
                    if (pos) {
                        newMap.set(p.personId, pos);
                        hasChange = true;
                    }
                }
            });
            return hasChange ? newMap : prev;
        });
    }, [persons, savedPositions, calculatedPositions, isInitialized]);

    // Get current positions
    const positions = useMemo(() => {
        if (nodePositions.size > 0) return nodePositions;
        return calculatedPositions;
    }, [nodePositions, calculatedPositions]);

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
                // Calculate connection points on node edges
                const y1 = leftPos.y + NODE_HEIGHT / 2;
                const y2 = rightPos.y + NODE_HEIGHT / 2;
                const x1 = leftPos.x + NODE_WIDTH;
                const x2 = rightPos.x;

                const gap = x2 - x1;
                const centerX = (x1 + x2) / 2;
                const centerY = (y1 + y2) / 2;

                // Control points for smooth bezier curve
                const controlOffset = Math.max(gap * 0.3, 20);

                // Draw spouse bezier line
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
        // Group children by their actual parent pairs (based on child's parentIds)
        const childrenByParentPair = new Map<string, string[]>();

        persons.forEach(person => {
            // Only process if this person is a child of someone
            if (person.relationships.parentIds.length > 0) {
                // Use the child's actual parentIds to create the key
                const parentKey = [...person.relationships.parentIds].sort().join('-');

                if (!childrenByParentPair.has(parentKey)) {
                    childrenByParentPair.set(parentKey, []);
                }
                const children = childrenByParentPair.get(parentKey)!;
                if (!children.includes(person.personId)) {
                    children.push(person.personId);
                }
            }
        });

        // Draw connections for each parent group
        childrenByParentPair.forEach((childIds, parentKey) => {
            const parentIds = parentKey.split('-');

            // Verify all parents exist in positions
            const validParentIds = parentIds.filter(pid => positions.has(pid) && personsMap.has(pid));
            if (validParentIds.length === 0) return;

            const firstParentPos = positions.get(validParentIds[0])!;

            // Find connector point
            let dropX: number;
            let dropStartY: number;

            if (validParentIds.length >= 2) {
                // Has two parents (couple)
                const coupleKey = validParentIds.slice(0, 2).sort().join('-');
                const connector = coupleConnectors.get(coupleKey);
                if (connector) {
                    dropX = connector.centerX;
                    dropStartY = connector.y;
                } else {
                    // Fallback: calculate center between the two parents
                    const parent2Pos = positions.get(validParentIds[1]);
                    if (parent2Pos) {
                        dropX = (firstParentPos.x + parent2Pos.x + NODE_WIDTH) / 2;
                        dropStartY = Math.max(firstParentPos.y, parent2Pos.y) + NODE_HEIGHT;
                    } else {
                        dropX = firstParentPos.x + NODE_WIDTH / 2;
                        dropStartY = firstParentPos.y + NODE_HEIGHT;
                    }
                }
            } else {
                // Single parent
                dropX = firstParentPos.x + NODE_WIDTH / 2;
                dropStartY = firstParentPos.y + NODE_HEIGHT;
            }

            // Get valid children positions
            const validChildren = childIds
                .map(id => ({ id, pos: positions.get(id) }))
                .filter(c => c.pos !== undefined)
                .sort((a, b) => a.pos!.x - b.pos!.x);

            if (validChildren.length === 0) return;

            // For each child, draw a smooth bezier curve from parent drop point
            validChildren.forEach(child => {
                const childCenterX = child.pos!.x + NODE_WIDTH / 2;
                const childTop = child.pos!.y;

                // Create smooth S-curve using cubic bezier
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

    // Canvas size - dynamically calculated based on actual node positions
    const canvasSize = useMemo(() => {
        if (positions.size === 0) {
            return { width: 800, height: 600 };
        }

        let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
        positions.forEach(pos => {
            minX = Math.min(minX, pos.x);
            minY = Math.min(minY, pos.y);
            maxX = Math.max(maxX, pos.x + NODE_WIDTH);
            maxY = Math.max(maxY, pos.y + NODE_HEIGHT);
        });

        // Add padding around the tree for comfortable viewing
        const width = maxX + CANVAS_PADDING * 2;
        const height = maxY + CANVAS_PADDING * 2;

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

    // Mouse wheel zoom handler
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(z => Math.max(0.05, Math.min(3, z + delta)));
    }, []);

    // Auto arrange using dagre - with visual feedback
    const [isArranging, setIsArranging] = useState(false);

    const handleAutoArrange = useCallback(() => {
        setIsArranging(true);

        // Small delay for visual feedback
        setTimeout(() => {
            const newPositions = calculateTreeLayout(persons, collapsedIds, relationships);
            console.log('Auto arrange: Updated positions for', newPositions.size, 'nodes');
            setNodePositions(new Map(newPositions));
            setPan({ x: 0, y: 0 });
            setZoom(1);
            setIsArranging(false);
        }, 500);
    }, [persons, collapsedIds, relationships]);

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
            {/* All Controls - Left Side (won't shift when sidebar appears) */}
            <div className="absolute top-4 left-4 z-30 flex gap-2 print:hidden">
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

            {/* Info */}
            <div className="absolute bottom-4 left-4 z-30 text-xs bg-white/90 px-3 py-2 rounded-lg shadow border border-stone-200">
                <div className="text-stone-600 font-medium">{Math.round(zoom * 100)}% • {persons.length} anggota</div>
                <div className="text-stone-400">Scroll = zoom • Drag canvas = pan • Drag node = geser</div>
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
                onWheel={handleWheel}
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
                            male: { bg: 'bg-blue-50', border: 'border-blue-400', textColor: 'text-blue-900' },
                            female: { bg: 'bg-pink-50', border: 'border-pink-400', textColor: 'text-pink-900' },
                            other: { bg: 'bg-purple-50', border: 'border-purple-400', textColor: 'text-purple-900' },
                            unknown: { bg: 'bg-gray-50', border: 'border-gray-400', textColor: 'text-gray-900' }
                        };
                        const style = genderStyles[person.gender] || genderStyles.unknown;
                        // Build full name from components
                        const displayName = [person.firstName, person.middleName, person.lastName]
                            .filter(Boolean).join(' ') || person.fullName || person.firstName;
                        const isSelected = person.personId === selectedPersonId;
                        const isDragging = draggingNode === person.personId;
                        const shapeSize = 50;

                        // Render gender shape
                        const renderShape = () => {
                            if (person.gender === 'female') {
                                // Inverted Triangle for female
                                return (
                                    <div className="relative flex-shrink-0" style={{ width: shapeSize, height: shapeSize }}>
                                        <svg width={shapeSize} height={shapeSize} viewBox="0 0 50 50" className="drop-shadow-md">
                                            <polygon
                                                points="25,45 5,10 45,10"
                                                fill="#ec4899"
                                                stroke="#db2777"
                                                strokeWidth="2"
                                            />
                                        </svg>
                                    </div>
                                );
                            } else {
                                // Circle for male (and other/unknown)
                                const bgColor = person.gender === 'male' ? 'bg-blue-500 border-blue-600' :
                                    person.gender === 'other' ? 'bg-purple-500 border-purple-600' :
                                        'bg-gray-500 border-gray-600';
                                return (
                                    <div
                                        className={`rounded-full flex-shrink-0 border-2 flex items-center justify-center text-white text-lg drop-shadow-md ${bgColor}`}
                                        style={{ width: shapeSize, height: shapeSize }}
                                    >
                                        {person.gender === 'male' ? '♂' : '●'}
                                    </div>
                                );
                            }
                        };

                        return (
                            <div
                                key={person.personId}
                                className={`tree-node absolute select-none transition-shadow ${isDragging ? 'z-50 shadow-2xl cursor-grabbing' : 'z-10 cursor-grab'} ${isSelected ? 'ring-4 ring-teal-400 ring-offset-2' : ''}`}
                                style={{ left: pos.x, top: pos.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
                                onMouseDown={(e) => handleNodeMouseDown(e, person.personId)}
                            >
                                {/* Horizontal layout: Shape on left, text on right */}
                                <div className={`${style.bg} ${style.border} border-2 rounded-xl p-3 h-full shadow-md hover:shadow-lg transition-all flex items-center gap-3`}>
                                    {/* Gender Shape */}
                                    {renderShape()}

                                    {/* Names beside shape */}
                                    <div className="flex-1 min-w-0 overflow-hidden">
                                        {(scriptMode === 'latin' || scriptMode === 'both') && (
                                            <div className={`text-sm font-semibold leading-tight break-words ${style.textColor || 'text-stone-800'}`}>
                                                {displayName}
                                            </div>
                                        )}
                                        {(scriptMode === 'lontara' || scriptMode === 'both') && person.lontaraName && (
                                            <div className="text-lg text-teal-700 font-lontara leading-relaxed mt-0.5">
                                                {[person.lontaraName.first, person.lontaraName.middle, person.lontaraName.last]
                                                    .filter(Boolean)
                                                    .join(' ')}
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
