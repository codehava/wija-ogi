// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Persons Service
// Firestore CRUD operations for Person documents with auto-transliteration
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
    orderBy,
    serverTimestamp,
    Timestamp,
    onSnapshot,
    Unsubscribe
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Person, CreatePersonInput, LatinName, LontaraName } from '@/types';
import { transliterateLatin, transliterateName } from '@/lib/transliteration/engine';
import { updateFamilyStats, getFamily } from './families';

// ─────────────────────────────────────────────────────────────────────────────────
// COLLECTION REFERENCES
// ─────────────────────────────────────────────────────────────────────────────────

export const getPersonsCollection = (familyId: string) =>
    collection(db, 'families', familyId, 'persons');

export const getPersonRef = (familyId: string, personId: string) =>
    doc(db, 'families', familyId, 'persons', personId);

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER: Remove undefined values from object (Firestore doesn't accept undefined)
// ─────────────────────────────────────────────────────────────────────────────────

function removeUndefined(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const key in obj) {
        const value = obj[key];
        if (value === undefined) {
            continue;
        } else if (value !== null && typeof value === 'object' && !Array.isArray(value) && Object.prototype.toString.call(value) !== '[object Date]' && !('seconds' in value)) {
            // Recursively clean nested objects (but not Timestamps or Dates)
            result[key] = removeUndefined(value);
        } else {
            result[key] = value;
        }
    }

    return result;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a new person with auto-transliteration
 */
export async function createPerson(
    familyId: string,
    input: CreatePersonInput,
    userId: string
): Promise<Person> {
    const personsRef = getPersonsCollection(familyId);
    const personRef = doc(personsRef);
    const personId = personRef.id;

    // Build latin name object
    const latinName: LatinName = {
        first: input.firstName,
        middle: input.middleName || '',
        last: input.lastName || ''
    };

    // Auto-transliterate to Lontara
    const lontaraName = transliterateName(latinName);

    // Build full name
    const fullName = [input.firstName, input.middleName, input.lastName]
        .filter(Boolean)
        .join(' ');

    // Build person data - only include defined values
    const personData: Record<string, any> = {
        personId,
        familyId,
        firstName: input.firstName,
        fullName,
        latinName: removeUndefined(latinName),
        lontaraName: removeUndefined(lontaraName),
        gender: input.gender,
        isLiving: input.isLiving ?? true,
        relationships: {
            spouseIds: [],
            parentIds: [],
            childIds: [],
            siblingIds: []
        },
        isRootAncestor: input.isRootAncestor || false,
        position: {
            x: 100 + Math.random() * 400,
            y: 100 + Math.random() * 300,
            fixed: false
        },
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedBy: userId,
        updatedAt: serverTimestamp()
    };

    // Add optional fields only if defined
    if (input.middleName) personData.middleName = input.middleName;
    if (input.lastName) personData.lastName = input.lastName;
    if (input.birthDate) personData.birthDate = input.birthDate;
    if (input.birthPlace) personData.birthPlace = input.birthPlace;
    if (input.birthOrder) personData.birthOrder = input.birthOrder;
    if (input.deathDate) personData.deathDate = input.deathDate;
    if (input.deathPlace) personData.deathPlace = input.deathPlace;
    if (input.occupation) personData.occupation = input.occupation;
    if (input.biography) personData.biography = input.biography;

    await setDoc(personRef, personData);

    // Update family stats
    const family = await getFamily(familyId);
    if (family) {
        await updateFamilyStats(familyId, {
            personCount: family.stats.personCount + 1
        });

        // Set as root ancestor if first person or explicitly marked
        if (family.stats.personCount === 0 || input.isRootAncestor) {
            await updateDoc(doc(db, 'families', familyId), {
                rootAncestorId: personId
            });
        }
    }

    return personData as Person;
}

// ─────────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get a person by ID
 */
export async function getPerson(
    familyId: string,
    personId: string
): Promise<Person | null> {
    const docSnap = await getDoc(getPersonRef(familyId, personId));

    if (docSnap.exists()) {
        return docSnap.data() as Person;
    }

    return null;
}

/**
 * Get all persons in a family
 */
export async function getAllPersons(familyId: string): Promise<Person[]> {
    const snapshot = await getDocs(getPersonsCollection(familyId));
    return snapshot.docs.map(doc => doc.data() as Person);
}

/**
 * Get persons as a Map for efficient lookups
 */
export async function getPersonsMap(familyId: string): Promise<Map<string, Person>> {
    const persons = await getAllPersons(familyId);
    const map = new Map<string, Person>();
    persons.forEach(p => map.set(p.personId, p));
    return map;
}

/**
 * Subscribe to persons changes (real-time)
 */
export function subscribeToPersons(
    familyId: string,
    onUpdate: (persons: Person[]) => void,
    onError?: (error: Error) => void
): Unsubscribe {
    const personsRef = getPersonsCollection(familyId);

    return onSnapshot(
        personsRef,
        (snapshot) => {
            const persons = snapshot.docs.map(doc => doc.data() as Person);
            onUpdate(persons);
        },
        (error) => {
            if (onError) onError(error);
        }
    );
}

/**
 * Get root ancestor
 */
export async function getRootAncestor(familyId: string): Promise<Person | null> {
    const q = query(
        getPersonsCollection(familyId),
        where('isRootAncestor', '==', true)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    return snapshot.docs[0].data() as Person;
}

/**
 * Search persons by name
 */
export async function searchPersonsByName(
    familyId: string,
    searchTerm: string
): Promise<Person[]> {
    const persons = await getAllPersons(familyId);
    const term = searchTerm.toLowerCase();

    return persons.filter(p =>
        p.fullName.toLowerCase().includes(term) ||
        p.firstName.toLowerCase().includes(term) ||
        p.lastName.toLowerCase().includes(term)
    );
}

// ─────────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Update a person
 */
export async function updatePerson(
    familyId: string,
    personId: string,
    updates: Partial<CreatePersonInput>,
    userId: string
): Promise<void> {
    const personRef = getPersonRef(familyId, personId);

    // Build update data - only include defined values
    const updateData: Record<string, any> = {
        updatedBy: userId,
        updatedAt: serverTimestamp()
    };

    // Only add fields that are defined (not undefined)
    if (updates.firstName !== undefined) updateData.firstName = updates.firstName;
    if (updates.lastName !== undefined) updateData.lastName = updates.lastName;
    if (updates.middleName !== undefined) updateData.middleName = updates.middleName;
    if (updates.gender !== undefined) updateData.gender = updates.gender;
    if (updates.birthDate !== undefined) updateData.birthDate = updates.birthDate || null;
    if (updates.birthPlace !== undefined) updateData.birthPlace = updates.birthPlace || null;
    if (updates.birthOrder !== undefined) updateData.birthOrder = updates.birthOrder || null;
    if (updates.deathDate !== undefined) updateData.deathDate = updates.deathDate || null;
    if (updates.deathPlace !== undefined) updateData.deathPlace = updates.deathPlace || null;
    if (updates.isLiving !== undefined) updateData.isLiving = updates.isLiving;
    if (updates.occupation !== undefined) updateData.occupation = updates.occupation || null;
    if (updates.biography !== undefined) updateData.biography = updates.biography || null;
    if (updates.isRootAncestor !== undefined) updateData.isRootAncestor = updates.isRootAncestor;

    // If name is being updated, re-transliterate
    if (updates.firstName || updates.middleName || updates.lastName) {
        const person = await getPerson(familyId, personId);
        if (person) {
            const latinName: LatinName = {
                first: updates.firstName ?? person.firstName,
                middle: updates.middleName ?? person.middleName ?? '',
                last: updates.lastName ?? person.lastName ?? ''
            };

            updateData.latinName = removeUndefined(latinName);
            updateData.lontaraName = removeUndefined(transliterateName(latinName));
            updateData.fullName = [latinName.first, latinName.middle, latinName.last]
                .filter(Boolean)
                .join(' ');
        }
    }

    await updateDoc(personRef, updateData);
}

/**
 * Update person position
 */
export async function updatePersonPosition(
    familyId: string,
    personId: string,
    position: { x: number; y: number; fixed?: boolean }
): Promise<void> {
    const personRef = getPersonRef(familyId, personId);
    await updateDoc(personRef, {
        position: {
            x: position.x,
            y: position.y,
            fixed: position.fixed ?? false
        },
        updatedAt: serverTimestamp()
    });
}

/**
 * Update ALL person positions in batch (more efficient for save-all)
 */
export async function updateAllPersonPositions(
    familyId: string,
    positions: Map<string, { x: number; y: number }>
): Promise<void> {
    const { writeBatch } = await import('firebase/firestore');
    const batch = writeBatch(db);

    positions.forEach((position, personId) => {
        const personRef = getPersonRef(familyId, personId);
        batch.update(personRef, {
            position: {
                x: position.x,
                y: position.y,
                fixed: true  // All positions are now fixed since user arranged them
            },
            updatedAt: serverTimestamp()
        });
    });

    await batch.commit();
    console.log(`Saved positions for ${positions.size} persons`);
}

/**
 * Update person relationships
 */
export async function updatePersonRelationships(
    familyId: string,
    personId: string,
    relationships: Partial<Person['relationships']>
): Promise<void> {
    const person = await getPerson(familyId, personId);
    if (!person) throw new Error('Person not found');

    const personRef = getPersonRef(familyId, personId);
    await updateDoc(personRef, {
        relationships: { ...person.relationships, ...relationships },
        updatedAt: serverTimestamp()
    });
}

/**
 * Set custom Lontara name (manual override)
 */
export async function setCustomLontaraName(
    familyId: string,
    personId: string,
    customName: Partial<LontaraName>
): Promise<void> {
    const personRef = getPersonRef(familyId, personId);
    await updateDoc(personRef, {
        lontaraNameCustom: customName,
        updatedAt: serverTimestamp()
    });
}

/**
 * Set person as root ancestor
 */
export async function setAsRootAncestor(
    familyId: string,
    personId: string
): Promise<void> {
    // First, remove isRootAncestor from current root
    const currentRoot = await getRootAncestor(familyId);
    if (currentRoot) {
        await updateDoc(getPersonRef(familyId, currentRoot.personId), {
            isRootAncestor: false
        });
    }

    // Set new root
    await updateDoc(getPersonRef(familyId, personId), {
        isRootAncestor: true
    });

    // Update family
    await updateDoc(doc(db, 'families', familyId), {
        rootAncestorId: personId
    });
}

// ─────────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Delete a person
 */
export async function deletePerson(
    familyId: string,
    personId: string
): Promise<void> {
    const person = await getPerson(familyId, personId);
    if (!person) return;

    // Remove from related persons' relationships
    const allPersons = await getAllPersons(familyId);

    for (const p of allPersons) {
        if (
            p.relationships.spouseIds.includes(personId) ||
            p.relationships.parentIds.includes(personId) ||
            p.relationships.childIds.includes(personId)
        ) {
            await updateDoc(getPersonRef(familyId, p.personId), {
                relationships: {
                    spouseIds: p.relationships.spouseIds.filter(id => id !== personId),
                    parentIds: p.relationships.parentIds.filter(id => id !== personId),
                    childIds: p.relationships.childIds.filter(id => id !== personId),
                    siblingIds: p.relationships.siblingIds.filter(id => id !== personId)
                }
            });
        }
    }

    // Delete the person
    await deleteDoc(getPersonRef(familyId, personId));

    // Update family stats
    const family = await getFamily(familyId);
    if (family) {
        await updateFamilyStats(familyId, {
            personCount: Math.max(0, family.stats.personCount - 1)
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────────
// RELATIONSHIP HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Add spouse relationship (bidirectional)
 */
export async function addSpouse(
    familyId: string,
    person1Id: string,
    person2Id: string
): Promise<void> {
    const person1 = await getPerson(familyId, person1Id);
    const person2 = await getPerson(familyId, person2Id);

    if (!person1 || !person2) throw new Error('Person not found');

    // Add to person1's spouses
    if (!person1.relationships.spouseIds.includes(person2Id)) {
        await updateDoc(getPersonRef(familyId, person1Id), {
            'relationships.spouseIds': [...person1.relationships.spouseIds, person2Id]
        });
    }

    // Add to person2's spouses
    if (!person2.relationships.spouseIds.includes(person1Id)) {
        await updateDoc(getPersonRef(familyId, person2Id), {
            'relationships.spouseIds': [...person2.relationships.spouseIds, person1Id]
        });
    }
}

/**
 * Add parent-child relationship (bidirectional)
 * Each parent must be added manually - no auto-linking to spouses
 * This allows correct handling of polygamous relationships (1 person with multiple spouses)
 */
export async function addParentChild(
    familyId: string,
    parentId: string,
    childId: string
): Promise<void> {
    const parent = await getPerson(familyId, parentId);
    const child = await getPerson(familyId, childId);

    if (!parent || !child) throw new Error('Person not found');

    // Add child to parent's children
    if (!parent.relationships.childIds.includes(childId)) {
        await updateDoc(getPersonRef(familyId, parentId), {
            'relationships.childIds': [...parent.relationships.childIds, childId]
        });
    }

    // Add parent to child's parents (max 2)
    if (!child.relationships.parentIds.includes(parentId) && child.relationships.parentIds.length < 2) {
        await updateDoc(getPersonRef(familyId, childId), {
            'relationships.parentIds': [...child.relationships.parentIds, parentId]
        });
    }

    // NOTE: No auto-linking to spouses
    // Each parent-child relationship must be set up manually
    // This is correct for cases where one person has multiple spouses
    // and children from different spouses should not be auto-linked to all spouses
}

/**
 * Remove spouse relationship
 */
export async function removeSpouse(
    familyId: string,
    person1Id: string,
    person2Id: string
): Promise<void> {
    const person1 = await getPerson(familyId, person1Id);
    const person2 = await getPerson(familyId, person2Id);

    if (person1) {
        await updateDoc(getPersonRef(familyId, person1Id), {
            'relationships.spouseIds': person1.relationships.spouseIds.filter(id => id !== person2Id)
        });
    }

    if (person2) {
        await updateDoc(getPersonRef(familyId, person2Id), {
            'relationships.spouseIds': person2.relationships.spouseIds.filter(id => id !== person1Id)
        });
    }
}

/**
 * Remove parent-child relationship
 */
export async function removeParentChild(
    familyId: string,
    parentId: string,
    childId: string
): Promise<void> {
    const parent = await getPerson(familyId, parentId);
    const child = await getPerson(familyId, childId);

    if (parent) {
        await updateDoc(getPersonRef(familyId, parentId), {
            'relationships.childIds': parent.relationships.childIds.filter(id => id !== childId)
        });
    }

    if (child) {
        await updateDoc(getPersonRef(familyId, childId), {
            'relationships.parentIds': child.relationships.parentIds.filter(id => id !== parentId)
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────────
// REGENERATE LONTARA NAMES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Regenerate Lontara names for all persons in a family
 * Uses the latest transliteration engine
 * @returns Number of persons updated
 */
export async function regenerateAllLontaraNames(familyId: string): Promise<number> {
    const persons = await getAllPersons(familyId);
    let updatedCount = 0;

    for (const person of persons) {
        // Build latin name from existing data
        const latinName: LatinName = {
            first: person.latinName?.first || person.firstName || '',
            middle: person.latinName?.middle || '',
            last: person.latinName?.last || ''
        };

        // Re-transliterate using latest engine
        const newLontaraName = transliterateName(latinName);

        // Update in database
        await updateDoc(getPersonRef(familyId, person.personId), {
            lontaraName: removeUndefined(newLontaraName),
            updatedAt: serverTimestamp()
        });

        updatedCount++;
    }

    return updatedCount;
}
