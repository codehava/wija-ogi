// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Sidebar Edit Form Component  
// Inline person editing form for sidebar (not modal)
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useMemo, useEffect } from 'react';
import { CreatePersonInput, Gender } from '@/types';
import { transliterateLatin } from '@/lib/transliteration/engine';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export interface SidebarEditFormProps {
    onSave: (data: CreatePersonInput) => void;
    onCancel: () => void;
    initialData?: Partial<CreatePersonInput>;
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

export function SidebarEditForm({
    onSave,
    onCancel,
    initialData,
    loading = false
}: SidebarEditFormProps) {
    const [formData, setFormData] = useState<Partial<CreatePersonInput>>(DEFAULT_FORM_STATE);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        setFormData({
            ...DEFAULT_FORM_STATE,
            ...initialData
        });
        setErrors({});
    }, [initialData]);

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
            lastName: formData.lastName || '',
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
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Lontara Preview */}
            <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                <div className="text-xs text-teal-600 mb-1">Preview Lontara:</div>
                <div className="text-sm font-medium text-stone-800">
                    {formData.firstName} {formData.middleName} {formData.lastName}
                </div>
                <div className="font-lontara text-lg text-teal-700 mt-0.5">
                    {lontaraPreview || '—'}
                </div>
            </div>

            {/* Name Fields - Stacked for sidebar */}
            <div className="space-y-3">
                <Input
                    label="Nama Depan *"
                    value={formData.firstName || ''}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    error={errors.firstName}
                    placeholder="Nama depan"
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
            <div className="grid grid-cols-2 gap-2">
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
                    placeholder="Kota"
                />
            </div>

            {/* Living Status */}
            <label className="flex items-center gap-2 cursor-pointer">
                <input
                    type="checkbox"
                    checked={formData.isLiving ?? true}
                    onChange={(e) => handleChange('isLiving', e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                />
                <span className="text-sm font-medium text-stone-700">Masih hidup</span>
            </label>

            {/* Death Info */}
            {!formData.isLiving && (
                <div className="grid grid-cols-2 gap-2 p-2 bg-stone-50 rounded-lg">
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
                        placeholder="Kota"
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
            <label className="flex items-center gap-2 cursor-pointer p-2 bg-teal-50 rounded-lg">
                <input
                    type="checkbox"
                    checked={formData.isRootAncestor ?? false}
                    onChange={(e) => handleChange('isRootAncestor', e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                />
                <span className="text-sm font-medium text-stone-700">
                    🌳 Leluhur (titik awal pohon)
                </span>
            </label>

            {/* Actions */}
            <div className="flex gap-2 pt-3 border-t border-stone-200">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onCancel}
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
                    💾 Simpan
                </Button>
            </div>
        </form>
    );
}

export default SidebarEditForm;
