// POST /api/invitations — createInvitation

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createInvitation } from '@/lib/services/invitations';

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const input = await request.json();
        const invitation = await createInvitation(input);
        return NextResponse.json(invitation, { status: 201 });
    } catch (error: any) {
        console.error('[API] POST /api/invitations error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
