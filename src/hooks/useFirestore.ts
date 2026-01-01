// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Firestore Hooks
// React hooks for Firestore data fetching with real-time updates
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Family, Person, Relationship } from '@/types';
import { getFamily, getUserFamilies, getFamilyMembers } from '@/lib/services/families';
import { getAllPersons, subscribeToPersons, getPersonsMap } from '@/lib/services/persons';
import { getAllRelationships, subscribeToRelationships } from '@/lib/services/relationships';
import { calculateGeneration, findRootAncestor, getGenerationStats } from '@/lib/generation/calculator';
import { useAuth } from '@/contexts/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────────
// FAMILY HOOKS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Hook to fetch a single family
 */
export function useFamily(familyId: string | null) {
    const [family, setFamily] = useState<Family | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!familyId) {
            setFamily(null);
            setLoading(false);
            return;
        }

        async function fetchFamily() {
            if (!familyId) return;
            try {
                setLoading(true);
                const data = await getFamily(familyId);
                setFamily(data);
                setError(null);
            } catch (err) {
                setError(err as Error);
                setFamily(null);
            } finally {
                setLoading(false);
            }
        }

        fetchFamily();
    }, [familyId]);

    return { family, loading, error };
}

/**
 * Hook to fetch user's families with realtime updates
 * Includes: owned families + families where user is a member
 * Super admins can see ALL families
 */
export function useUserFamilies() {
    const { user } = useAuth();
    const [families, setFamilies] = useState<Family[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    useEffect(() => {
        if (!user) {
            setFamilies([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const fetchFamilies = async () => {
            try {
                // Check if super admin
                const superAdminRef = doc(db, 'superadmins', user.uid);
                const superAdminSnap = await getDoc(superAdminRef);
                const isSuper = superAdminSnap.exists();
                setIsSuperAdmin(isSuper);

                if (isSuper) {
                    // Super admin: get all families
                    const q = query(
                        collection(db, 'families'),
                        orderBy('updatedAt', 'desc')
                    );

                    const unsubscribe = onSnapshot(q, (snapshot) => {
                        const data = snapshot.docs.map(doc => doc.data() as Family);
                        setFamilies(data);
                        setLoading(false);
                        setError(null);
                    }, (err) => {
                        console.error('Error fetching families:', err);
                        setError(err as Error);
                        setFamilies([]);
                        setLoading(false);
                    });

                    return unsubscribe;
                }

                // Regular user: get owned families + member families
                const familyIds = new Set<string>();

                // 1. Get families where user is owner
                const ownedQuery = query(
                    collection(db, 'families'),
                    where('ownerId', '==', user.uid)
                );
                const ownedSnapshot = await getDocs(ownedQuery);
                ownedSnapshot.docs.forEach(doc => familyIds.add(doc.id));

                // 2. Get families where user is a member (check each family's members subcollection)
                // We need to query collection group for members
                const { collectionGroup } = await import('firebase/firestore');
                const membersQuery = query(
                    collectionGroup(db, 'members'),
                    where('userId', '==', user.uid)
                );
                const membersSnapshot = await getDocs(membersQuery);
                membersSnapshot.docs.forEach(memberDoc => {
                    // The parent of members subcollection is the family
                    const familyId = memberDoc.ref.parent.parent?.id;
                    if (familyId) familyIds.add(familyId);
                });

                // 3. Fetch all family documents
                const familyPromises = Array.from(familyIds).map(async (familyId) => {
                    const familyDoc = await getDoc(doc(db, 'families', familyId));
                    if (familyDoc.exists()) {
                        return familyDoc.data() as Family;
                    }
                    return null;
                });

                const familyResults = await Promise.all(familyPromises);
                const validFamilies = familyResults
                    .filter((f): f is Family => f !== null)
                    .sort((a, b) => {
                        // Sort by updatedAt descending
                        const aTime = a.updatedAt?.seconds || 0;
                        const bTime = b.updatedAt?.seconds || 0;
                        return bTime - aTime;
                    });

                setFamilies(validFamilies);
                setLoading(false);
                setError(null);

                // Return empty unsubscribe for non-realtime mode
                return () => { };
            } catch (err) {
                console.error('Error fetching families:', err);
                setError(err as Error);
                setFamilies([]);
                setLoading(false);
                return () => { };
            }
        };

        let unsubscribe: (() => void) | undefined;
        fetchFamilies().then(unsub => {
            unsubscribe = unsub;
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [user]);

    const refresh = useCallback(async () => {
        // Trigger a re-fetch by updating state
        // For now, this is a no-op as we fetch on mount
    }, []);

    return { families, loading, error, refresh, isSuperAdmin };

}

// ─────────────────────────────────────────────────────────────────────────────────
// PERSONS HOOKS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Hook to fetch all persons in a family (non-realtime)
 */
export function usePersons(familyId: string | null) {
    const [persons, setPersons] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!familyId) {
            setPersons([]);
            setLoading(false);
            return;
        }

        async function fetchPersons() {
            if (!familyId) return;
            try {
                setLoading(true);
                const data = await getAllPersons(familyId);
                setPersons(data);
                setError(null);
            } catch (err) {
                setError(err as Error);
                setPersons([]);
            } finally {
                setLoading(false);
            }
        }

        fetchPersons();
    }, [familyId]);

    return { persons, loading, error };
}

/**
 * Hook to subscribe to persons (real-time)
 */
export function usePersonsRealtime(familyId: string | null) {
    const [persons, setPersons] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!familyId) {
            setPersons([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const unsubscribe = subscribeToPersons(
            familyId,
            (data) => {
                setPersons(data);
                setLoading(false);
                setError(null);
            },
            (err) => {
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [familyId]);

    return { persons, loading, error };
}

// ─────────────────────────────────────────────────────────────────────────────────
// RELATIONSHIPS HOOKS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Hook to fetch all relationships in a family
 */
export function useRelationships(familyId: string | null) {
    const [relationships, setRelationships] = useState<Relationship[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!familyId) {
            setRelationships([]);
            setLoading(false);
            return;
        }

        async function fetchRelationships() {
            if (!familyId) return;
            try {
                setLoading(true);
                const data = await getAllRelationships(familyId);
                setRelationships(data);
                setError(null);
            } catch (err) {
                setError(err as Error);
                setRelationships([]);
            } finally {
                setLoading(false);
            }
        }

        fetchRelationships();
    }, [familyId]);

    return { relationships, loading, error };
}

/**
 * Hook to subscribe to relationships (real-time)
 */
export function useRelationshipsRealtime(familyId: string | null) {
    const [relationships, setRelationships] = useState<Relationship[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!familyId) {
            setRelationships([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const unsubscribe = subscribeToRelationships(
            familyId,
            (data) => {
                setRelationships(data);
                setLoading(false);
                setError(null);
            },
            (err) => {
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [familyId]);

    return { relationships, loading, error };
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMBINED FAMILY TREE HOOK
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Hook to get complete family tree data with generations
 */
export function useFamilyTree(familyId: string | null) {
    const { family, loading: familyLoading, error: familyError } = useFamily(familyId);
    const { persons, loading: personsLoading, error: personsError } = usePersonsRealtime(familyId);
    const { relationships, loading: relLoading, error: relError } = useRelationshipsRealtime(familyId);

    const loading = familyLoading || personsLoading || relLoading;
    const error = familyError || personsError || relError;

    // Build persons map for generation calculation
    const personsMap = useMemo(() => {
        const map = new Map<string, Person>();
        persons.forEach(p => map.set(p.personId, p));
        return map;
    }, [persons]);

    // Find root ancestor
    const rootAncestor = useMemo(() => {
        return findRootAncestor(persons);
    }, [persons]);

    // Calculate generations for all persons
    const personGenerations = useMemo(() => {
        if (!rootAncestor) return new Map<string, number>();

        const generations = new Map<string, number>();
        persons.forEach(p => {
            const gen = calculateGeneration(p.personId, rootAncestor.personId, personsMap);
            generations.set(p.personId, gen);
        });
        return generations;
    }, [persons, rootAncestor, personsMap]);

    // Calculate stats
    const stats = useMemo(() => {
        if (!rootAncestor) {
            return {
                totalGenerations: 0,
                personsByGeneration: {} as Record<number, number>,
                disconnectedCount: 0
            };
        }
        return getGenerationStats(persons, rootAncestor.personId);
    }, [persons, rootAncestor]);

    return {
        family,
        persons,
        relationships,
        personsMap,
        rootAncestor,
        personGenerations,
        stats,
        loading,
        error
    };
}

// ─────────────────────────────────────────────────────────────────────────────────
// UTILITY HOOKS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Hook to get generation for a specific person
 */
export function usePersonGeneration(
    familyId: string | null,
    personId: string | null
) {
    const { personGenerations, rootAncestor, loading } = useFamilyTree(familyId);

    const generation = useMemo(() => {
        if (!personId || !rootAncestor) return -1;
        return personGenerations.get(personId) ?? -1;
    }, [personId, personGenerations, rootAncestor]);

    return { generation, loading };
}
