// PATCH /api/families/[id]/persons/[personId]/position — updatePersonPosition

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { updatePersonPosition } from '@/lib/services/persons';

type Params = { params: Promise<{ id: string; personId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id, personId } = await params;
        const position = await request.json();
        await updatePersonPosition(id, personId, position);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API] PATCH position error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
