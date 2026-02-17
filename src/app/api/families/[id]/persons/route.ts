// GET  /api/families/[id]/persons  — getAllPersons (viewer+)
// POST /api/families/[id]/persons  — createPerson (editor+)

import { NextRequest, NextResponse } from 'next/server';
import { getAllPersons, createPerson } from '@/lib/services/persons';
import { safeErrorResponse, requireRole, requireMember } from '@/lib/apiHelpers';
import { CreatePersonSchema, validateInput } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const authResult = await requireMember(id);
        if (!authResult.ok) return authResult.response;

        const persons = await getAllPersons(id);
        return NextResponse.json(persons);
    } catch (error) {
        return safeErrorResponse(error, 'Failed to load persons');
    }
}

export async function POST(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const authResult = await requireRole(id, 'editor');
        if (!authResult.ok) return authResult.response;

        const raw = await request.json();
        const validated = validateInput(CreatePersonSchema, raw);
        if (!validated.success) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }
        const person = await createPerson(id, validated.data, authResult.userId);
        return NextResponse.json(person, { status: 201 });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to create person');
    }
}
