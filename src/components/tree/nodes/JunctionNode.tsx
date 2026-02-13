'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

/**
 * Invisible junction node placed at the midpoint between a couple.
 * Child edges connect FROM this junction node, creating the classic
 * family tree pattern where children hang from the couple's line.
 */
function JunctionNodeComponent({ }: NodeProps) {
    return (
        <div style={{ width: 1, height: 1, position: 'relative' }}>

            {/* Handle: top — receives the spouse connector line */}
            <Handle
                type="target"
                position={Position.Top}
                id="top"
                style={{ background: 'transparent', border: 'none', width: 1, height: 1, top: 0 }}
            />

            {/* Handle: left — connects to left spouse */}
            <Handle
                type="target"
                position={Position.Left}
                id="left"
                style={{ background: 'transparent', border: 'none', width: 1, height: 1, left: 0 }}
            />

            {/* Handle: right — sends edge to right spouse */}
            <Handle
                type="source"
                position={Position.Right}
                id="right"
                style={{ background: 'transparent', border: 'none', width: 1, height: 1, right: 0 }}
            />

            {/* Handle: bottom — children connect from here */}
            <Handle
                type="source"
                position={Position.Bottom}
                id="bottom"
                style={{ background: 'transparent', border: 'none', width: 1, height: 1, bottom: 0 }}
            />
        </div>
    );
}

export const JunctionNode = memo(JunctionNodeComponent);
