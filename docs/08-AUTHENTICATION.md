# 08 - Authentication

## 🔐 Overview

WIJA menggunakan **Firebase Authentication** untuk manajemen autentikasi user dengan dukungan multiple providers dan role-based access control (RBAC).

---

## 🔥 Firebase Auth Setup

### Supported Methods

| Method | Status | Description |
|--------|--------|-------------|
| Email/Password | ✅ Enabled | Default authentication |
| Google OAuth | ✅ Enabled | One-click sign in |
| Facebook | 🔄 Optional | Requires app setup |
| Apple Sign In | 🔄 Optional | For iOS users |

### Enable in Firebase Console

1. Buka **Firebase Console** → Project Anda
2. Pilih **Authentication** → **Sign-in method**
3. Enable **Email/Password**
4. Enable **Google** (set support email)

---

## 🏗️ Auth Context

**Location:** `src/contexts/AuthContext.tsx`

### AuthProvider

```tsx
// layout.tsx
import { AuthProvider } from '@/contexts/AuthContext';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### useAuth Hook

```tsx
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { 
    user,           // Firebase User | null
    loading,        // boolean
    signIn,         // (email, password) => Promise
    signUp,         // (email, password, displayName) => Promise
    signOut,        // () => Promise
    signInWithGoogle // () => Promise
  } = useAuth();
  
  if (loading) return <Spinner />;
  if (!user) return <LoginPrompt />;
  
  return <Dashboard user={user} />;
}
```

---

## 📝 Authentication Flows

### Sign Up (Email/Password)

```tsx
const { signUp } = useAuth();

async function handleSignUp(email, password, name) {
  try {
    const user = await signUp(email, password, name);
    console.log('Signed up:', user.uid);
    router.push('/families');
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      setError('Email sudah terdaftar');
    } else {
      setError('Gagal mendaftar');
    }
  }
}
```

### Sign In (Email/Password)

```tsx
const { signIn } = useAuth();

async function handleSignIn(email, password) {
  try {
    const user = await signIn(email, password);
    router.push('/families');
  } catch (error) {
    if (error.code === 'auth/invalid-credential') {
      setError('Email atau password salah');
    }
  }
}
```

### Sign In with Google

```tsx
const { signInWithGoogle } = useAuth();

async function handleGoogleSignIn() {
  try {
    const user = await signInWithGoogle();
    router.push('/families');
  } catch (error) {
    setError('Gagal login dengan Google');
  }
}
```

### Sign Out

```tsx
const { signOut } = useAuth();

async function handleSignOut() {
  await signOut();
  router.push('/');
}
```

### Password Reset

```tsx
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';

async function handlePasswordReset(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    setMessage('Email reset password telah dikirim');
  } catch (error) {
    setError('Gagal mengirim email reset');
  }
}
```

---

## 👥 Role-Based Access Control (RBAC)

### Roles

| Role | Description |
|------|-------------|
| `superadmin` | System admin, can access all families |
| `owner` | Family creator, full control |
| `admin` | Family admin, manage members |
| `editor` | Can edit persons and relationships |
| `viewer` | Read-only access |

### Permission Matrix

| Permission | Super Admin | Owner | Admin | Editor | Viewer |
|------------|:-----------:|:-----:|:-----:|:------:|:------:|
| View tree | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create person | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit person | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete person | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage relationships | ✅ | ✅ | ✅ | ✅ | ❌ |
| Invite members | ✅ | ✅ | ✅ | ❌ | ❌ |
| Remove members | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit family settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete family | ✅ | ✅ | ❌ | ❌ | ❌ |
| Access all families | ✅ | ❌ | ❌ | ❌ | ❌ |

### Permission Code

```typescript
// src/hooks/useAuth.ts

const PERMISSIONS = {
    VIEW_TREE: ['superadmin', 'owner', 'admin', 'editor', 'viewer'],
    CREATE_PERSON: ['superadmin', 'owner', 'admin', 'editor'],
    EDIT_PERSON: ['superadmin', 'owner', 'admin', 'editor'],
    DELETE_PERSON: ['superadmin', 'owner', 'admin'],
    MANAGE_RELATIONSHIPS: ['superadmin', 'owner', 'admin', 'editor'],
    INVITE_MEMBERS: ['superadmin', 'owner', 'admin'],
    REMOVE_MEMBERS: ['superadmin', 'owner', 'admin'],
    EDIT_FAMILY_SETTINGS: ['superadmin', 'owner'],
    DELETE_FAMILY: ['superadmin', 'owner']
} as const;
```

---

## 🪝 Auth Hooks Usage

### Check Role

```tsx
import { useHasRole, useCanEdit, useIsAdmin } from '@/hooks';

function FamilyToolbar({ familyId }) {
  const { canEdit } = useCanEdit(familyId);
  const { isAdmin } = useIsAdmin(familyId);
  
  return (
    <div>
      {canEdit && <button>Add Person</button>}
      {isAdmin && <button>Manage Members</button>}
    </div>
  );
}
```

### Check Specific Permission

```tsx
import { useHasPermission } from '@/hooks';

function DeleteButton({ familyId, personId }) {
  const { hasPermission } = useHasPermission(familyId, 'DELETE_PERSON');
  
  if (!hasPermission) return null;
  
  return (
    <button onClick={() => deletePerson(personId)}>
      Delete
    </button>
  );
}
```

### Check Super Admin

```tsx
import { useIsSuperAdmin } from '@/hooks';

function AdminPanel() {
  const { isSuperAdmin, loading } = useIsSuperAdmin();
  
  if (!isSuperAdmin) return <AccessDenied />;
  
  return (
    <div>
      <h1>Super Admin Panel</h1>
      <AllFamiliesList />
    </div>
  );
}
```

---

## 🛡️ Protected Routes

### Route Protection Pattern

```tsx
// app/family/[id]/page.tsx
'use client';

import { useRequireAuth, useIsMember } from '@/hooks';
import { useParams, redirect } from 'next/navigation';

export default function FamilyPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { id: familyId } = useParams();
  const { isMember, loading: memberLoading } = useIsMember(familyId);
  
  // Redirects handled by useRequireAuth
  if (authLoading || memberLoading) {
    return <LoadingScreen />;
  }
  
  if (!isMember) {
    redirect('/families');
  }
  
  return <FamilyDashboard familyId={familyId} />;
}
```

### Guest-Only Routes

```tsx
// app/login/page.tsx
'use client';

import { useRequireGuest } from '@/hooks';

export default function LoginPage() {
  const { loading } = useRequireGuest();
  
  if (loading) return <LoadingScreen />;
  // Logged-in users are redirected to /families
  
  return <LoginForm />;
}
```

---

## 🔐 Super Admin Setup

Super admins are stored in the `superadmins` collection in Firestore.

### Add Super Admin (Firestore)

```javascript
// In Firebase Console or via admin script
db.collection('superadmins').doc(userId).set({
  userId: userId,
  email: 'admin@example.com',
  createdAt: firebase.firestore.FieldValue.serverTimestamp()
});
```

### Check Super Admin

```typescript
// useIsSuperAdmin hook
const { isSuperAdmin, loading } = useIsSuperAdmin();

if (isSuperAdmin) {
  // Can access all families
  const allFamilies = await getAllFamilies();
}
```

---

## 🔐 Security Rules

### Firestore Rules for Auth

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Check if user is super admin
    function isSuperAdmin() {
      return isAuthenticated() && 
        exists(/databases/$(database)/documents/superadmins/$(request.auth.uid));
    }
    
    // Check if user is family member
    function isFamilyMember(familyId) {
      return isAuthenticated() && 
        exists(/databases/$(database)/documents/families/$(familyId)/members/$(request.auth.uid));
    }
    
    // Check if user can edit (owner, admin, or editor)
    function canEdit(familyId) {
      return isSuperAdmin() || (
        isFamilyMember(familyId) &&
        get(/databases/$(database)/documents/families/$(familyId)/members/$(request.auth.uid)).data.role in ['owner', 'admin', 'editor']
      );
    }
    
    // Check if user is owner or admin
    function isAdmin(familyId) {
      return isSuperAdmin() || (
        isFamilyMember(familyId) &&
        get(/databases/$(database)/documents/families/$(familyId)/members/$(request.auth.uid)).data.role in ['owner', 'admin']
      );
    }
    
    // Super admins collection
    match /superadmins/{userId} {
      allow read: if isAuthenticated();
      // Only via admin SDK
    }
    
    // Families
    match /families/{familyId} {
      allow read: if isSuperAdmin() || isFamilyMember(familyId);
      allow create: if isAuthenticated();
      allow update: if isAdmin(familyId);
      allow delete: if isSuperAdmin() || 
        get(/databases/$(database)/documents/families/$(familyId)).data.ownerId == request.auth.uid;
      
      // Members
      match /members/{memberId} {
        allow read: if isSuperAdmin() || isFamilyMember(familyId);
        allow write: if isAdmin(familyId);
      }
      
      // Persons
      match /persons/{personId} {
        allow read: if isSuperAdmin() || isFamilyMember(familyId);
        allow write: if canEdit(familyId);
      }
      
      // Relationships
      match /relationships/{relId} {
        allow read: if isSuperAdmin() || isFamilyMember(familyId);
        allow write: if canEdit(familyId);
      }
    }
  }
}
```

---

## 🔑 Password Management

### Change Password

```tsx
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';

async function changePassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  
  // Re-authenticate first
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  
  // Update password
  await updatePassword(user, newPassword);
}
```

### Default Password for New Users

When admin creates a new user, a default password is set:

```typescript
const DEFAULT_PASSWORD = 'wija2024!';

async function createUserByAdmin(email, displayName) {
  // Create user with default password
  const userCredential = await createUserWithEmailAndPassword(
    auth, 
    email, 
    DEFAULT_PASSWORD
  );
  
  // Send password reset email
  await sendPasswordResetEmail(auth, email);
  
  return userCredential.user;
}
```

---

**Selanjutnya:** [09-DEPLOYMENT.md](./09-DEPLOYMENT.md)
