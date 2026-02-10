// POST   /api/families/[id]/persons/[personId]/photo — uploadPersonPhoto
// DELETE /api/families/[id]/persons/[personId]/photo — deletePersonPhoto

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { uploadFile, deleteFile, getFileUrl, getPersonPhotoKey } from '@/lib/storage';
import { isFamilyMember } from '@/lib/services/families';

type Params = { params: Promise<{ id: string; personId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id, personId } = await params;
        const isMember = await isFamilyMember(id, session.user.id);
        if (!isMember) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }
        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
        }
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const key = getPersonPhotoKey(id, personId, file.name);
        await uploadFile(key, new Uint8Array(buffer), file.type);
        const photoUrl = await getFileUrl(key);

        return NextResponse.json({ photoUrl, thumbnailUrl: photoUrl });
    } catch (error: any) {
        console.error('[API] POST photo error:', error);
        return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id, personId } = await params;

        const key = getPersonPhotoKey(id, personId, 'photo.jpg');
        try { await deleteFile(key); } catch { /* ignore */ }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API] DELETE photo error:', error);
        return NextResponse.json({ error: error.message || 'Delete failed' }, { status: 500 });
    }
}
