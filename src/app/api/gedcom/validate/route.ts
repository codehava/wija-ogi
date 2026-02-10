// POST /api/gedcom/validate
// Validate a GEDCOM file and return summary without importing

import { NextRequest, NextResponse } from 'next/server';
import { validateGedcom } from '@/lib/services/gedcom';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        if (!file.name.toLowerCase().endsWith('.ged')) {
            return NextResponse.json({ error: 'File must be a .ged file' }, { status: 400 });
        }

        const content = await file.text();

        if (!content.trim()) {
            return NextResponse.json({
                valid: false,
                summary: { totalRecords: 0, persons: 0, families: 0, sources: 0 },
                error: 'File is empty',
            }, { status: 400 });
        }

        const result = validateGedcom(content);
        return NextResponse.json(result);
    } catch (error) {
        console.error('GEDCOM validate error:', error);
        return NextResponse.json(
            {
                valid: false,
                summary: { totalRecords: 0, persons: 0, families: 0, sources: 0 },
                error: 'Invalid GEDCOM format',
            },
            { status: 400 }
        );
    }
}
