// GET /api/families/[id]/members — getFamilyMembers (viewer+)

import { NextRequest, NextResponse } from 'next/server';
import { getFamilyMembers } from '@/lib/services/families';
import { safeErrorResponse, requireMember } from '@/lib/apiHelpers';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const authResult = await requireMember(id);
        if (!authResult.ok) return authResult.response;

        const members = await getFamilyMembers(id);
        return NextResponse.json(members);
    } catch (error) {
        return safeErrorResponse(error, 'Failed to load members');
    }
}
