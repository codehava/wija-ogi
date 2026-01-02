// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Person Form Component
// Form for creating/editing persons with Lontara preview
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useMemo, useEffect } from 'react';
import { clsx } from 'clsx';
import { CreatePersonInput, Gender } from '@/types';
import { transliterateLatin } from '@/lib/transliteration/engine';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';

export interface PersonFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: CreatePersonInput) => void;
    initialData?: Partial<CreatePersonInput>;
    isEditing?: boolean;
    loading?: boolean;
}

const GENDER_OPTIONS = [
    { value: 'male', label: '👨 Laki-laki' },
    { value: 'female', label: '👩 Perempuan' },
    { value: 'other', label: '👤 Lainnya' },
    { value: 'unknown', label: '❓ Tidak diketahui' }
];

const DEFAULT_FORM_STATE: Partial<CreatePersonInput> = {
    firstName: '',
    lastName: '',
    middleName: '',
    gender: 'male' as Gender,
    birthDate: '',
    birthPlace: '',
    deathDate: '',
    deathPlace: '',
    isLiving: true,
    occupation: '',
    biography: '',
    isRootAncestor: false
};

export function PersonForm({
    isOpen,
    onClose,
    onSave,
    initialData,
    isEditing = false,
    loading = false
}: PersonFormProps) {
    const [formData, setFormData] = useState<Partial<CreatePersonInput>>(DEFAULT_FORM_STATE);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData({
                ...DEFAULT_FORM_STATE,
                ...initialData
            });
            setErrors({});
        }
    }, [isOpen, initialData]);

    // Auto-transliterate for preview
    const lontaraPreview = useMemo(() => {
        const fullName = [formData.firstName, formData.middleName, formData.lastName]
            .filter(Boolean)
            .join(' ');
        return transliterateLatin(fullName).lontara;
    }, [formData.firstName, formData.middleName, formData.lastName]);

    const handleChange = (field: keyof CreatePersonInput, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.firstName?.trim()) {
            newErrors.firstName = 'Nama depan wajib diisi';
        }
        // Last name is now optional
        if (!formData.gender) {
            newErrors.gender = 'Jenis kelamin wajib dipilih';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        onSave({
            firstName: formData.firstName!,
            lastName: formData.lastName || '',  // Optional
            middleName: formData.middleName,
            gender: formData.gender as Gender,
            birthDate: formData.birthDate,
            birthPlace: formData.birthPlace,
            deathDate: formData.deathDate,
            deathPlace: formData.deathPlace,
            isLiving: formData.isLiving ?? true,
            occupation: formData.occupation,
            biography: formData.biography,
            isRootAncestor: formData.isRootAncestor
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? '✏️ Edit Anggota' : '➕ Tambah Anggota'}
            size="xl"
        >
            <form onSubmit={handleSubmit}>
                <ModalBody className="space-y-6">
                    {/* Lontara Preview */}
                    <div className="p-4 bg-teal-50 rounded-xl border border-teal-200">
                        <div className="text-sm text-teal-600 mb-1">Preview Nama Lontara:</div>
                        <div className="font-semibold text-stone-800">
                            {formData.firstName} {formData.middleName} {formData.lastName}
                        </div>
                        <div className="font-lontara text-2xl text-teal-700 mt-1">
                            {lontaraPreview || '—'}
                        </div>
                    </div>

                    {/* Name Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input
                            label="Nama Depan *"
                            value={formData.firstName || ''}
                            onChange={(e) => handleChange('firstName', e.target.value)}
                            error={errors.firstName}
                            placeholder="Masukkan nama depan"
                        />
                        <Input
                            label="Nama Tengah"
                            value={formData.middleName || ''}
                            onChange={(e) => handleChange('middleName', e.target.value)}
                            placeholder="Opsional"
                        />
                        <Input
                            label="Nama Belakang"
                            value={formData.lastName || ''}
                            onChange={(e) => handleChange('lastName', e.target.value)}
                            error={errors.lastName}
                            placeholder="Opsional"
                        />
                    </div>

                    {/* Gender */}
                    <Select
                        label="Jenis Kelamin *"
                        value={formData.gender || 'male'}
                        onChange={(e) => handleChange('gender', e.target.value)}
                        options={GENDER_OPTIONS}
                        error={errors.gender}
                    />

                    {/* Birth Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Tanggal Lahir"
                            type="date"
                            value={formData.birthDate || ''}
                            onChange={(e) => handleChange('birthDate', e.target.value)}
                        />
                        <Input
                            label="Tempat Lahir"
                            value={formData.birthPlace || ''}
                            onChange={(e) => handleChange('birthPlace', e.target.value)}
                            placeholder="Kota/Daerah"
                        />
                    </div>

                    {/* Living Status */}
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.isLiving ?? true}
                                onChange={(e) => handleChange('isLiving', e.target.checked)}
                                className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                            />
                            <span className="text-sm font-medium text-stone-700">
                                Masih hidup
                            </span>
                        </label>
                    </div>

                    {/* Death Info (conditional) */}
                    {!formData.isLiving && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-stone-50 rounded-lg">
                            <Input
                                label="Tanggal Wafat"
                                type="date"
                                value={formData.deathDate || ''}
                                onChange={(e) => handleChange('deathDate', e.target.value)}
                            />
                            <Input
                                label="Tempat Wafat"
                                value={formData.deathPlace || ''}
                                onChange={(e) => handleChange('deathPlace', e.target.value)}
                                placeholder="Kota/Daerah"
                            />
                        </div>
                    )}

                    {/* Occupation */}
                    <Input
                        label="Pekerjaan"
                        value={formData.occupation || ''}
                        onChange={(e) => handleChange('occupation', e.target.value)}
                        placeholder="Pekerjaan/Profesi"
                    />

                    {/* Root Ancestor */}
                    <div className="flex items-center gap-3 p-3 bg-teal-50 rounded-lg">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.isRootAncestor ?? false}
                                onChange={(e) => handleChange('isRootAncestor', e.target.checked)}
                                className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                            />
                            <span className="text-sm font-medium text-stone-700">
                                🌳 Jadikan sebagai Leluhur (titik awal pohon keluarga)
                            </span>
                        </label>
                    </div>
                </ModalBody>

                <ModalFooter>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        className="flex-1"
                    >
                        Batal
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        loading={loading}
                        className="flex-1"
                    >
                        {isEditing ? 'Simpan Perubahan' : 'Tambah Anggota'}
                    </Button>
                </ModalFooter>
            </form>
        </Modal>
    );
}

export default PersonForm;
