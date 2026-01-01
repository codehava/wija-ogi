// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Family Members Management Page
// Manage team members and invitations (Admin only)
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useFamilyTree } from '@/hooks/useFirestore';
import { useIsAdmin } from '@/hooks/useAuth';
import { useAuth } from '@/contexts/AuthContext';
import { FamilyMember, Invitation, MemberRole } from '@/types';
import { getFamilyMembers, updateMemberRole, removeFamilyMember } from '@/lib/services/families';
import { getInvitationsForFamily, revokeInvitation, resendInvitation } from '@/lib/services/invitations';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { InviteMemberForm } from '@/components/invitation/InviteMemberForm';

export default function TeamPage() {
    const params = useParams();
    const familyId = params.id as string;

    const { user } = useAuth();
    const { hasRole: isAdmin, loading: adminLoading } = useIsAdmin(familyId);
    const { family, loading } = useFamilyTree(familyId);

    const [members, setMembers] = useState<FamilyMember[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [showInviteForm, setShowInviteForm] = useState(false);
    const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Load members and invitations
    useEffect(() => {
        if (familyId && isAdmin) {
            loadData();
        }
    }, [familyId, isAdmin]);

    const loadData = async () => {
        try {
            const [membersData, invitationsData] = await Promise.all([
                getFamilyMembers(familyId),
                getInvitationsForFamily(familyId)
            ]);
            setMembers(membersData);
            setInvitations(invitationsData.filter(i => i.status === 'pending'));
        } catch (err) {
            console.error('Failed to load team data:', err);
        }
    };

    const handleRoleChange = async (memberId: string, newRole: MemberRole) => {
        setActionLoading(true);
        try {
            await updateMemberRole(familyId, memberId, newRole);
            setMembers(prev => prev.map(m =>
                m.memberId === memberId ? { ...m, role: newRole } : m
            ));
        } catch (err) {
            console.error('Failed to update role:', err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemoveMember = async () => {
        if (!selectedMember) return;

        setActionLoading(true);
        try {
            await removeFamilyMember(familyId, selectedMember.memberId);
            setMembers(prev => prev.filter(m => m.memberId !== selectedMember.memberId));
            setShowRemoveModal(false);
            setSelectedMember(null);
        } catch (err) {
            console.error('Failed to remove member:', err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleRevokeInvitation = async (invitationId: string) => {
        setActionLoading(true);
        try {
            await revokeInvitation(invitationId);
            setInvitations(prev => prev.filter(i => i.invitationId !== invitationId));
        } catch (err) {
            console.error('Failed to revoke invitation:', err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleResendInvitation = async (invitationId: string) => {
        setActionLoading(true);
        try {
            await resendInvitation(invitationId);
            loadData(); // Reload to get updated expiry
        } catch (err) {
            console.error('Failed to resend invitation:', err);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading || adminLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-100 via-teal-50 to-cyan-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-stone-600">Memuat data tim...</p>
                </div>
            </div>
        );
    }

    if (!family || !isAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-100 via-teal-50 to-cyan-50">
                <div className="text-center">
                    <div className="text-6xl mb-4">🔒</div>
                    <h2 className="text-xl font-bold text-stone-800 mb-2">Akses Ditolak</h2>
                    <p className="text-stone-600 mb-4">Hanya admin yang dapat mengelola tim.</p>
                    <Link href={`/family/${familyId}`} className="text-teal-600 hover:underline">
                        ← Kembali
                    </Link>
                </div>
            </div>
        );
    }

    const roleLabels: Record<MemberRole, string> = {
        superadmin: '🛡️ Super Admin',
        owner: '👑 Owner',
        admin: '⚙️ Admin',
        editor: '✏️ Editor',
        viewer: '👁️ Viewer'
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-stone-100 via-teal-50 to-cyan-50">
            {/* Header */}
            <header className="bg-gradient-to-r from-teal-700 via-cyan-700 to-teal-800 text-white shadow-xl">
                <div className="max-w-4xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-4 mb-2">
                                <Link href={`/family/${familyId}/settings`} className="text-teal-200 hover:text-white transition">
                                    ← Pengaturan
                                </Link>
                            </div>
                            <h1 className="text-2xl font-bold">👥 Kelola Tim</h1>
                            <p className="text-teal-200 mt-1">{family.displayName || family.name}</p>
                        </div>

                        <Button onClick={() => setShowInviteForm(true)}>
                            ✉️ Undang Anggota
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* Members List */}
                <Card>
                    <CardHeader gradient>
                        <h2 className="font-bold">Anggota Tim ({members.length})</h2>
                    </CardHeader>
                    <CardBody className="divide-y divide-stone-200">
                        {members.length === 0 ? (
                            <div className="py-8 text-center text-stone-500">
                                Belum ada anggota tim
                            </div>
                        ) : (
                            members.map(member => (
                                <div key={member.memberId} className="py-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-bold">
                                            {member.photoUrl ? (
                                                <img src={member.photoUrl} alt={member.displayName} className="w-full h-full rounded-full object-cover" />
                                            ) : (
                                                member.displayName.charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div>
                                            <div className="font-medium text-stone-800">
                                                {member.displayName}
                                                {member.userId === user?.uid && (
                                                    <span className="ml-2 text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded">Anda</span>
                                                )}
                                            </div>
                                            <div className="text-sm text-stone-500">{member.email}</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {member.role === 'owner' ? (
                                            <span className="text-sm font-medium text-teal-600">{roleLabels[member.role]}</span>
                                        ) : member.userId !== user?.uid ? (
                                            <>
                                                <Select
                                                    value={member.role}
                                                    onChange={(e) => handleRoleChange(member.memberId, e.target.value as MemberRole)}
                                                    options={[
                                                        { value: 'admin', label: 'Admin' },
                                                        { value: 'editor', label: 'Editor' },
                                                        { value: 'viewer', label: 'Viewer' }
                                                    ]}
                                                />
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setSelectedMember(member);
                                                        setShowRemoveModal(true);
                                                    }}
                                                    className="text-red-500"
                                                >
                                                    🗑️
                                                </Button>
                                            </>
                                        ) : (
                                            <span className="text-sm font-medium text-stone-600">{roleLabels[member.role]}</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </CardBody>
                </Card>

                {/* Pending Invitations */}
                {invitations.length > 0 && (
                    <Card>
                        <CardHeader>
                            <h2 className="font-bold text-stone-800">✉️ Undangan Pending ({invitations.length})</h2>
                        </CardHeader>
                        <CardBody className="divide-y divide-stone-200">
                            {invitations.map(invitation => (
                                <div key={invitation.invitationId} className="py-4 flex items-center justify-between">
                                    <div>
                                        <div className="font-medium text-stone-800">{invitation.email}</div>
                                        <div className="text-sm text-stone-500">
                                            {roleLabels[invitation.role]} • Kadaluarsa {invitation.expiresAt.toDate().toLocaleDateString('id')}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleResendInvitation(invitation.invitationId)}
                                            disabled={actionLoading}
                                        >
                                            🔄 Kirim ulang
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRevokeInvitation(invitation.invitationId)}
                                            disabled={actionLoading}
                                            className="text-red-500"
                                        >
                                            ❌ Batalkan
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </CardBody>
                    </Card>
                )}
            </main>

            {/* Invite Form Modal */}
            <InviteMemberForm
                isOpen={showInviteForm}
                onClose={() => setShowInviteForm(false)}
                familyId={familyId}
                familyName={family.displayName || family.name}
                inviterId={user?.uid || ''}
                inviterName={user?.displayName || 'Unknown'}
                onSuccess={loadData}
            />

            {/* Remove Member Confirmation */}
            <Modal
                isOpen={showRemoveModal}
                onClose={() => {
                    setShowRemoveModal(false);
                    setSelectedMember(null);
                }}
                title="⚠️ Hapus Anggota"
                size="sm"
            >
                <ModalBody>
                    <p className="text-stone-600">
                        Apakah Anda yakin ingin menghapus <strong>{selectedMember?.displayName}</strong> dari tim?
                    </p>
                </ModalBody>
                <ModalFooter>
                    <Button
                        variant="secondary"
                        onClick={() => {
                            setShowRemoveModal(false);
                            setSelectedMember(null);
                        }}
                        className="flex-1"
                    >
                        Batal
                    </Button>
                    <Button
                        variant="danger"
                        onClick={handleRemoveMember}
                        loading={actionLoading}
                        className="flex-1"
                    >
                        Hapus
                    </Button>
                </ModalFooter>
            </Modal>
        </div>
    );
}
