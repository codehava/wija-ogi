// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Activity Log Service
// Logs actions performed on a family tree
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/db';
import { activities } from '@/db/schema';
import { ActivityAction } from '@/types';

interface LogActivityParams {
    treeId: string;
    action: ActivityAction;
    description: string;
    targetId?: string;
    targetType?: 'person' | 'relationship' | 'member' | 'family' | 'gedcom';
    performedBy: string;
    performedByName: string;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
    try {
        await db.insert(activities).values({
            treeId: params.treeId,
            action: params.action,
            description: params.description,
            targetId: params.targetId,
            targetType: params.targetType,
            performedBy: params.performedBy,
            performedByName: params.performedByName,
        });
    } catch (error) {
        // Activity logging should never break the main flow
        console.error('[activity] Failed to log activity:', error);
    }
}
