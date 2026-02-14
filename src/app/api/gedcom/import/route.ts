// POST /api/gedcom/import
// Upload and import a GEDCOM file into a new or existing tree

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { importGedcom } from '@/lib/services/gedcom';
import { safeErrorResponse, applyRateLimit } from '@/lib/apiHelpers';
import { RATE_LIMITS } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
    try {
        // Rate limit: 5 uploads per minute
        const rateLimited = applyRateLimit(request, RATE_LIMITS.UPLOAD);
        if (rateLimited) return rateLimited;

        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const treeName = (formData.get('treeName') as string) || 'Imported Tree';
        const existingTreeId = formData.get('treeId') as string | null;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        // M2 FIX: Limit file size to 10MB
        const MAX_GEDCOM_SIZE = 10 * 1024 * 1024; // 10MB
        if (file.size > MAX_GEDCOM_SIZE) {
            return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 413 });
        }

        // Validate file extension
        if (!file.name.toLowerCase().endsWith('.ged')) {
            return NextResponse.json({ error: 'File must be a .ged file' }, { status: 400 });
        }

        // Read file content
        const content = await file.text();

        if (!content.trim()) {
            return NextResponse.json({ error: 'File is empty' }, { status: 400 });
        }

        const result = await importGedcom(
            content,
            session.user.id,
            treeName,
            existingTreeId || undefined
        );

        return NextResponse.json({
            message: 'GEDCOM imported successfully',
            ...result,
        });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to import GEDCOM file');
    }
}
