// GET  /api/families/[id]/persons  — getAllPersons
// POST /api/families/[id]/persons  — createPerson

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAllPersons, createPerson } from '@/lib/services/persons';
import { isFamilyMember } from '@/lib/services/families';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = await params;
        const persons = await getAllPersons(id);
        return NextResponse.json(persons);
    } catch (error: any) {
        console.error('[API] GET /api/families/[id]/persons error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: Params) {
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
        const input = await request.json();
        const person = await createPerson(id, input, session.user.id);
        return NextResponse.json(person, { status: 201 });
    } catch (error: any) {
        console.error('[API] POST /api/families/[id]/persons error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
