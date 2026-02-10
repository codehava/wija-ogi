// GET /api/families/[id]/members — getFamilyMembers

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getFamilyMembers } from '@/lib/services/families';

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
    } catch (error: any) {
        console.error('[API] GET /api/families/[id]/members error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
