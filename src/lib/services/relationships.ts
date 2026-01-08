// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Relationships Service
// Firestore CRUD operations for Relationship documents
// ═══════════════════════════════════════════════════════════════════════════════

import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    serverTimestamp,
    Timestamp,
    onSnapshot,
    Unsubscribe
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Relationship, CreateRelationshipInput, MarriageDetails } from '@/types';
import { transliterateLatin } from '@/lib/transliteration/engine';
import { updateFamilyStats, getFamily } from './families';
import { addSpouse, addParentChild, removeSpouse, removeParentChild } from './persons';

// ─────────────────────────────────────────────────────────────────────────────────
// COLLECTION REFERENCES
// ─────────────────────────────────────────────────────────────────────────────────

export const getRelationshipsCollection = (familyId: string) =>
    collection(db, 'families', familyId, 'relationships');

export const getRelationshipRef = (familyId: string, relationshipId: string) =>
    doc(db, 'families', familyId, 'relationships', relationshipId);

// ─────────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a new relationship
 */
export async function createRelationship(
    familyId: string,
    input: CreateRelationshipInput
): Promise<Relationship> {
    const relationshipsRef = getRelationshipsCollection(familyId);
    const relationshipRef = doc(relationshipsRef);
    const relationshipId = relationshipRef.id;

    // Build relationship data without undefined fields
    const relationshipData: Record<string, any> = {
        relationshipId,
        familyId,
        type: input.type,
        person1Id: input.person1Id,
        person2Id: input.person2Id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    // Only add marriage details if provided
    if (input.marriage) {
        const marriageDetails: Record<string, any> = {
            status: input.marriage.status || 'married'
        };
        if (input.marriage.date) marriageDetails.date = input.marriage.date;
        if (input.marriage.place) {
            marriageDetails.place = input.marriage.place;
            marriageDetails.placeLontara = transliterateLatin(input.marriage.place).lontara;
        }
        if (input.marriage.marriageOrder) marriageDetails.marriageOrder = input.marriage.marriageOrder;
        relationshipData.marriage = marriageDetails;
    }

    // Only add parentChild details if provided
    if (input.parentChild) {
        relationshipData.parentChild = input.parentChild;
    }

    await setDoc(relationshipRef, relationshipData);

    // Update persons' relationship arrays
    if (input.type === 'spouse') {
        await addSpouse(familyId, input.person1Id, input.person2Id);
    } else if (input.type === 'parent-child') {
        await addParentChild(familyId, input.person1Id, input.person2Id);
    }

    // Update family stats
    const family = await getFamily(familyId);
    if (family) {
        await updateFamilyStats(familyId, {
            relationshipCount: family.stats.relationshipCount + 1
        });
    }

    return relationshipData as Relationship;
}

/**
 * Create spouse relationship
 */
export async function createSpouseRelationship(
    familyId: string,
    person1Id: string,
    person2Id: string,
    marriage?: Omit<MarriageDetails, 'placeLontara'>
): Promise<Relationship> {
    return createRelationship(familyId, {
        type: 'spouse',
        person1Id,
        person2Id,
        marriage: marriage as MarriageDetails
    });
}

/**
 * Create parent-child relationship
 */
export async function createParentChildRelationship(
    familyId: string,
    parentId: string,
    childId: string,
    biologicalParent: boolean = true
): Promise<Relationship> {
    return createRelationship(familyId, {
        type: 'parent-child',
        person1Id: parentId,
        person2Id: childId,
        parentChild: { biologicalParent }
    });
}

// ─────────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get a relationship by ID
 */
export async function getRelationship(
    familyId: string,
    relationshipId: string
): Promise<Relationship | null> {
    const docSnap = await getDoc(getRelationshipRef(familyId, relationshipId));

    if (docSnap.exists()) {
        return docSnap.data() as Relationship;
    }

    return null;
}

/**
 * Get all relationships in a family
 */
export async function getAllRelationships(familyId: string): Promise<Relationship[]> {
    const snapshot = await getDocs(getRelationshipsCollection(familyId));
    return snapshot.docs.map(doc => doc.data() as Relationship);
}

/**
 * Get relationships by type
 */
export async function getRelationshipsByType(
    familyId: string,
    type: 'spouse' | 'parent-child'
): Promise<Relationship[]> {
    const q = query(
        getRelationshipsCollection(familyId),
        where('type', '==', type)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Relationship);
}

/**
 * Get all spouse relationships
 */
export async function getSpouseRelationships(familyId: string): Promise<Relationship[]> {
    return getRelationshipsByType(familyId, 'spouse');
}

/**
 * Get all parent-child relationships
 */
export async function getParentChildRelationships(familyId: string): Promise<Relationship[]> {
    return getRelationshipsByType(familyId, 'parent-child');
}

/**
 * Get relationships for a specific person
 */
export async function getPersonRelationships(
    familyId: string,
    personId: string
): Promise<Relationship[]> {
    const allRelationships = await getAllRelationships(familyId);

    return allRelationships.filter(
        r => r.person1Id === personId || r.person2Id === personId
    );
}

/**
 * Find relationship between two persons
 */
export async function findRelationshipBetween(
    familyId: string,
    person1Id: string,
    person2Id: string
): Promise<Relationship | null> {
    const allRelationships = await getAllRelationships(familyId);

    return allRelationships.find(
        r => (r.person1Id === person1Id && r.person2Id === person2Id) ||
            (r.person1Id === person2Id && r.person2Id === person1Id)
    ) || null;
}

/**
 * Subscribe to relationships changes (real-time)
 */
export function subscribeToRelationships(
    familyId: string,
    onUpdate: (relationships: Relationship[]) => void,
    onError?: (error: Error) => void
): Unsubscribe {
    const relationshipsRef = getRelationshipsCollection(familyId);

    return onSnapshot(
        relationshipsRef,
        (snapshot) => {
            const relationships = snapshot.docs.map(doc => doc.data() as Relationship);
            onUpdate(relationships);
        },
        (error) => {
            if (onError) onError(error);
        }
    );
}

// ─────────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Update a relationship
 */
export async function updateRelationship(
    familyId: string,
    relationshipId: string,
    updates: Partial<Omit<Relationship, 'relationshipId' | 'familyId' | 'createdAt'>>
): Promise<void> {
    const relationshipRef = getRelationshipRef(familyId, relationshipId);

    // Auto-transliterate marriage place if updated
    if (updates.marriage?.place) {
        updates.marriage = {
            ...updates.marriage,
            placeLontara: transliterateLatin(updates.marriage.place).lontara
        };
    }

    await updateDoc(relationshipRef, {
        ...updates,
        updatedAt: serverTimestamp()
    });
}

/**
 * Update marriage details
 */
export async function updateMarriageDetails(
    familyId: string,
    relationshipId: string,
    marriage: Partial<MarriageDetails>
): Promise<void> {
    const relationship = await getRelationship(familyId, relationshipId);
    if (!relationship) throw new Error('Relationship not found');
    if (relationship.type !== 'spouse') throw new Error('Not a spouse relationship');

    const updatedMarriage: MarriageDetails = {
        ...relationship.marriage,
        ...marriage,
        status: marriage.status || relationship.marriage?.status || 'married',
        placeLontara: marriage.place
            ? transliterateLatin(marriage.place).lontara
            : relationship.marriage?.placeLontara
    };

    await updateRelationship(familyId, relationshipId, { marriage: updatedMarriage });
}

// ─────────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Delete a relationship
 */
export async function deleteRelationship(
    familyId: string,
    relationshipId: string
): Promise<void> {
    const relationship = await getRelationship(familyId, relationshipId);
    if (!relationship) return;

    // Remove from persons' relationship arrays
    if (relationship.type === 'spouse') {
        await removeSpouse(familyId, relationship.person1Id, relationship.person2Id);
    } else if (relationship.type === 'parent-child') {
        await removeParentChild(familyId, relationship.person1Id, relationship.person2Id);
    }

    // Delete the relationship document
    await deleteDoc(getRelationshipRef(familyId, relationshipId));

    // Update family stats
    const family = await getFamily(familyId);
    if (family) {
        await updateFamilyStats(familyId, {
            relationshipCount: Math.max(0, family.stats.relationshipCount - 1)
        });
    }
}

/**
 * Delete all relationships for a person
 */
export async function deletePersonRelationships(
    familyId: string,
    personId: string
): Promise<void> {
    const relationships = await getPersonRelationships(familyId, personId);

    for (const relationship of relationships) {
        await deleteRelationship(familyId, relationship.relationshipId);
    }
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if two persons are already spouses
 */
export async function areSpouses(
    familyId: string,
    person1Id: string,
    person2Id: string
): Promise<boolean> {
    const relationship = await findRelationshipBetween(familyId, person1Id, person2Id);
    return relationship?.type === 'spouse';
}

/**
 * Check if person1 is parent of person2
 */
export async function isParentOf(
    familyId: string,
    parentId: string,
    childId: string
): Promise<boolean> {
    const relationships = await getParentChildRelationships(familyId);
    return relationships.some(
        r => r.person1Id === parentId && r.person2Id === childId
    );
}

/**
 * Check if person1 is child of person2
 */
export async function isChildOf(
    familyId: string,
    childId: string,
    parentId: string
): Promise<boolean> {
    return isParentOf(familyId, parentId, childId);
}

/**
 * Validate relationship (prevent invalid relationships)
 */
export async function canCreateRelationship(
    familyId: string,
    type: 'spouse' | 'parent-child',
    person1Id: string,
    person2Id: string
): Promise<{ valid: boolean; error?: string }> {
    // Same person check
    if (person1Id === person2Id) {
        return { valid: false, error: 'Cannot create relationship with same person' };
    }

    // Already related check
    const existingRelationship = await findRelationshipBetween(familyId, person1Id, person2Id);
    if (existingRelationship) {
        return {
            valid: false,
            error: `These persons already have a ${existingRelationship.type} relationship`
        };
    }

    return { valid: true };
}
