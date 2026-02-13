// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Person Card Component
// Detailed card showing person information
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useMemo } from 'react';
import { clsx } from 'clsx';
import { Person, ScriptMode } from '@/types';
import { transliterateLatin } from '@/lib/transliteration/engine';
import { getGenerationLabel } from '@/lib/generation/calculator';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DualScriptDisplay } from '@/components/aksara/DualScriptDisplay';

export interface PersonCardProps {
    person: Person;
    scriptMode?: ScriptMode;
    generation?: number;
    onEdit?: () => void;
    onDelete?: () => void;
    onAddRelationship?: () => void;
    showActions?: boolean;
}

export function PersonCard({
    person,
    scriptMode = 'both',
    generation = -1,
    onEdit,
    onDelete,
    onAddRelationship,
    showActions = true
}: PersonCardProps) {
    const fullLontaraName = useMemo(() => {
        if (person.lontaraName) {
            return [person.lontaraName.first, person.lontaraName.middle, person.lontaraName.last]
                .filter(Boolean)
                .join(' ');
        }
        return transliterateLatin(person.fullName).lontara;
    }, [person.fullName, person.lontaraName]);

    const generationText = generation > 0 ? getGenerationLabel(generation) : null;

    const genderIcon = person.gender === 'male' ? '👨' : person.gender === 'female' ? '👩' : '👤';
    const genderColor = person.gender === 'male' ? 'text-blue-500' : person.gender === 'female' ? 'text-pink-500' : 'text-gray-500';

    return (
        <Card variant="elevated" className="overflow-hidden">
            <CardHeader gradient>
                <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className={clsx(
                        'w-16 h-16 rounded-full flex items-center justify-center text-3xl bg-white/20'
                    )}>
                        {person.photoUrl ? (
                            <img
                                src={person.photoUrl}
                                alt={person.fullName}
                                className="w-full h-full rounded-full object-cover"
                            />
                        ) : (
                            genderIcon
                        )}
                    </div>

                    {/* Name */}
                    <div className="flex-1">
                        <DualScriptDisplay
                            latinText={person.fullName}
                            displayMode={scriptMode}
                            size="lg"
                            latinClassName="text-white font-bold"
                            lontaraClassName="text-teal-100"
                        />

                        {generationText && (
                            <span className="inline-block mt-1 bg-white/20 text-white text-xs px-2 py-0.5 rounded">
                                {generationText}
                            </span>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardBody>
                <div className="space-y-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div className="text-stone-500 text-xs">Jenis Kelamin</div>
                            <div className={clsx('font-medium', genderColor)}>
                                {genderIcon} {person.gender === 'male' ? 'Laki-laki' : person.gender === 'female' ? 'Perempuan' : 'Lainnya'}
                            </div>
                        </div>

                        <div>
                            <div className="text-stone-500 text-xs">Status</div>
                            <div className="font-medium">
                                {person.isLiving ? '🌱 Masih hidup' : '✝ Almarhum/ah'}
                            </div>
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        {person.birthDate && (
                            <div>
                                <div className="text-stone-500 text-xs">Tanggal Lahir</div>
                                <div className="font-medium">🎂 {person.birthDate}</div>
                                {person.birthPlace && (
                                    <div className="text-stone-600 text-xs">{person.birthPlace}</div>
                                )}
                            </div>
                        )}

                        {person.deathDate && (
                            <div>
                                <div className="text-stone-500 text-xs">Tanggal Wafat</div>
                                <div className="font-medium">✝ {person.deathDate}</div>
                                {person.deathPlace && (
                                    <div className="text-stone-600 text-xs">{person.deathPlace}</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Occupation */}
                    {person.occupation && (
                        <div className="text-sm">
                            <div className="text-stone-500 text-xs">Pekerjaan</div>
                            <div className="font-medium">💼 {person.occupation}</div>
                        </div>
                    )}

                    {/* Nobility Title */}
                    {(person.title || person.reignTitle) && (
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                            <div className="text-stone-500 text-xs mb-1">👑 Gelar Kebangsawanan</div>
                            {person.title && (
                                <div className="font-medium text-amber-700 text-sm">
                                    {person.title === 'datu' ? '🏛️ Datu' :
                                        person.title === 'arung' ? '⚔️ Arung' :
                                            person.title === 'karaeng' ? '🛡️ Karaeng' :
                                                person.title === 'opu' ? '🎖️ Opu' :
                                                    person.title === 'andi' ? '✨ Andi' : '📜 Lainnya'}
                                </div>
                            )}
                            {person.reignTitle && (
                                <div className="font-semibold text-amber-800 text-sm mt-0.5">
                                    {person.reignTitle}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Relationships Summary */}
                    <div className="pt-4 border-t border-stone-200">
                        <div className="text-stone-500 text-xs mb-2">Hubungan</div>
                        <div className="flex flex-wrap gap-2 text-xs">
                            {person.relationships.spouseIds.length > 0 && (
                                <span className="bg-pink-100 text-pink-700 px-2 py-1 rounded">
                                    💑 {person.relationships.spouseIds.length} pasangan
                                </span>
                            )}
                            {person.relationships.parentIds.length > 0 && (
                                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                    👨‍👩 {person.relationships.parentIds.length} orang tua
                                </span>
                            )}
                            {person.relationships.childIds.length > 0 && (
                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                                    👶 {person.relationships.childIds.length} anak
                                </span>
                            )}
                            {person.relationships.siblingIds.length > 0 && (
                                <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">
                                    👫 {person.relationships.siblingIds.length} saudara
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    {showActions && (
                        <div className="flex gap-2 pt-4 border-t border-stone-200">
                            {onEdit && (
                                <button
                                    onClick={onEdit}
                                    className="flex-1 px-3 py-2 text-sm bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 transition"
                                >
                                    ✏️ Edit
                                </button>
                            )}
                            {onAddRelationship && (
                                <button
                                    onClick={onAddRelationship}
                                    className="flex-1 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
                                >
                                    🔗 Hubungan
                                </button>
                            )}
                            {onDelete && (
                                <button
                                    onClick={onDelete}
                                    className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                                >
                                    🗑️
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </CardBody>
        </Card>
    );
}

export default PersonCard;
