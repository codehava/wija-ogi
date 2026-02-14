// GET /api/families/[id]/members — getFamilyMembers

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getFamilyMembers } from '@/lib/services/families';
import { safeErrorResponse } from '@/lib/apiHelpers';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = await params;
        const members = await getFamilyMembers(id);
        return NextResponse.json(members);
    } catch (error) {
        return safeErrorResponse(error, 'Failed to load members');
    }
}
