// GET  /api/families/[id]/persons  — getAllPersons
// POST /api/families/[id]/persons  — createPerson

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAllPersons, createPerson } from '@/lib/services/persons';
import { isFamilyMember } from '@/lib/services/families';
import { safeErrorResponse } from '@/lib/apiHelpers';
import { CreatePersonSchema, validateInput } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
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
        const persons = await getAllPersons(id);
        return NextResponse.json(persons);
    } catch (error) {
        return safeErrorResponse(error, 'Failed to load persons');
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
        const raw = await request.json();
        const validated = validateInput(CreatePersonSchema, raw);
        if (!validated.success) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }
        const person = await createPerson(id, validated.data, session.user.id);
        return NextResponse.json(person, { status: 201 });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to create person');
    }
}
