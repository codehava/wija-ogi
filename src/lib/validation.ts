// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Zod Validation Schemas
// H4 FIX: Server-side input validation for all mutation endpoints
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// SHARED ENUMS
// ─────────────────────────────────────────────────────────────────────────────

export const GenderSchema = z.enum(['male', 'female', 'other', 'unknown']);
export const MemberRoleSchema = z.enum(['superadmin', 'owner', 'admin', 'editor', 'viewer']);
export const RelationshipTypeSchema = z.enum(['spouse', 'parent-child']);
export const MarriageStatusSchema = z.enum(['married', 'divorced', 'widowed']);
export const NobilityTitleSchema = z.enum(['datu', 'arung', 'karaeng', 'opu', 'andi', 'other']);
export const ScriptModeSchema = z.enum(['latin', 'lontara', 'both']);
export const ThemeModeSchema = z.enum(['light', 'dark', 'auto']);
export const LanguageSchema = z.enum(['id', 'en']);

// ─────────────────────────────────────────────────────────────────────────────
// PERSON SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

/** Validates date strings in YYYY-MM-DD format */
const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

export const CreatePersonSchema = z.object({
    firstName: z.string().min(1, 'First name is required').max(100).trim(),
    middleName: z.string().max(100).trim().optional(),
    lastName: z.string().min(1, 'Last name is required').max(100).trim(),
    gender: GenderSchema,
    birthDate: DateStringSchema.optional(),
    birthPlace: z.string().max(200).trim().optional(),
    birthOrder: z.number().int().min(1).max(50).optional(),
    deathDate: DateStringSchema.optional(),
    deathPlace: z.string().max(200).trim().optional(),
    isLiving: z.boolean().default(true),
    occupation: z.string().max(200).trim().optional(),
    title: NobilityTitleSchema.optional(),
    reignTitle: z.string().max(200).trim().optional(),
    biography: z.string().max(5000).trim().optional(),
    isRootAncestor: z.boolean().optional(),
});

export const UpdatePersonSchema = CreatePersonSchema.partial();

// ─────────────────────────────────────────────────────────────────────────────
// FAMILY SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const CreateFamilySchema = z.object({
    name: z.string().min(1, 'Family name is required').max(200).trim(),
    displayName: z.string().max(200).trim().optional(),
    settings: z.object({
        script: ScriptModeSchema,
        theme: ThemeModeSchema,
        language: LanguageSchema,
    }).partial().optional(),
});

export const UpdateFamilySchema = CreateFamilySchema.partial();

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONSHIP SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const MarriageDetailsSchema = z.object({
    date: DateStringSchema.optional(),
    place: z.string().max(200).trim().optional(),
    placeLontara: z.string().max(200).trim().optional(),
    status: MarriageStatusSchema,
    marriageOrder: z.number().int().min(1).max(10).optional(),
});

export const ParentChildDetailsSchema = z.object({
    biologicalParent: z.boolean(),
});

export const CreateRelationshipSchema = z.object({
    type: RelationshipTypeSchema,
    person1Id: z.string().uuid('Invalid person1 ID'),
    person2Id: z.string().uuid('Invalid person2 ID'),
    marriage: MarriageDetailsSchema.optional(),
    parentChild: ParentChildDetailsSchema.optional(),
}).refine(
    (data) => data.person1Id !== data.person2Id,
    { message: 'Cannot create a relationship with self' }
);

// ─────────────────────────────────────────────────────────────────────────────
// INVITATION SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const CreateInvitationSchema = z.object({
    familyId: z.string().uuid('Invalid family ID'),
    email: z.string().email('Invalid email address').max(254),
    role: MemberRoleSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// MEMBER SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const UpdateMemberRoleSchema = z.object({
    role: MemberRoleSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate input against a Zod schema.
 * Returns { success: true, data } or { success: false, error: string }.
 */
export function validateInput<T>(
    schema: z.ZodType<T>,
    data: unknown
): { success: true; data: T } | { success: false; error: string } {
    const result = schema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    const messages = result.error.issues.map((i) => i.message).join(', ');
    return { success: false, error: messages };
}
