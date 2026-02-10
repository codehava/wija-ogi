// GET /api/gedcom/export/[treeId]
// Export a tree as a GEDCOM 7.0 file download

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { exportGedcom } from '@/lib/services/gedcom';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ treeId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { treeId } = await params;

        const gedcomContent = await exportGedcom(treeId);

        return new NextResponse(gedcomContent, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Disposition': `attachment; filename="family-tree-${treeId}.ged"`,
            },
        });
    } catch (error) {
        console.error('GEDCOM export error:', error);

        if (error instanceof Error && error.message === 'Tree not found') {
            return NextResponse.json({ error: 'Tree not found' }, { status: 404 });
        }

        return NextResponse.json(
            { error: 'Failed to export GEDCOM' },
            { status: 500 }
        );
    }
}
