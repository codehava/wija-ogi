// GET /api/families/[id]/role — getUserRole (viewer+)

import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/services/families';
import { auth } from '@/auth';
import { safeErrorResponse } from '@/lib/apiHelpers';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = await params;
        const role = await getUserRole(id, session.user.id);
        if (!role) {
            return NextResponse.json({ error: 'Not a member' }, { status: 403 });
        }
        return NextResponse.json({ role });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to get role');
    }
}
