// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Invitation Card Component
// Displays pending invitation with accept/decline actions
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { Invitation } from '@/types';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { invitationsApi } from '@/lib/api';

export interface InvitationCardProps {
    invitation: Invitation;
    userId: string;
    userDisplayName: string;
    userEmail: string;
    userPhotoUrl?: string;
    onRespond?: () => void;
}

export function InvitationCard({
    invitation,
    userId,
    userDisplayName,
    userEmail,
    userPhotoUrl,
    onRespond
}: InvitationCardProps) {
    const [loading, setLoading] = useState(false);
    const [responded, setResponded] = useState<'accepted' | 'declined' | null>(null);

    const handleAccept = async () => {
        setLoading(true);
        try {
            await invitationsApi.acceptInvitation(
                invitation.invitationId,
                {
                    userId,
                    displayName: userDisplayName,
                    email: userEmail,
                    photoUrl: userPhotoUrl
                }
            );
            setResponded('accepted');
            onRespond?.();
        } catch (err) {
            console.error('Failed to accept invitation:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDecline = async () => {
        setLoading(true);
        try {
            await invitationsApi.declineInvitation(invitation.invitationId);
            setResponded('declined');
            onRespond?.();
        } catch (err) {
            console.error('Failed to decline invitation:', err);
        } finally {
            setLoading(false);
        }
    };

    const expiresAt = invitation.expiresAt instanceof Date ? invitation.expiresAt : new Date(invitation.expiresAt);
    const isExpired = expiresAt < new Date();
    const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    const roleLabels = {
        superadmin: '🛡️ Super Admin',
        owner: '👑 Owner',
        admin: '⚙️ Admin',
        editor: '✏️ Editor',
        viewer: '👁️ Viewer'
    };

    if (responded) {
        return (
            <Card variant="outlined" className={responded === 'accepted' ? 'border-green-300 bg-green-50' : 'border-stone-300 bg-stone-50'}>
                <CardBody>
                    <div className="text-center py-4">
                        <div className="text-4xl mb-2">{responded === 'accepted' ? '🎉' : '👋'}</div>
                        <div className="font-medium text-stone-800">
                            {responded === 'accepted' ? 'Anda sekarang anggota!' : 'Undangan ditolak'}
                        </div>
                        {responded === 'accepted' && (
                            <a
                                href={`/family/${invitation.familyId}`}
                                className="inline-block mt-4 text-teal-600 hover:underline"
                            >
                                Lihat Pohon Keluarga →
                            </a>
                        )}
                    </div>
                </CardBody>
            </Card>
        );
    }

    return (
        <Card variant="elevated" className="overflow-hidden">
            <div className="bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-3 text-white">
                <div className="text-sm opacity-80">Anda diundang ke</div>
                <div className="text-lg font-bold">{invitation.familyName}</div>
            </div>

            <CardBody className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                    <div>
                        <div className="text-stone-500">Diundang oleh</div>
                        <div className="font-medium text-stone-800">{invitation.invitedByName}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-stone-500">Role</div>
                        <div className="font-medium text-stone-800">{roleLabels[invitation.role]}</div>
                    </div>
                </div>

                {isExpired ? (
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center">
                        ⚠️ Undangan ini sudah kadaluarsa
                    </div>
                ) : (
                    <>
                        <div className="text-sm text-stone-500 text-center">
                            Berlaku {daysLeft} hari lagi
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                onClick={handleDecline}
                                disabled={loading}
                                className="flex-1"
                            >
                                Tolak
                            </Button>
                            <Button
                                onClick={handleAccept}
                                loading={loading}
                                className="flex-1"
                            >
                                ✅ Terima
                            </Button>
                        </div>
                    </>
                )}
            </CardBody>
        </Card>
    );
}

export default InvitationCard;
