// GET /api/families/[id]/membership — isFamilyMember

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isFamilyMember } from '@/lib/services/families';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = await params;
        const result = await isFamilyMember(id, session.user.id);
        return NextResponse.json({ isMember: result });
    } catch (error: any) {
        console.error('[API] GET /api/families/[id]/membership error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
