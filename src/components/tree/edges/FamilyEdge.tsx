'use client';

import React from 'react';
import { BaseEdge, type EdgeProps } from '@xyflow/react';

/**
 * FamilyEdge — Custom orthogonal edge for family tree parent→child connections.
 * 
 * Draws the classic genealogy "bracket" pattern:
 *   [Parent]
 *      |          ← vertical drop from source
 *   ───┼───       ← horizontal bar at midpoint
 *   |  |  |       
 *  [A][B][C]      ← vertical drop to each child
 * 
 * Path: source → down to midY → horizontal to target X → down to target
 * Uses rounded corners for a polished look.
 */
export default function FamilyEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    style = {},
}: EdgeProps) {
    // Midpoint Y between source and target (where the horizontal bar sits)
    // Place it 40% down from source for a natural look
    const midY = sourceY + (targetY - sourceY) * 0.4;

    // Corner radius for smooth turns
    const r = Math.min(8, Math.abs(targetX - sourceX) / 2, Math.abs(midY - sourceY) / 2, Math.abs(targetY - midY) / 2);

    // Build SVG path with rounded corners
    let path: string;

    const dx = targetX - sourceX;
    const absDx = Math.abs(dx);

    if (absDx < 2) {
        // Perfectly aligned — just a straight vertical line
        path = `M ${sourceX},${sourceY} L ${sourceX},${targetY}`;
    } else {
        // Direction of horizontal movement
        const signX = dx > 0 ? 1 : -1;

        // Path segments:
        // 1. Vertical down from source to (midY - r)
        // 2. Rounded corner turning horizontal
        // 3. Horizontal to (targetX ∓ r)
        // 4. Rounded corner turning vertical
        // 5. Vertical down to target

        const vertDrop1 = midY - sourceY - r;
        const vertDrop2 = targetY - midY - r;
        const horizSpan = absDx - 2 * r;

        if (vertDrop1 < 0 || vertDrop2 < 0 || horizSpan < 0) {
            // Not enough space for corners — use simpler path
            path = `M ${sourceX},${sourceY} L ${sourceX},${midY} L ${targetX},${midY} L ${targetX},${targetY}`;
        } else {
            path = [
                `M ${sourceX},${sourceY}`,
                // Vertical down
                `L ${sourceX},${midY - r}`,
                // Round corner: turn horizontal
                `Q ${sourceX},${midY} ${sourceX + signX * r},${midY}`,
                // Horizontal bar
                `L ${targetX - signX * r},${midY}`,
                // Round corner: turn vertical down
                `Q ${targetX},${midY} ${targetX},${midY + r}`,
                // Vertical down to target
                `L ${targetX},${targetY}`,
            ].join(' ');
        }
    }

    return (
        <BaseEdge
            id={id}
            path={path}
            style={{
                ...style,
                fill: 'none',
            }}
        />
    );
}
