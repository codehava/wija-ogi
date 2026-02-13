// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Family Dashboard Page
// Main family tree view with sidebar and relationship management
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFamilyTree, useInvalidate } from '@/hooks/useFirestore';
import { useCanEdit, useIsAdmin, useIsSuperAdmin } from '@/hooks/useAuth';
import { useAuth } from '@/contexts/AuthContext';
import { Person, ScriptMode, CreatePersonInput, CreateRelationshipInput, Gender } from '@/types';
import { personsApi, relationshipsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { FamilyTree } from '@/components/tree/FamilyTree';
import { SkeletonTreeView } from '@/components/ui/Skeleton';
import { PersonCard } from '@/components/person/PersonCard';
import { PersonForm, RelationshipContext } from '@/components/person/PersonForm';
import { SidebarEditForm } from '@/components/person/SidebarEditForm';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { transliterateLatin } from '@/lib/transliteration/engine';
import GedcomImport from '@/components/gedcom/GedcomImport';

export default function FamilyPage() {
    const params = useParams();
    const router = useRouter();
    const familyId = params.id as string;

    const { user } = useAuth();
    const { hasRole: canEdit } = useCanEdit(familyId);
    const { hasRole: isAdmin } = useIsAdmin(familyId);
    const { isSuperAdmin } = useIsSuperAdmin();
    const {
        family,
        persons,
        relationships,
        personGenerations,
        stats,
        loading,
        error
    } = useFamilyTree(familyId);
    const { invalidatePersons, invalidateRelationships } = useInvalidate();

    // UI State
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
    const [showPersonForm, setShowPersonForm] = useState(false);
    const [showRelationshipModal, setShowRelationshipModal] = useState(false);
    const [scriptMode, setScriptMode] = useState<ScriptMode>('both');
    const [formLoading, setFormLoading] = useState(false);
    const [editingPerson, setEditingPerson] = useState<Person | null>(null);
    const [isEditingSidebar, setIsEditingSidebar] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [showGedcomImport, setShowGedcomImport] = useState(false);
    const [addMemberContext, setAddMemberContext] = useState<RelationshipContext | null>(null);

    // Relationship form state
    const [relationType, setRelationType] = useState<'spouse' | 'parent' | 'child'>('spouse');
    const [targetPersonId, setTargetPersonId] = useState<string>('');
    const [marriageOrder, setMarriageOrder] = useState<number>(1);

    // Photo upload state for sidebar
    const [sidebarPhotoUploading, setSidebarPhotoUploading] = useState(false);
    const sidebarPhotoInputRef = useRef<HTMLInputElement>(null);

    // Handle add person (generic — no relationship context)
    const handleAddPerson = useCallback(() => {
        setEditingPerson(null);
        setAddMemberContext(null);
        setShowPersonForm(true);
    }, []);

    // Handle contextual quick-add (with auto-relationship)
    const handleQuickAdd = useCallback((type: RelationshipContext['type']) => {
        if (!selectedPerson) return;
        const genderMap: Record<string, Gender> = {
            father: 'male',
            mother: 'female',
            son: 'male',
            daughter: 'female',
            spouse: selectedPerson.gender === 'male' ? 'female' : 'male',
        };
        setEditingPerson(null);
        setAddMemberContext({
            type,
            referencePerson: selectedPerson.fullName,
        });
        setShowPersonForm(true);
    }, [selectedPerson]);

    // Handle regenerate Lontara (Super Admin only)
    const handleRegenerateLontara = useCallback(async () => {
        if (!isSuperAdmin) return;

        setRegenerating(true);
        try {
            const result = await personsApi.regenerateAllLontaraNames(familyId);
            toast.success(`Berhasil regenerate ${result.count} nama Lontara!`);
            invalidatePersons(familyId);
        } catch (err) {
            console.error('Failed to regenerate Lontara:', err);
            toast.error('Gagal regenerate Lontara');
        } finally {
            setRegenerating(false);
        }
    }, [familyId, isSuperAdmin]);

    // Handle edit person - now uses sidebar instead of modal
    const handleEditPerson = useCallback((person: Person) => {
        setEditingPerson(person);
        setIsEditingSidebar(true);
    }, []);

    // Handle save person (create or update, with optional auto-relationship)
    const handleSavePerson = useCallback(async (data: CreatePersonInput) => {
        if (!user) return;

        setFormLoading(true);
        try {
            if (editingPerson) {
                // Update existing person
                await personsApi.updatePerson(familyId, editingPerson.personId, data);
                setIsEditingSidebar(false);
                setEditingPerson(null);
                if (selectedPerson?.personId === editingPerson.personId) {
                    setSelectedPerson(null);
                }
            } else {
                // Create new person
                const newPerson = await personsApi.createPerson(familyId, data);

                // Auto-create relationship if there's a context
                if (addMemberContext && selectedPerson && newPerson?.personId) {
                    try {
                        const ctx = addMemberContext;
                        if (ctx.type === 'spouse') {
                            await relationshipsApi.createRelationship(familyId, {
                                type: 'spouse',
                                person1Id: selectedPerson.personId,
                                person2Id: newPerson.personId,
                                marriage: { status: 'married', marriageOrder: (selectedPerson.relationships.spouseIds.length || 0) + 1 }
                            });
                        } else if (ctx.type === 'father' || ctx.type === 'mother') {
                            // New person is parent of selected person
                            await relationshipsApi.createRelationship(familyId, {
                                type: 'parent-child',
                                person1Id: newPerson.personId,  // parent
                                person2Id: selectedPerson.personId  // child
                            });
                        } else if (ctx.type === 'son' || ctx.type === 'daughter') {
                            // New person is child of selected person
                            await relationshipsApi.createRelationship(familyId, {
                                type: 'parent-child',
                                person1Id: selectedPerson.personId,  // parent
                                person2Id: newPerson.personId  // child
                            });
                        }
                        invalidateRelationships(familyId);
                        toast.success(`Berhasil menambahkan ${data.firstName} dan menghubungkan relasi!`);
                    } catch (relErr) {
                        console.error('Person created but relationship failed:', relErr);
                        toast.error('Anggota berhasil ditambahkan, tapi gagal menghubungkan relasi.');
                    }
                }
            }
            invalidatePersons(familyId);
            setShowPersonForm(false);
            setEditingPerson(null);
            setAddMemberContext(null);
        } catch (err) {
            console.error('Failed to save person:', err);
            toast.error('Gagal menyimpan anggota: ' + (err as Error).message);
        } finally {
            setFormLoading(false);
        }
    }, [familyId, user, editingPerson, selectedPerson, addMemberContext]);

    // Handle add relationship
    const handleAddRelationship = useCallback(async () => {
        if (!user || !selectedPerson || !targetPersonId) return;

        setFormLoading(true);
        try {
            if (relationType === 'spouse') {
                // createRelationship handles both the relationship record AND person arrays
                await relationshipsApi.createRelationship(familyId, {
                    type: 'spouse',
                    person1Id: selectedPerson.personId,
                    person2Id: targetPersonId,
                    marriage: {
                        status: 'married',
                        marriageOrder: marriageOrder
                    }
                });
            } else if (relationType === 'parent') {
                // Selected person is the PARENT of target
                await relationshipsApi.createRelationship(familyId, {
                    type: 'parent-child',
                    person1Id: selectedPerson.personId, // parent
                    person2Id: targetPersonId // child
                });
            } else if (relationType === 'child') {
                // Selected person is the CHILD of target
                await relationshipsApi.createRelationship(familyId, {
                    type: 'parent-child',
                    person1Id: targetPersonId, // parent
                    person2Id: selectedPerson.personId // child
                });
            }

            invalidatePersons(familyId);
            invalidateRelationships(familyId);
            setShowRelationshipModal(false);
            setTargetPersonId('');
            setMarriageOrder(1);
        } catch (err) {
            console.error('Failed to create relationship:', err);
        } finally {
            setFormLoading(false);
        }
    }, [familyId, user, selectedPerson, targetPersonId, relationType]);

    // Get available persons for relationship (exclude self and existing relations)
    const getAvailablePersons = useCallback(() => {
        if (!selectedPerson) return [];

        return persons.filter(p => {
            if (p.personId === selectedPerson.personId) return false;

            // For spouse, exclude existing spouses
            if (relationType === 'spouse') {
                return !selectedPerson.relationships.spouseIds.includes(p.personId);
            }
            // For parent, exclude existing children
            if (relationType === 'parent') {
                return !selectedPerson.relationships.childIds.includes(p.personId);
            }
            // For child, exclude existing parents (max 2)
            if (relationType === 'child') {
                return !selectedPerson.relationships.parentIds.includes(p.personId);
            }
            return true;
        });
    }, [persons, selectedPerson, relationType]);

    // Handle delete person
    const handleDeletePerson = useCallback(async () => {
        if (!selectedPerson || !user) return;

        const confirmDelete = window.confirm(`Hapus ${selectedPerson.fullName}? Tindakan ini tidak dapat dibatalkan.`);
        if (!confirmDelete) return;

        setFormLoading(true);
        try {
            await personsApi.deletePerson(familyId, selectedPerson.personId);
            invalidatePersons(familyId);
            invalidateRelationships(familyId);
            setSelectedPerson(null);
        } catch (err) {
            console.error('Failed to delete person:', err);
            toast.error('Gagal menghapus anggota: ' + (err as Error).message);
        } finally {
            setFormLoading(false);
        }
    }, [familyId, selectedPerson, user]);

    // Handle remove relationship
    const handleRemoveRelationship = useCallback(async (
        type: 'spouse' | 'parent' | 'child',
        relatedPersonId: string
    ) => {
        if (!selectedPerson || !user) return;

        const relatedPerson = persons.find(p => p.personId === relatedPersonId);
        const confirmRemove = window.confirm(
            `Hapus hubungan dengan ${relatedPerson?.fullName || 'orang ini'}?`
        );
        if (!confirmRemove) return;

        setFormLoading(true);
        try {
            if (type === 'spouse') {
                await personsApi.removeSpouse(familyId, selectedPerson.personId, relatedPersonId);
            } else if (type === 'parent') {
                // selectedPerson is child, relatedPersonId is parent
                await personsApi.removeParentChild(familyId, relatedPersonId, selectedPerson.personId);
            } else if (type === 'child') {
                // selectedPerson is parent, relatedPersonId is child
                await personsApi.removeParentChild(familyId, selectedPerson.personId, relatedPersonId);
            }
            invalidatePersons(familyId);
            invalidateRelationships(familyId);
        } catch (err) {
            console.error('Failed to remove relationship:', err);
            toast.error('Gagal menghapus hubungan: ' + (err as Error).message);
        } finally {
            setFormLoading(false);
        }
    }, [familyId, selectedPerson, user, persons]);

    // Handle position change (save to Firestore when node is dragged)
    const handlePositionChange = useCallback(async (personId: string, position: { x: number; y: number }) => {
        try {
            // Set fixed=true to indicate this position was manually set by user
            await personsApi.updatePersonPosition(familyId, personId, { ...position, fixed: true });
        } catch (err) {
            console.error('Failed to save position:', err);
        }
    }, [familyId]);

    // Handle ALL positions change (save all positions when any node is dragged)
    const handleAllPositionsChange = useCallback(async (positions: Map<string, { x: number; y: number }>) => {
        try {
            await personsApi.updateAllPersonPositions(familyId, Object.fromEntries(positions));
        } catch (err) {
            console.error('Failed to save all positions:', err);
        }
    }, [familyId]);

    // Handle sidebar photo upload
    const handleSidebarPhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user || !selectedPerson) return;

        setSidebarPhotoUploading(true);
        try {
            const { photoUrl } = await personsApi.uploadPersonPhoto(familyId, selectedPerson.personId, file);
            await personsApi.updatePerson(familyId, selectedPerson.personId, { photoUrl } as any);
            invalidatePersons(familyId);
        } catch (err: any) {
            console.error('Failed to upload photo:', err);
            toast.error(err.message || 'Gagal mengunggah foto');
        } finally {
            setSidebarPhotoUploading(false);
            if (sidebarPhotoInputRef.current) {
                sidebarPhotoInputRef.current.value = '';
            }
        }
    }, [familyId, user, selectedPerson]);

    // Handle sidebar photo delete
    const handleSidebarPhotoDelete = useCallback(async () => {
        if (!user || !selectedPerson?.photoUrl) return;

        setSidebarPhotoUploading(true);
        try {
            await personsApi.deletePersonPhoto(familyId, selectedPerson.personId);
            await personsApi.updatePerson(familyId, selectedPerson.personId, { photoUrl: '' } as any);
        } catch (err) {
            console.error('Failed to delete photo:', err);
        } finally {
            setSidebarPhotoUploading(false);
        }
    }, [familyId, user, selectedPerson]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-50">
                <SkeletonTreeView />
            </div>
        );
    }

    if (error || !family) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-50">
                <div className="text-center max-w-md">
                    <div className="text-6xl mb-4">😕</div>
                    <h2 className="text-xl font-bold text-stone-800 mb-2">Keluarga Tidak Ditemukan</h2>
                    <p className="text-stone-600 mb-4">
                        Keluarga ini mungkin telah dihapus atau Anda tidak memiliki akses.
                    </p>
                    <Link
                        href="/"
                        className="inline-block px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg font-medium hover:from-teal-600 hover:to-cyan-600 transition"
                    >
                        ← Kembali ke Beranda
                    </Link>
                </div>
            </div>
        );
    }

    const familyLontara = transliterateLatin(family.name).lontara;
    const availablePersons = getAvailablePersons();

    return (
        <div className="h-screen overflow-hidden overscroll-none bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-50">
            {/* Header - Fixed */}
            <header className="sticky top-0 z-50 bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-700 text-white shadow-xl">
                <div className="max-w-full px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/" className="flex items-center gap-3 text-teal-200 hover:text-white transition">
                                <img src="/logo.png" alt="WIJA-Ogi" className="w-10 h-10 rounded-lg bg-white/10 p-1" />
                                <span>← Kembali</span>
                            </Link>
                            <div className="h-8 w-px bg-teal-500"></div>
                            <div>
                                <h1 className="text-xl font-bold flex items-center gap-2">
                                    {family.displayName || family.name}
                                </h1>
                                <p className="text-teal-200 text-sm font-lontara">{familyLontara}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Script Mode Toggle */}
                            <div className="flex bg-teal-600/50 rounded-lg p-1">
                                {(['latin', 'both', 'lontara'] as ScriptMode[]).map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => setScriptMode(mode)}
                                        className={`px-3 py-1 text-sm rounded-md transition ${scriptMode === mode
                                            ? 'bg-white text-teal-700 font-medium'
                                            : 'text-teal-100 hover:text-white'
                                            }`}
                                    >
                                        {mode === 'latin' ? 'Latin' : mode === 'lontara' ? 'ᨒᨚᨈᨑ' : 'Both'}
                                    </button>
                                ))}
                            </div>

                            {/* Stats */}
                            <div className="hidden md:flex items-center gap-4 text-sm text-teal-200">
                                <span>👥 {family.stats.personCount} anggota</span>
                                <span>🌳 {stats.totalGenerations} generasi</span>
                            </div>

                            {/* Admin Menu - visible for admin OR super admin */}
                            {(isAdmin || isSuperAdmin) && (
                                <div className="flex items-center gap-2">
                                    <Link
                                        href={`/family/${familyId}/team`}
                                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition flex items-center gap-1"
                                    >
                                        👥 Tim
                                    </Link>
                                    <Link
                                        href={`/family/${familyId}/settings`}
                                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition flex items-center gap-1"
                                    >
                                        ⚙️ Pengaturan
                                    </Link>
                                    {isSuperAdmin && (
                                        <button
                                            onClick={handleRegenerateLontara}
                                            disabled={regenerating}
                                            className="px-3 py-1.5 bg-yellow-500/80 hover:bg-yellow-500 disabled:bg-yellow-500/50 rounded-lg text-sm font-medium transition flex items-center gap-1"
                                        >
                                            {regenerating ? '⏳ Regenerating...' : '🔄 Regenerate Lontara'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowGedcomImport(true)}
                                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition flex items-center gap-1"
                                    >
                                        📥 Import GEDCOM
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex h-[calc(100vh-72px)]">
                {/* Tree View */}
                <div className="flex-1 relative">
                    <FamilyTree
                        persons={persons}
                        relationships={relationships}
                        scriptMode={scriptMode}
                        selectedPersonId={selectedPerson?.personId}
                        onPersonClick={(p) => setSelectedPerson(p)}
                        editable={canEdit}
                        onAddPerson={handleAddPerson}
                        familyName={family?.displayName || family?.name || 'Pohon Keluarga'}
                        familyId={familyId}
                        onPositionChange={handlePositionChange}
                        onAllPositionsChange={handleAllPositionsChange}
                    />
                </div>

                {/* Sidebar - Selected Person (FIXED POSITION - always visible) */}
                {selectedPerson && (
                    <div className={`fixed right-0 top-[72px] bottom-0 ${isEditingSidebar ? 'w-96' : 'w-80'} bg-white border-l border-stone-200 shadow-2xl overflow-y-auto z-50 animate-slide-in-right transition-all`}>
                        <div className="p-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-stone-800">
                                    {isEditingSidebar ? '✏️ Edit Anggota' : 'Detail Anggota'}
                                </h3>
                                <button
                                    onClick={() => {
                                        if (isEditingSidebar) {
                                            setIsEditingSidebar(false);
                                            setEditingPerson(null);
                                        } else {
                                            setSelectedPerson(null);
                                        }
                                    }}
                                    className="p-1 hover:bg-stone-100 rounded-lg transition"
                                >
                                    ✕
                                </button>
                            </div>

                            {isEditingSidebar && editingPerson ? (
                                <SidebarEditForm
                                    onSave={handleSavePerson}
                                    onCancel={() => {
                                        setIsEditingSidebar(false);
                                        setEditingPerson(null);
                                    }}
                                    loading={formLoading}
                                    initialData={{
                                        firstName: editingPerson.firstName,
                                        lastName: editingPerson.lastName || '',
                                        middleName: editingPerson.middleName || '',
                                        gender: editingPerson.gender,
                                        birthDate: editingPerson.birthDate,
                                        birthPlace: editingPerson.birthPlace,
                                        birthOrder: editingPerson.birthOrder,
                                        deathDate: editingPerson.deathDate,
                                        deathPlace: editingPerson.deathPlace,
                                        isLiving: editingPerson.isLiving,
                                        occupation: editingPerson.occupation,
                                        biography: editingPerson.biography,
                                        isRootAncestor: editingPerson.isRootAncestor
                                    }}
                                />
                            ) : (
                                <>
                                    <PersonCard
                                        person={selectedPerson}
                                        scriptMode={scriptMode}
                                        generation={personGenerations.get(selectedPerson.personId)}
                                        showActions={canEdit}
                                        onEdit={() => handleEditPerson(selectedPerson)}
                                    />

                                    {/* Photo Upload Section */}
                                    {canEdit && (
                                        <div className="mt-3 p-3 bg-stone-50 rounded-lg border border-stone-200">
                                            <input
                                                ref={sidebarPhotoInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleSidebarPhotoUpload}
                                                className="hidden"
                                                disabled={sidebarPhotoUploading}
                                            />
                                            <div className="text-xs text-stone-500 mb-2">📷 Foto Anggota</div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => sidebarPhotoInputRef.current?.click()}
                                                    disabled={sidebarPhotoUploading}
                                                    className="flex-1 px-3 py-2 text-sm bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 transition disabled:opacity-50"
                                                >
                                                    {sidebarPhotoUploading ? '⏳ Uploading...' : selectedPerson.photoUrl ? '🔄 Ganti Foto' : '📷 Upload Foto'}
                                                </button>
                                                {selectedPerson.photoUrl && !sidebarPhotoUploading && (
                                                    <button
                                                        onClick={handleSidebarPhotoDelete}
                                                        className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                                                        title="Hapus foto"
                                                    >
                                                        🗑️
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Existing Relationships */}
                            <div className="mt-4 pt-4 border-t border-stone-200">
                                <h4 className="font-medium text-stone-700 mb-2">Hubungan</h4>

                                {selectedPerson.relationships.spouseIds.length > 0 && (
                                    <div className="mb-3">
                                        <div className="text-xs text-stone-500 mb-1">💍 Pasangan</div>
                                        {selectedPerson.relationships.spouseIds.map(id => {
                                            const spouse = persons.find(p => p.personId === id);
                                            const rel = relationships.find(r =>
                                                r.type === 'spouse' &&
                                                ((r.person1Id === selectedPerson.personId && r.person2Id === id) ||
                                                    (r.person1Id === id && r.person2Id === selectedPerson.personId))
                                            );
                                            const marriageOrderNum = rel?.marriage?.marriageOrder;

                                            return spouse ? (
                                                <div key={id} className="flex items-center justify-between pl-4 py-1 hover:bg-stone-50 rounded">
                                                    <div className="flex-1">
                                                        <span className="text-sm text-stone-700">{spouse.fullName}</span>
                                                        {marriageOrderNum && marriageOrderNum > 1 && (
                                                            <span className="ml-2 text-xs text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">
                                                                Istri ke-{marriageOrderNum}
                                                            </span>
                                                        )}
                                                        {marriageOrderNum === 1 && selectedPerson.relationships.spouseIds.length > 1 && (
                                                            <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                                                Istri ke-1
                                                            </span>
                                                        )}
                                                    </div>
                                                    {canEdit && (
                                                        <button
                                                            onClick={() => handleRemoveRelationship('spouse', id)}
                                                            className="text-xs text-red-500 hover:text-red-700 px-2"
                                                            title="Hapus hubungan"
                                                        >
                                                            ✕
                                                        </button>
                                                    )}
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                )}

                                {selectedPerson.relationships.parentIds.length > 0 && (
                                    <div className="mb-3">
                                        <div className="text-xs text-stone-500 mb-1">👨‍👩‍👧 Orang Tua</div>
                                        {selectedPerson.relationships.parentIds.map(id => {
                                            const parent = persons.find(p => p.personId === id);
                                            return parent ? (
                                                <div key={id} className="flex items-center justify-between pl-4 py-1 hover:bg-stone-50 rounded">
                                                    <span className="text-sm text-stone-700">{parent.fullName}</span>
                                                    {canEdit && (
                                                        <button
                                                            onClick={() => handleRemoveRelationship('parent', id)}
                                                            className="text-xs text-red-500 hover:text-red-700 px-2"
                                                            title="Hapus hubungan"
                                                        >
                                                            ✕
                                                        </button>
                                                    )}
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                )}

                                {selectedPerson.relationships.childIds.length > 0 && (
                                    <div className="mb-3">
                                        <div className="text-xs text-stone-500 mb-1">👶 Anak</div>
                                        {selectedPerson.relationships.childIds.map(id => {
                                            const child = persons.find(p => p.personId === id);
                                            return child ? (
                                                <div key={id} className="flex items-center justify-between pl-4 py-1 hover:bg-stone-50 rounded">
                                                    <span className="text-sm text-stone-700">{child.fullName}</span>
                                                    {canEdit && (
                                                        <button
                                                            onClick={() => handleRemoveRelationship('child', id)}
                                                            className="text-xs text-red-500 hover:text-red-700 px-2"
                                                            title="Hapus hubungan"
                                                        >
                                                            ✕
                                                        </button>
                                                    )}
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                )}

                                {selectedPerson.relationships.spouseIds.length === 0 &&
                                    selectedPerson.relationships.parentIds.length === 0 &&
                                    selectedPerson.relationships.childIds.length === 0 && (
                                        <p className="text-sm text-stone-400 italic">Belum ada hubungan</p>
                                    )}
                            </div>

                            {/* Quick-Add Relationship Buttons */}
                            {canEdit && (
                                <div className="mt-4 pt-4 border-t border-stone-200">
                                    <h4 className="font-medium text-stone-700 mb-3">➕ Tambah Anggota Keluarga</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => handleQuickAdd('spouse')}
                                            className="px-3 py-2.5 text-sm bg-pink-50 text-pink-700 rounded-lg hover:bg-pink-100 transition border border-pink-200 font-medium text-left"
                                        >
                                            💍 Pasangan
                                        </button>
                                        {selectedPerson.relationships.parentIds.length < 2 && (
                                            <>
                                                {!selectedPerson.relationships.parentIds.some(id => {
                                                    const p = persons.find(pp => pp.personId === id);
                                                    return p?.gender === 'male';
                                                }) && (
                                                        <button
                                                            onClick={() => handleQuickAdd('father')}
                                                            className="px-3 py-2.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition border border-blue-200 font-medium text-left"
                                                        >
                                                            👨 Ayah
                                                        </button>
                                                    )}
                                                {!selectedPerson.relationships.parentIds.some(id => {
                                                    const p = persons.find(pp => pp.personId === id);
                                                    return p?.gender === 'female';
                                                }) && (
                                                        <button
                                                            onClick={() => handleQuickAdd('mother')}
                                                            className="px-3 py-2.5 text-sm bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition border border-purple-200 font-medium text-left"
                                                        >
                                                            👩 Ibu
                                                        </button>
                                                    )}
                                            </>
                                        )}
                                        <button
                                            onClick={() => handleQuickAdd('son')}
                                            className="px-3 py-2.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition border border-green-200 font-medium text-left"
                                        >
                                            👦 Anak Laki-laki
                                        </button>
                                        <button
                                            onClick={() => handleQuickAdd('daughter')}
                                            className="px-3 py-2.5 text-sm bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition border border-orange-200 font-medium text-left"
                                        >
                                            👧 Anak Perempuan
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setRelationType('spouse');
                                            setTargetPersonId('');
                                            setShowRelationshipModal(true);
                                        }}
                                        className="w-full mt-2 px-3 py-2 text-sm bg-stone-50 text-stone-600 rounded-lg hover:bg-stone-100 transition border border-stone-200 font-medium"
                                    >
                                        🔗 Hubungkan ke yang Sudah Ada
                                    </button>
                                </div>
                            )}

                            {/* Delete Member Button */}
                            {canEdit && (
                                <div className="mt-4 pt-4 border-t border-stone-200">
                                    <button
                                        onClick={handleDeletePerson}
                                        disabled={formLoading}
                                        className="w-full px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        🗑️ Hapus Anggota
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Add/Edit Person Modal */}
            <PersonForm
                isOpen={showPersonForm}
                onClose={() => {
                    setShowPersonForm(false);
                    setEditingPerson(null);
                    setAddMemberContext(null);
                }}
                onSave={handleSavePerson}
                loading={formLoading}
                isEditing={!!editingPerson}
                relationshipContext={addMemberContext || undefined}
                initialData={editingPerson ? {
                    firstName: editingPerson.firstName,
                    lastName: editingPerson.lastName || '',
                    middleName: editingPerson.middleName || '',
                    gender: editingPerson.gender,
                    birthDate: editingPerson.birthDate,
                    birthPlace: editingPerson.birthPlace,
                    birthOrder: editingPerson.birthOrder,
                    deathDate: editingPerson.deathDate,
                    deathPlace: editingPerson.deathPlace,
                    isLiving: editingPerson.isLiving,
                    occupation: editingPerson.occupation,
                    biography: editingPerson.biography,
                    isRootAncestor: editingPerson.isRootAncestor
                } : addMemberContext ? {
                    gender: (() => {
                        const genderMap: Record<string, Gender> = {
                            father: 'male', mother: 'female', son: 'male', daughter: 'female',
                            spouse: selectedPerson?.gender === 'male' ? 'female' : 'male',
                        };
                        return genderMap[addMemberContext.type] || 'male';
                    })()
                } : undefined}
            />

            {/* Add Relationship Modal */}
            <Modal
                isOpen={showRelationshipModal}
                onClose={() => setShowRelationshipModal(false)}
                title="🔗 Tambah Hubungan"
                size="md"
            >
                <ModalBody className="space-y-4">
                    {selectedPerson && (
                        <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                            <div className="text-sm text-teal-600">Menghubungkan</div>
                            <div className="font-medium text-teal-800">{selectedPerson.fullName}</div>
                        </div>
                    )}

                    <Select
                        label="Jenis Hubungan"
                        value={relationType}
                        onChange={(e) => {
                            setRelationType(e.target.value as 'spouse' | 'parent' | 'child');
                            setTargetPersonId('');
                        }}
                        options={[
                            { value: 'spouse', label: '💍 Pasangan (Suami/Istri)' },
                            { value: 'parent', label: '👨‍👩‍👧 Orang ini adalah ORANG TUA dari...' },
                            { value: 'child', label: '👶 Orang ini adalah ANAK dari...' }
                        ]}
                    />

                    <SearchableSelect
                        label={
                            relationType === 'spouse'
                                ? 'Pilih Pasangan'
                                : relationType === 'parent'
                                    ? 'Pilih Anak'
                                    : 'Pilih Orang Tua'
                        }
                        value={targetPersonId}
                        onChange={(value) => setTargetPersonId(value)}
                        placeholder="Ketik nama untuk mencari..."
                        options={
                            availablePersons.map(p => ({
                                value: p.personId,
                                label: [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ') || p.fullName
                            }))
                        }
                    />

                    {/* Marriage Order - only for spouse relationships */}
                    {relationType === 'spouse' && selectedPerson && selectedPerson.relationships.spouseIds.length > 0 && (
                        <Select
                            label="Urutan Istri (untuk poligami)"
                            value={marriageOrder.toString()}
                            onChange={(e) => setMarriageOrder(parseInt(e.target.value))}
                            options={[
                                { value: '1', label: 'Istri ke-1' },
                                { value: '2', label: 'Istri ke-2' },
                                { value: '3', label: 'Istri ke-3' },
                                { value: '4', label: 'Istri ke-4' }
                            ]}
                        />
                    )}

                    {availablePersons.length === 0 && (
                        <p className="text-sm text-stone-500 text-center">
                            Tidak ada anggota keluarga lain yang tersedia untuk hubungan ini.
                        </p>
                    )}
                </ModalBody>

                <ModalFooter>
                    <Button
                        variant="secondary"
                        onClick={() => setShowRelationshipModal(false)}
                        className="flex-1"
                    >
                        Batal
                    </Button>
                    <Button
                        onClick={handleAddRelationship}
                        loading={formLoading}
                        disabled={!targetPersonId}
                        className="flex-1"
                    >
                        Tambah Hubungan
                    </Button>
                </ModalFooter>
            </Modal>

            {/* GEDCOM Import Modal */}
            {showGedcomImport && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-fade-in">
                    <GedcomImport
                        treeId={familyId}
                        treeName={family?.displayName || family?.name}
                        onImportComplete={(result) => {
                            invalidatePersons(familyId);
                            invalidateRelationships(familyId);
                            toast.success(`Berhasil import ${result.personsCount} anggota dan ${result.relationshipsCount} hubungan!`);
                        }}
                        onClose={() => setShowGedcomImport(false)}
                    />
                </div>
            )}
        </div>
    );
}
