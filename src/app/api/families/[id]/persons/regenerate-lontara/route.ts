// POST /api/families/[id]/persons/regenerate-lontara — regenerateAllLontaraNames

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { regenerateAllLontaraNames } from '@/lib/services/persons';
import { isFamilyMember } from '@/lib/services/families';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
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
        const count = await regenerateAllLontaraNames(id);
        return NextResponse.json({ count });
    } catch (error: any) {
        console.error('[API] POST regenerate-lontara error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
