// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Family Dashboard Page
// Main family tree view with sidebar and relationship management
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFamilyTree } from '@/hooks/useFirestore';
import { useCanEdit, useIsAdmin, useIsSuperAdmin } from '@/hooks/useAuth';
import { useAuth } from '@/contexts/AuthContext';
import { Person, ScriptMode, CreatePersonInput, CreateRelationshipInput } from '@/types';
import { createPerson, updatePerson, deletePerson, removeSpouse, removeParentChild, regenerateAllLontaraNames, updatePersonPosition } from '@/lib/services/persons';
import { createRelationship } from '@/lib/services/relationships';
import { FamilyTree } from '@/components/tree/FamilyTree';
import { PersonCard } from '@/components/person/PersonCard';
import { PersonForm } from '@/components/person/PersonForm';
import { SidebarEditForm } from '@/components/person/SidebarEditForm';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { transliterateLatin } from '@/lib/transliteration/engine';

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

    // UI State
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
    const [showPersonForm, setShowPersonForm] = useState(false);
    const [showRelationshipModal, setShowRelationshipModal] = useState(false);
    const [scriptMode, setScriptMode] = useState<ScriptMode>('both');
    const [formLoading, setFormLoading] = useState(false);
    const [editingPerson, setEditingPerson] = useState<Person | null>(null);
    const [isEditingSidebar, setIsEditingSidebar] = useState(false);
    const [regenerating, setRegenerating] = useState(false);

    // Relationship form state
    const [relationType, setRelationType] = useState<'spouse' | 'parent' | 'child'>('spouse');
    const [targetPersonId, setTargetPersonId] = useState<string>('');
    const [marriageOrder, setMarriageOrder] = useState<number>(1);

    // Handle add person
    const handleAddPerson = useCallback(() => {
        setEditingPerson(null);
        setShowPersonForm(true);
    }, []);

    // Handle regenerate Lontara (Super Admin only)
    const handleRegenerateLontara = useCallback(async () => {
        if (!isSuperAdmin) return;

        setRegenerating(true);
        try {
            const count = await regenerateAllLontaraNames(familyId);
            alert(`✅ Berhasil regenerate ${count} nama Lontara!`);
        } catch (err) {
            console.error('Failed to regenerate Lontara:', err);
            alert('❌ Gagal regenerate Lontara');
        } finally {
            setRegenerating(false);
        }
    }, [familyId, isSuperAdmin]);

    // Handle edit person - now uses sidebar instead of modal
    const handleEditPerson = useCallback((person: Person) => {
        setEditingPerson(person);
        setIsEditingSidebar(true);
    }, []);

    // Handle save person (create or update)
    const handleSavePerson = useCallback(async (data: CreatePersonInput) => {
        if (!user) return;

        setFormLoading(true);
        try {
            if (editingPerson) {
                // Update existing person
                await updatePerson(familyId, editingPerson.personId, data, user.uid);
                // Clear sidebar edit mode
                setIsEditingSidebar(false);
                setEditingPerson(null);
                // Update selected person if it was the one being edited
                if (selectedPerson?.personId === editingPerson.personId) {
                    setSelectedPerson(null);
                }
            } else {
                // Create new person
                await createPerson(familyId, data, user.uid);
            }
            setShowPersonForm(false);
            setEditingPerson(null);
        } catch (err) {
            console.error('Failed to save person:', err);
        } finally {
            setFormLoading(false);
        }
    }, [familyId, user, editingPerson, selectedPerson]);

    // Handle add relationship
    const handleAddRelationship = useCallback(async () => {
        if (!user || !selectedPerson || !targetPersonId) return;

        setFormLoading(true);
        try {
            if (relationType === 'spouse') {
                // createRelationship handles both the relationship record AND person arrays
                await createRelationship(familyId, {
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
                await createRelationship(familyId, {
                    type: 'parent-child',
                    person1Id: selectedPerson.personId, // parent
                    person2Id: targetPersonId // child
                });
            } else if (relationType === 'child') {
                // Selected person is the CHILD of target
                await createRelationship(familyId, {
                    type: 'parent-child',
                    person1Id: targetPersonId, // parent
                    person2Id: selectedPerson.personId // child
                });
            }

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
            await deletePerson(familyId, selectedPerson.personId);
            setSelectedPerson(null);
        } catch (err) {
            console.error('Failed to delete person:', err);
            alert('Gagal menghapus anggota: ' + (err as Error).message);
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
                await removeSpouse(familyId, selectedPerson.personId, relatedPersonId);
            } else if (type === 'parent') {
                // selectedPerson is child, relatedPersonId is parent
                await removeParentChild(familyId, relatedPersonId, selectedPerson.personId);
            } else if (type === 'child') {
                // selectedPerson is parent, relatedPersonId is child
                await removeParentChild(familyId, selectedPerson.personId, relatedPersonId);
            }
        } catch (err) {
            console.error('Failed to remove relationship:', err);
            alert('Gagal menghapus hubungan: ' + (err as Error).message);
        } finally {
            setFormLoading(false);
        }
    }, [familyId, selectedPerson, user, persons]);

    // Handle position change (save to Firestore when node is dragged)
    const handlePositionChange = useCallback(async (personId: string, position: { x: number; y: number }) => {
        try {
            // Set fixed=true to indicate this position was manually set by user
            await updatePersonPosition(familyId, personId, { ...position, fixed: true });
        } catch (err) {
            console.error('Failed to save position:', err);
        }
    }, [familyId]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-stone-600">Memuat pohon keluarga...</p>
                </div>
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
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-50">
            {/* Header */}
            <header className="bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-700 text-white shadow-xl">
                <div className="max-w-full px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/" className="flex items-center gap-3 text-teal-200 hover:text-white transition">
                                <img src="/logo.png" alt="WIJA" className="w-10 h-10 rounded-lg bg-white/10 p-1" />
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
                                <PersonCard
                                    person={selectedPerson}
                                    scriptMode={scriptMode}
                                    generation={personGenerations.get(selectedPerson.personId)}
                                    showActions={canEdit}
                                    onEdit={() => handleEditPerson(selectedPerson)}
                                    onAddRelationship={() => {
                                        setRelationType('spouse');
                                        setTargetPersonId('');
                                        setShowRelationshipModal(true);
                                    }}
                                />
                            )}

                            {/* Existing Relationships */}
                            <div className="mt-4 pt-4 border-t border-stone-200">
                                <h4 className="font-medium text-stone-700 mb-2">Hubungan</h4>

                                {selectedPerson.relationships.spouseIds.length > 0 && (
                                    <div className="mb-3">
                                        <div className="text-xs text-stone-500 mb-1">💍 Pasangan</div>
                                        {selectedPerson.relationships.spouseIds.map(id => {
                                            const spouse = persons.find(p => p.personId === id);
                                            // Find the relationship to get marriage order
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
                }}
                onSave={handleSavePerson}
                loading={formLoading}
                isEditing={!!editingPerson}
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
        </div>
    );
}
