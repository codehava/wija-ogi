// POST   /api/families/[id]/persons/[personId]/photo — uploadPersonPhoto (editor+)
// DELETE /api/families/[id]/persons/[personId]/photo — deletePersonPhoto (editor+)

import { NextRequest, NextResponse } from 'next/server';
import { uploadFile, deleteFile, getFileUrl, getPersonPhotoKey } from '@/lib/storage';
import { safeErrorResponse, requireRole } from '@/lib/apiHelpers';

type Params = { params: Promise<{ id: string; personId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
    try {
        const { id, personId } = await params;
        const authResult = await requireRole(id, 'editor');
        if (!authResult.ok) return authResult.response;

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
    } catch (error) {
        return safeErrorResponse(error, 'Failed to upload photo');
    }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    try {
        const { id, personId } = await params;
        const authResult = await requireRole(id, 'editor');
        if (!authResult.ok) return authResult.response;

        const key = getPersonPhotoKey(id, personId, 'photo.jpg');
        try { await deleteFile(key); } catch { /* ignore */ }

        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to delete photo');
    }
}
