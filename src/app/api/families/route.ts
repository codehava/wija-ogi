// GET  /api/families       — getUserFamilies
// POST /api/families       — createFamily

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserFamilies, createFamily } from '@/lib/services/families';
import { safeErrorResponse } from '@/lib/apiHelpers';
import { CreateFamilySchema, validateInput } from '@/lib/validation';
import type { CreateFamilyInput } from '@/types';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const families = await getUserFamilies(session.user.id);
        return NextResponse.json(families);
    } catch (error) {
        return safeErrorResponse(error, 'Failed to load families');
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const raw = await request.json();
        const validated = validateInput(CreateFamilySchema, raw);
        if (!validated.success) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }
        const family = await createFamily(validated.data as CreateFamilyInput, session.user.id);
        return NextResponse.json(family, { status: 201 });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to create family');
    }
}
