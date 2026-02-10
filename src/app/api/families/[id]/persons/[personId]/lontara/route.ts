// PATCH /api/families/[id]/persons/[personId]/lontara — setCustomLontaraName

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { setCustomLontaraName } from '@/lib/services/persons';
import { isFamilyMember } from '@/lib/services/families';

type Params = { params: Promise<{ id: string; personId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id, personId } = await params;
        const isMember = await isFamilyMember(id, session.user.id);
        if (!isMember) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const customName = await request.json();
        await setCustomLontaraName(id, personId, customName);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API] PATCH lontara error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
