// PUT /api/families/[id]/persons/positions — updateAllPersonPositions

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { updateAllPersonPositions } from '@/lib/services/persons';

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = await params;
        const { positions } = await request.json();

        // Convert plain object to Map
        const posMap = new Map<string, { x: number; y: number }>(
            Object.entries(positions)
        );
        await updateAllPersonPositions(id, posMap);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API] PUT positions error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
