# 03 - Architecture

## 📐 High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                          │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────┐  │
│  │   Web Browser    │  │   Mobile App     │  │  Desktop    │  │
│  │   (Next.js PWA)  │  │ (React Native)   │  │   (Tauri)   │  │
│  └──────────────────┘  └──────────────────┘  └─────────────┘  │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                           │
├────────────────────────────────────────────────────────────────┤
│  Next.js 15 + React 18 + TypeScript                           │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Transliteration Engine  │  Generation Calculator       │  │
│  │  (Latin → Lontara)       │  (BFS from relationships)    │  │
│  └─────────────────────────────────────────────────────────┘  │
│  Zustand (State) + TanStack Query (Server State)              │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                     FIREBASE SERVICES                          │
├────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐   │
│  │   Firebase      │  │   Firestore     │  │   Storage    │   │
│  │  Authentication │  │    Database     │  │   (Files)    │   │
│  └─────────────────┘  └─────────────────┘  └──────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Architecture Principles

1. **Serverless First** - Firebase untuk mengurangi server management
2. **Real-time by Default** - Firestore real-time listeners
3. **No Stored Generation** - Kalkulasi dinamis dari relationships
4. **Auto-Transliteration** - Latin ke Lontara secara otomatis
5. **Security by Design** - Row-level security per family

---

## 🏠 Multitenant Model

```
Tenant = Family
  ├── Isolated data in subcollections
  ├── Separate storage folders
  ├── Independent subscriptions
  └── Role-based access per family
```

Setiap keluarga adalah tenant terpisah dengan data yang terisolasi.

---

## 📊 Database Schema (Firestore)

### Collection Structure

```
Firestore
│
├── families/                    # Tenant root
│   └── {familyId}/
│       ├── members/             # Family members (users)
│       ├── persons/             # Family tree nodes
│       ├── relationships/       # Spouse & parent-child
│       ├── activities/          # Activity logs
│       └── exports/             # PDF exports
│
├── users/                       # Global user profiles
│
├── invitations/                 # Pending invitations
│
└── superadmins/                 # Super admin users
```

---

### 1. Family Document

```typescript
interface Family {
  familyId: string;
  name: string;                  // "Keluarga Budiman"
  displayName: string;           // "Budiman Family Tree"
  slug: string;                  // "keluarga-budiman"
  
  ownerId: string;
  rootAncestorId?: string;       // Starting point for generation calc
  
  subscription: {
    plan: 'free' | 'basic' | 'premium' | 'enterprise';
    status: 'active' | 'cancelled' | 'expired' | 'trial';
  };
  
  settings: {
    script: 'latin' | 'lontara' | 'both';
    theme: 'light' | 'dark' | 'auto';
    language: 'id' | 'en';
  };
  
  stats: {
    memberCount: number;
    personCount: number;
    relationshipCount: number;
  };
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### 2. Person Document

```typescript
interface Person {
  personId: string;
  familyId: string;
  
  // Names
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName: string;              // Computed
  
  // Latin name
  latinName: {
    first: string;
    middle?: string;
    last: string;
  };
  
  // Lontara name (auto-transliterated)
  lontaraName: {
    first: string;
    middle?: string;
    last: string;
  };
  
  // Optional manual override
  lontaraNameCustom?: {
    first?: string;
    middle?: string;
    last?: string;
  };
  
  // Demographics
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;            // YYYY-MM-DD
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  isLiving: boolean;
  
  // Relationships
  relationships: {
    spouseIds: string[];
    parentIds: string[];         // Max 2
    childIds: string[];
    siblingIds: string[];        // Computed
  };
  
  isRootAncestor: boolean;       // Flag for generation calc
  birthOrder?: number;           // For child ordering (1-based)
  
  // Visualization
  position: {
    x: number;
    y: number;
    fixed: boolean;
  };
  
  // Media
  photoUrl?: string;
  thumbnailUrl?: string;
  biography?: string;
  
  // Audit
  createdBy: string;
  createdAt: Timestamp;
  updatedBy: string;
  updatedAt: Timestamp;
}
```

---

### 3. Relationship Document

```typescript
interface Relationship {
  relationshipId: string;
  familyId: string;
  
  type: 'spouse' | 'parent-child';
  
  person1Id: string;             // Parent or spouse
  person2Id: string;             // Child or spouse
  
  marriage?: {
    date?: string;
    place?: string;
    placeLontara?: string;       // Auto-transliterated
    status: 'married' | 'divorced' | 'widowed';
  };
  
  parentChild?: {
    biologicalParent: boolean;
  };
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### 4. Member Document

```typescript
interface Member {
  memberId: string;              // Same as userId
  familyId: string;
  userId: string;
  
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  permissions: string[];
  
  displayName: string;
  email: string;
  photoUrl?: string;
  
  invitedBy: string;
  invitedAt: Timestamp;
  joinedAt: Timestamp;
}
```

---

## 🔄 Dynamic Generation Calculation

Generasi **TIDAK** disimpan di database, melainkan dihitung secara dinamis menggunakan algoritma BFS.

### Algorithm

```typescript
function calculateGeneration(
  personId: string,
  rootId: string,
  personsMap: Map<string, Person>
): number {
  if (!personId || !rootId) return -1;
  if (personId === rootId) return 1;

  const visited = new Set<string>();
  const queue = [{ id: rootId, gen: 1 }];

  while (queue.length > 0) {
    const { id, gen } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    if (id === personId) return gen;

    const person = personsMap.get(id);
    if (!person) continue;

    // Add children (next generation)
    for (const childId of person.relationships.childIds) {
      if (!visited.has(childId)) {
        queue.push({ id: childId, gen: gen + 1 });
      }
    }
  }

  return -1; // Not connected
}
```

### Generation Labels

| Gen | Label (Indonesian) |
|-----|-------------------|
| 1 | Leluhur |
| 2 | Anak |
| 3 | Cucu |
| 4 | Cicit |
| 5 | Canggah |
| 6 | Wareng |
| 7 | Udeg-udeg |
| 8 | Gantung Siwur |
| 9+ | Generasi ke-N |

---

## 🔐 Security Model

### Role Permissions

| Permission | Owner | Admin | Editor | Viewer |
|------------|-------|-------|--------|--------|
| View tree | ✅ | ✅ | ✅ | ✅ |
| Create person | ✅ | ✅ | ✅ | ❌ |
| Edit person | ✅ | ✅ | ✅ | ❌ |
| Delete person | ✅ | ✅ | ❌ | ❌ |
| Manage relationships | ✅ | ✅ | ✅ | ❌ |
| Invite members | ✅ | ✅ | ❌ | ❌ |
| Remove members | ✅ | ✅ | ❌ | ❌ |
| Edit family settings | ✅ | ❌ | ❌ | ❌ |
| Delete family | ✅ | ❌ | ❌ | ❌ |

---

## 📊 Data Flow

```
User Action
    │
    ▼
React Component
    │
    ├── Zustand Store (UI State)
    │
    └── TanStack Query ──► Service Layer ──► Firestore
                                │
                                ▼
                          Real-time Listener
                                │
                                ▼
                          UI Update
```

---

**Selanjutnya:** [04-COMPONENTS.md](./04-COMPONENTS.md)
