// GET  /api/families       — getUserFamilies
// POST /api/families       — createFamily

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserFamilies, createFamily } from '@/lib/services/families';
import type { CreateFamilyInput } from '@/types';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const families = await getUserFamilies(session.user.id);
        return NextResponse.json(families);
    } catch (error: any) {
        console.error('[API] GET /api/families error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const input: CreateFamilyInput = await request.json();
        const family = await createFamily(input, session.user.id);
        return NextResponse.json(family, { status: 201 });
    } catch (error: any) {
        console.error('[API] POST /api/families error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
