// POST /api/gedcom/import
// Upload and import a GEDCOM file into a new or existing tree

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { importGedcom } from '@/lib/services/gedcom';

export async function POST(request: NextRequest) {
    try {
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
        console.error('GEDCOM import error:', error);
        return NextResponse.json(
            { error: 'Failed to import GEDCOM file' },
            { status: 500 }
        );
    }
}
