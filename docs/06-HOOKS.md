# 06 - Hooks

## 📁 Hook Structure

```
src/hooks/
├── index.ts           # Central export
├── useAuth.ts         # Authentication hooks
└── useFirestore.ts    # Firestore data hooks
```

---

## 🔐 Authentication Hooks

**Location:** `src/hooks/useAuth.ts`

### useHasRole

Check if user has specific role(s) in a family.

```typescript
import { useHasRole } from '@/hooks';

function MyComponent() {
  const { hasRole, loading } = useHasRole(familyId, ['owner', 'admin']);
  
  if (loading) return <Spinner />;
  if (!hasRole) return <AccessDenied />;
  
  return <AdminPanel />;
}
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `familyId` | string \| null | Family ID |
| `roles` | MemberRole[] | Roles to check |

**Returns:**

```typescript
{
  hasRole: boolean;
  role: MemberRole | null;
  loading: boolean;
}
```

---

### useCanEdit

Check if user can edit in a family (owner, admin, or editor).

```typescript
import { useCanEdit } from '@/hooks';

function EditButton({ familyId }) {
  const { canEdit, loading } = useCanEdit(familyId);
  
  if (!canEdit) return null;
  
  return <button>Edit</button>;
}
```

**Returns:**

```typescript
{
  canEdit: boolean;
  loading: boolean;
}
```

---

### useIsAdmin

Check if user is admin or owner of a family.

```typescript
import { useIsAdmin } from '@/hooks';

function AdminMenu({ familyId }) {
  const { isAdmin, loading } = useIsAdmin(familyId);
  
  if (!isAdmin) return null;
  
  return (
    <div>
      <InviteButton />
      <ManageMembers />
    </div>
  );
}
```

---

### useIsOwner

Check if user is the owner of a family.

```typescript
import { useIsOwner } from '@/hooks';

function DeleteFamilyButton({ familyId }) {
  const { isOwner } = useIsOwner(familyId);
  
  if (!isOwner) return null;
  
  return <button onClick={handleDelete}>Delete Family</button>;
}
```

---

### useIsSuperAdmin

Check if user is a super admin (can access all families).

```typescript
import { useIsSuperAdmin } from '@/hooks';

function FamilyList() {
  const { isSuperAdmin, loading } = useIsSuperAdmin();
  
  // Super admins can see all families
  const { families } = useUserFamilies();
  
  return (
    <div>
      {isSuperAdmin && <span>👑 Super Admin Mode</span>}
      <FamilyCards families={families} />
    </div>
  );
}
```

---

### useIsMember

Check if user is a member of a family.

```typescript
import { useIsMember } from '@/hooks';

function FamilyPage({ familyId }) {
  const { isMember, loading } = useIsMember(familyId);
  
  if (loading) return <Spinner />;
  if (!isMember) return <Redirect to="/families" />;
  
  return <FamilyDashboard familyId={familyId} />;
}
```

---

### useUserRole

Get the user's role in a family.

```typescript
import { useUserRole } from '@/hooks';

function RoleBadge({ familyId }) {
  const { role, loading } = useUserRole(familyId);
  
  if (loading) return null;
  
  const colors = {
    owner: 'bg-purple-500',
    admin: 'bg-blue-500',
    editor: 'bg-green-500',
    viewer: 'bg-gray-500'
  };
  
  return (
    <span className={`badge ${colors[role]}`}>
      {role}
    </span>
  );
}
```

---

### useRequireAuth

Ensure user is authenticated (for protected routes).

```typescript
import { useRequireAuth } from '@/hooks';

function ProtectedPage() {
  const { user, loading } = useRequireAuth();
  
  if (loading) return <Spinner />;
  if (!user) return null; // Will redirect to login
  
  return <Dashboard user={user} />;
}
```

---

### useRequireGuest

Ensure user is NOT authenticated (for login/register pages).

```typescript
import { useRequireGuest } from '@/hooks';

function LoginPage() {
  const { loading } = useRequireGuest();
  
  if (loading) return <Spinner />;
  // Logged-in users will be redirected to dashboard
  
  return <LoginForm />;
}
```

---

### useHasPermission

Check if user has a specific permission.

```typescript
import { useHasPermission } from '@/hooks';

function InviteButton({ familyId }) {
  const { hasPermission } = useHasPermission(familyId, 'INVITE_MEMBERS');
  
  if (!hasPermission) return null;
  
  return <button>Invite Member</button>;
}
```

**Available Permissions:**

| Permission | Description |
|------------|-------------|
| `VIEW_TREE` | View family tree |
| `CREATE_PERSON` | Create new person |
| `EDIT_PERSON` | Edit existing person |
| `DELETE_PERSON` | Delete person |
| `MANAGE_RELATIONSHIPS` | Add/remove relationships |
| `INVITE_MEMBERS` | Invite new members |
| `REMOVE_MEMBERS` | Remove members |
| `EDIT_FAMILY_SETTINGS` | Edit family settings |
| `DELETE_FAMILY` | Delete family |

---

## 📊 Firestore Hooks

**Location:** `src/hooks/useFirestore.ts`

### useFamily

Fetch a single family by ID.

```typescript
import { useFamily } from '@/hooks';

function FamilyHeader({ familyId }) {
  const { family, loading, error } = useFamily(familyId);
  
  if (loading) return <Skeleton />;
  if (error) return <Error message={error.message} />;
  
  return (
    <h1>{family.displayName}</h1>
  );
}
```

**Returns:**

```typescript
{
  family: Family | null;
  loading: boolean;
  error: Error | null;
}
```

---

### useUserFamilies

Fetch all families where user is owner or member.

```typescript
import { useUserFamilies } from '@/hooks';

function FamilyList() {
  const { families, loading, error, refetch } = useUserFamilies();
  
  if (loading) return <Spinner />;
  
  return (
    <div>
      {families.map(family => (
        <FamilyCard key={family.familyId} family={family} />
      ))}
    </div>
  );
}
```

**Returns:**

```typescript
{
  families: Family[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

---

### usePersons

Fetch all persons in a family (non-realtime).

```typescript
import { usePersons } from '@/hooks';

function PersonList({ familyId }) {
  const { persons, loading, error, refetch } = usePersons(familyId);
  
  return (
    <ul>
      {persons.map(person => (
        <li key={person.personId}>{person.fullName}</li>
      ))}
    </ul>
  );
}
```

---

### usePersonsRealtime

Subscribe to persons with real-time updates.

```typescript
import { usePersonsRealtime } from '@/hooks';

function LivePersonList({ familyId }) {
  const { persons, loading, error } = usePersonsRealtime(familyId);
  
  // Automatically updates when data changes
  
  return (
    <ul>
      {persons.map(person => (
        <li key={person.personId}>{person.fullName}</li>
      ))}
    </ul>
  );
}
```

---

### useRelationships

Fetch all relationships in a family.

```typescript
import { useRelationships } from '@/hooks';

function RelationshipStats({ familyId }) {
  const { relationships, loading } = useRelationships(familyId);
  
  const spouseCount = relationships.filter(r => r.type === 'spouse').length;
  const parentChildCount = relationships.filter(r => r.type === 'parent-child').length;
  
  return (
    <div>
      <p>Marriages: {spouseCount}</p>
      <p>Parent-Child: {parentChildCount}</p>
    </div>
  );
}
```

---

### useRelationshipsRealtime

Subscribe to relationships with real-time updates.

```typescript
import { useRelationshipsRealtime } from '@/hooks';

function LiveRelationships({ familyId }) {
  const { relationships, loading } = useRelationshipsRealtime(familyId);
  
  return <RelationshipList relationships={relationships} />;
}
```

---

### useFamilyTree

Get complete family tree data with calculated generations.

```typescript
import { useFamilyTree } from '@/hooks';

function FamilyTreePage({ familyId }) {
  const { 
    persons, 
    relationships, 
    generations,  // Map<personId, number>
    rootAncestor,
    stats,        // { totalGenerations, personsByGeneration, disconnectedCount }
    loading, 
    error 
  } = useFamilyTree(familyId);
  
  if (loading) return <TreeSkeleton />;
  
  return (
    <FamilyTree
      persons={persons}
      relationships={relationships}
      generations={generations}
      rootAncestor={rootAncestor}
    />
  );
}
```

**Returns:**

```typescript
{
  persons: Person[];
  relationships: Relationship[];
  generations: Map<string, number>;
  rootAncestor: Person | null;
  stats: {
    totalGenerations: number;
    personsByGeneration: Record<number, number>;
    disconnectedCount: number;
  };
  loading: boolean;
  error: Error | null;
}
```

---

### usePersonGeneration

Get generation for a specific person.

```typescript
import { usePersonGeneration } from '@/hooks';

function PersonCard({ familyId, personId }) {
  const { generation, label, loading } = usePersonGeneration(familyId, personId);
  
  return (
    <div>
      <p>Generation: {generation}</p>
      <p>Label: {label}</p> {/* e.g., "Cucu" */}
    </div>
  );
}
```

---

## 🔄 Hook Composition Example

Combining multiple hooks:

```typescript
function FamilyDashboard({ familyId }) {
  // Auth hooks
  const { user } = useAuth();
  const { canEdit } = useCanEdit(familyId);
  const { isAdmin } = useIsAdmin(familyId);
  
  // Data hooks
  const { family, loading: familyLoading } = useFamily(familyId);
  const { persons, stats } = useFamilyTree(familyId);
  
  if (familyLoading) return <DashboardSkeleton />;
  
  return (
    <div>
      <Header 
        family={family}
        showAdminMenu={isAdmin}
      />
      
      <Stats
        personCount={persons.length}
        generationCount={stats.totalGenerations}
      />
      
      <FamilyTree 
        persons={persons}
        editable={canEdit}
      />
      
      {canEdit && <AddPersonButton />}
    </div>
  );
}
```

---

**Selanjutnya:** [07-AKSARA-LONTARA.md](./07-AKSARA-LONTARA.md)
