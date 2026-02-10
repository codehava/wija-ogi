// POST /api/invitations/check — isEmailAlreadyInvited

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isEmailAlreadyInvited } from '@/lib/services/invitations';

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { familyId, email } = await request.json();
        const isInvited = await isEmailAlreadyInvited(familyId, email);
        return NextResponse.json({ isInvited });
    } catch (error: any) {
        console.error('[API] POST /api/invitations/check error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
