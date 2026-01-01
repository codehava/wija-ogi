// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Type Definitions
// Based on WIJA Blueprint v5.0
// ═══════════════════════════════════════════════════════════════════════════════

import { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────────────────────
// CORE TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type Gender = 'male' | 'female' | 'other' | 'unknown';
export type MemberRole = 'superadmin' | 'owner' | 'admin' | 'editor' | 'viewer';
export type SubscriptionPlan = 'free' | 'basic' | 'premium' | 'enterprise';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'trial';
export type ScriptMode = 'latin' | 'lontara' | 'both';
export type ThemeMode = 'light' | 'dark' | 'auto';
export type Language = 'id' | 'en';
export type RelationshipType = 'spouse' | 'parent-child';
export type MarriageStatus = 'married' | 'divorced' | 'widowed';

// ─────────────────────────────────────────────────────────────────────────────────
// FAMILY DOCUMENT
// ─────────────────────────────────────────────────────────────────────────────────

export interface Family {
    familyId: string;
    name: string;                    // "Keluarga Budiman"
    displayName: string;             // "Budiman Family Tree"
    slug: string;                    // "keluarga-budiman"

    ownerId: string;
    rootAncestorId?: string;         // Starting point for generation calc

    subscription: {
        plan: SubscriptionPlan;
        status: SubscriptionStatus;
    };

    settings: {
        script: ScriptMode;
        theme: ThemeMode;
        language: Language;
    };

    // Stats (NO generationCount - calculated dynamically)
    stats: {
        memberCount: number;
        personCount: number;
        relationshipCount: number;
    };

    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PERSON DOCUMENT (NO GENERATION FIELD - Calculated at runtime)
// ─────────────────────────────────────────────────────────────────────────────────

export interface LatinName {
    first: string;
    middle?: string;
    last: string;
}

export interface LontaraName {
    first: string;               // AUTO from latinName
    middle?: string;
    last: string;
}

export interface Position {
    x: number;
    y: number;
    fixed: boolean;
}

export interface PersonRelationships {
    spouseIds: string[];
    parentIds: string[];         // Max 2
    childIds: string[];
    siblingIds: string[];        // Computed
}

export interface Person {
    personId: string;
    familyId: string;

    // ══════════════════════════════════════════════════════════
    // DUAL NAME SUPPORT
    // ══════════════════════════════════════════════════════════

    firstName: string;
    middleName?: string;
    lastName: string;
    fullName: string;              // Computed

    // Auto-transliterated Lontara
    latinName: LatinName;
    lontaraName: LontaraName;

    // Optional manual override
    lontaraNameCustom?: Partial<LontaraName>;

    // ══════════════════════════════════════════════════════════
    // DEMOGRAPHICS
    // ══════════════════════════════════════════════════════════

    gender: Gender;
    birthDate?: string;            // YYYY-MM-DD
    birthPlace?: string;
    deathDate?: string;
    deathPlace?: string;
    isLiving: boolean;
    occupation?: string;
    biography?: string;

    // ══════════════════════════════════════════════════════════
    // RELATIONSHIPS (Replaces static generation)
    // ══════════════════════════════════════════════════════════

    relationships: PersonRelationships;
    isRootAncestor: boolean;       // Flag for generation calc

    // ══════════════════════════════════════════════════════════
    // VISUALIZATION
    // ══════════════════════════════════════════════════════════

    position: Position;
    photoUrl?: string;
    thumbnailUrl?: string;

    // Audit
    createdBy: string;
    createdAt: Timestamp;
    updatedBy: string;
    updatedAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RELATIONSHIP DOCUMENT
// ─────────────────────────────────────────────────────────────────────────────────

export interface MarriageDetails {
    date?: string;
    place?: string;
    placeLontara?: string;       // Auto-transliterated
    status: MarriageStatus;
}

export interface ParentChildDetails {
    biologicalParent: boolean;
}

export interface Relationship {
    relationshipId: string;
    familyId: string;

    type: RelationshipType;

    person1Id: string;             // Parent or spouse
    person2Id: string;             // Child or spouse

    marriage?: MarriageDetails;
    parentChild?: ParentChildDetails;

    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────────────────────────
// FAMILY MEMBER (User access to family)
// ─────────────────────────────────────────────────────────────────────────────────

export interface FamilyMember {
    memberId: string;
    userId: string;
    familyId: string;
    role: MemberRole;

    displayName: string;
    email: string;
    photoUrl?: string;

    linkedPersonId?: string;       // If linked to a Person in the tree

    joinedAt: Timestamp;
    invitedBy: string;
    lastActiveAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────────────────────────
// USER PROFILE (Global)
// ─────────────────────────────────────────────────────────────────────────────────

export interface UserProfile {
    userId: string;
    email: string;
    displayName: string;
    photoUrl?: string;

    // Preferences
    preferredScript: ScriptMode;
    preferredTheme: ThemeMode;
    preferredLanguage: Language;

    // Family memberships
    familyIds: string[];
    primaryFamilyId?: string;

    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────────────────────────
// INVITATION
// ─────────────────────────────────────────────────────────────────────────────────

export interface Invitation {
    invitationId: string;
    familyId: string;
    familyName: string;

    email: string;
    role: MemberRole;

    invitedBy: string;
    invitedByName: string;

    status: 'pending' | 'accepted' | 'declined' | 'expired';
    expiresAt: Timestamp;

    createdAt: Timestamp;
    respondedAt?: Timestamp;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ACTIVITY LOG
// ─────────────────────────────────────────────────────────────────────────────────

export type ActivityAction =
    | 'person_created'
    | 'person_updated'
    | 'person_deleted'
    | 'relationship_created'
    | 'relationship_deleted'
    | 'member_invited'
    | 'member_joined'
    | 'member_removed'
    | 'family_updated'
    | 'export_created';

export interface Activity {
    activityId: string;
    familyId: string;

    action: ActivityAction;
    description: string;

    targetId?: string;
    targetType?: 'person' | 'relationship' | 'member' | 'family';

    performedBy: string;
    performedByName: string;

    createdAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────────────────────────
// AUTH CUSTOM CLAIMS
// ─────────────────────────────────────────────────────────────────────────────────

export interface UserClaims {
    familyId: string;
    role: MemberRole;
    permissions: string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// TRANSLITERATION TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface TransliterationDetail {
    latin: string;
    lontara: string;
    type: 'consonant' | 'vowel' | 'cluster' | 'foreign' | 'punctuation' | 'number';
    note?: string;
}

export interface TransliterationResult {
    lontara: string;
    details: TransliterationDetail[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORT TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface ExportOptions {
    scope: 'full' | 'from_ancestor' | 'subtree';
    rootPersonId?: string;

    scriptOptions: {
        script: ScriptMode;
        lontaraPosition: 'below' | 'beside';
    };

    content: {
        includePhotos: boolean;
        includeDates: boolean;
        includeBiographies: boolean;
    };

    format: {
        paperSize: 'A4' | 'A3' | 'Letter';
        orientation: 'landscape' | 'portrait';
        quality: 'standard' | 'high';
    };
}

export interface ExportRecord {
    exportId: string;
    familyId: string;

    options: ExportOptions;
    status: 'pending' | 'processing' | 'completed' | 'failed';

    downloadUrl?: string;
    expiresAt?: Timestamp;

    requestedBy: string;
    createdAt: Timestamp;
    completedAt?: Timestamp;
}

// ─────────────────────────────────────────────────────────────────────────────────
// INPUT/FORM TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface CreatePersonInput {
    firstName: string;
    middleName?: string;
    lastName: string;
    gender: Gender;
    birthDate?: string;
    birthPlace?: string;
    deathDate?: string;
    deathPlace?: string;
    isLiving: boolean;
    occupation?: string;
    biography?: string;
    isRootAncestor?: boolean;
}

export interface CreateFamilyInput {
    name: string;
    displayName?: string;
    settings?: Partial<Family['settings']>;
}

export interface CreateRelationshipInput {
    type: RelationshipType;
    person1Id: string;
    person2Id: string;
    marriage?: MarriageDetails;
    parentChild?: ParentChildDetails;
}
