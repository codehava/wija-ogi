// GET    /api/families/[id]  — getFamily
// PATCH  /api/families/[id]  — updateFamily
// DELETE /api/families/[id]  — deleteFamily

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getFamily, updateFamily, deleteFamily, isFamilyMember } from '@/lib/services/families';
import { safeErrorResponse } from '@/lib/apiHelpers';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = await params;
        const isMember = await isFamilyMember(id, session.user.id);
        if (!isMember) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const family = await getFamily(id);
        if (!family) {
            return NextResponse.json({ error: 'Family not found' }, { status: 404 });
        }
        return NextResponse.json(family);
    } catch (error) {
        return safeErrorResponse(error, 'Failed to load family');
    }
}

export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = await params;
        const isMember = await isFamilyMember(id, session.user.id);
        if (!isMember) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const updates = await request.json();
        await updateFamily(id, updates);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to update family');
    }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = await params;
        const isMember = await isFamilyMember(id, session.user.id);
        if (!isMember) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        await deleteFamily(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to delete family');
    }
}
