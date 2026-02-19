'use client';

import React from 'react';
import { type EdgeProps, BaseEdge } from '@xyflow/react';

/**
 * BusBarEdge — Orthogonal connector for family trees
 *
 * Draws a clean right-angle path from parent to child:
 *   Parent (bottom)
 *      │
 *      ├─────────────  (horizontal bar at midpoint Y)
 *      │
 *   Child (top)
 *
 * When multiple children share the same parent/junction,
 * the horizontal segments visually merge into a "bus bar".
 */
export function BusBarEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    style = {},
    markerEnd,
}: EdgeProps) {
    // The bar sits at the midpoint between parent bottom and child top
    const midY = sourceY + (targetY - sourceY) * 0.4;

    // Orthogonal path: down → horizontal → down
    const path = `M ${sourceX} ${sourceY} L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;

    return (
        <BaseEdge
            id={id}
            path={path}
            style={{
                ...style,
                fill: 'none',
                strokeLinejoin: 'round',
            }}
            markerEnd={markerEnd}
        />
    );
}
