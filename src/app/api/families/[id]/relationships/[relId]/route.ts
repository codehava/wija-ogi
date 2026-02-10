// PATCH  /api/families/[id]/relationships/[relId] — updateMarriageDetails
// DELETE /api/families/[id]/relationships/[relId] — deleteRelationship

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { updateMarriageDetails, deleteRelationship } from '@/lib/services/relationships';
import { isFamilyMember } from '@/lib/services/families';

type Params = { params: Promise<{ id: string; relId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id, relId } = await params;
        const isMember = await isFamilyMember(id, session.user.id);
        if (!isMember) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const details = await request.json();
        await updateMarriageDetails(id, relId, details);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API] PATCH relationship error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id, relId } = await params;
        const isMember = await isFamilyMember(id, session.user.id);
        if (!isMember) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        await deleteRelationship(id, relId);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API] DELETE relationship error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
