# 05 - Services & API

## 📁 Service Structure

```
src/lib/
├── firebase/
│   ├── config.ts          # Firebase initialization
│   └── auth.ts            # Auth helpers
├── services/
│   ├── families.ts        # Family CRUD
│   ├── persons.ts         # Person CRUD
│   ├── relationships.ts   # Relationship CRUD
│   ├── invitations.ts     # Invitation management
│   └── exports.ts         # Export service
├── transliteration/
│   └── engine.ts          # Lontara transliteration
└── generation/
    └── calculator.ts      # Generation calculation
```

---

## 🔥 Firebase Configuration

**Location:** `src/lib/firebase/config.ts`

```typescript
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
```

---

## 👨‍👩‍👧‍👦 Families Service

**Location:** `src/lib/services/families.ts`

### createFamily

Create a new family (tenant).

```typescript
import { createFamily } from '@/lib/services/families';

const familyId = await createFamily({
  name: 'Keluarga Budiman',
  displayName: 'Budiman Family Tree',
  ownerId: userId,
  settings: {
    script: 'both',
    theme: 'light',
    language: 'id'
  }
});
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `name` | string | Family name |
| `displayName` | string | Display name |
| `ownerId` | string | Owner user ID |
| `settings` | FamilySettings | Family settings |

**Returns:** `Promise<string>` - Family ID

---

### getFamily

Get family by ID.

```typescript
import { getFamily } from '@/lib/services/families';

const family = await getFamily(familyId);
```

---

### updateFamily

Update family details.

```typescript
import { updateFamily } from '@/lib/services/families';

await updateFamily(familyId, {
  displayName: 'New Display Name',
  settings: { script: 'lontara' }
});
```

---

### deleteFamily

Delete a family and all subcollections.

```typescript
import { deleteFamily } from '@/lib/services/families';

await deleteFamily(familyId);
```

---

### getUserFamilies

Get families where user is owner or member.

```typescript
import { getUserFamilies } from '@/lib/services/families';

const families = await getUserFamilies(userId);
```

---

### subscribeToFamily

Real-time subscription to family changes.

```typescript
import { subscribeToFamily } from '@/lib/services/families';

const unsubscribe = subscribeToFamily(familyId, (family) => {
  console.log('Family updated:', family);
});

// Cleanup
unsubscribe();
```

---

## 👤 Persons Service

**Location:** `src/lib/services/persons.ts`

### createPerson

Create a new person in family tree.

```typescript
import { createPerson } from '@/lib/services/persons';

const personId = await createPerson(familyId, {
  firstName: 'Ahmad',
  lastName: 'Budiman',
  gender: 'male',
  birthDate: '1990-01-15',
  birthPlace: 'Makassar',
  isLiving: true,
  isRootAncestor: false
}, userId);
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `familyId` | string | Family ID |
| `input` | CreatePersonInput | Person data |
| `userId` | string | Creator user ID |

**Returns:** `Promise<string>` - Person ID

**Notes:**
- `lontaraName` is auto-generated from `latinName`
- Relationships are updated automatically

---

### getPerson

Get person by ID.

```typescript
import { getPerson } from '@/lib/services/persons';

const person = await getPerson(familyId, personId);
```

---

### updatePerson

Update person details.

```typescript
import { updatePerson } from '@/lib/services/persons';

await updatePerson(familyId, personId, {
  firstName: 'Ahmad Updated',
  birthPlace: 'Jakarta'
}, userId);
```

---

### deletePerson

Delete person and cleanup relationships.

```typescript
import { deletePerson } from '@/lib/services/persons';

await deletePerson(familyId, personId);
```

---

### getAllPersons

Get all persons in a family.

```typescript
import { getAllPersons } from '@/lib/services/persons';

const persons = await getAllPersons(familyId);
```

---

### subscribeToPersons

Real-time subscription to persons.

```typescript
import { subscribeToPersons } from '@/lib/services/persons';

const unsubscribe = subscribeToPersons(familyId, (persons) => {
  console.log('Persons updated:', persons.length);
});
```

---

### linkParentChild

Link a parent to a child.

```typescript
import { linkParentChild } from '@/lib/services/persons';

await linkParentChild(familyId, parentId, childId);
```

---

### linkSpouses

Link two persons as spouses.

```typescript
import { linkSpouses } from '@/lib/services/persons';

await linkSpouses(familyId, person1Id, person2Id);
```

---

## 💍 Relationships Service

**Location:** `src/lib/services/relationships.ts`

### createRelationship

Create a relationship between two persons.

```typescript
import { createRelationship } from '@/lib/services/relationships';

const relId = await createRelationship(familyId, {
  type: 'spouse',
  person1Id: husbandId,
  person2Id: wifeId,
  marriage: {
    date: '2015-06-20',
    place: 'Makassar',
    status: 'married'
  }
});
```

---

### getRelationship

Get relationship by ID.

```typescript
import { getRelationship } from '@/lib/services/relationships';

const rel = await getRelationship(familyId, relationshipId);
```

---

### updateRelationship

Update relationship details.

```typescript
import { updateRelationship } from '@/lib/services/relationships';

await updateRelationship(familyId, relationshipId, {
  marriage: { status: 'divorced' }
});
```

---

### deleteRelationship

Delete a relationship.

```typescript
import { deleteRelationship } from '@/lib/services/relationships';

await deleteRelationship(familyId, relationshipId);
```

---

### getAllRelationships

Get all relationships in a family.

```typescript
import { getAllRelationships } from '@/lib/services/relationships';

const relationships = await getAllRelationships(familyId);
```

---

### subscribeToRelationships

Real-time subscription to relationships.

```typescript
import { subscribeToRelationships } from '@/lib/services/relationships';

const unsubscribe = subscribeToRelationships(familyId, (rels) => {
  console.log('Relationships updated:', rels.length);
});
```

---

## 📨 Invitations Service

**Location:** `src/lib/services/invitations.ts`

### createInvitation

Create an invitation for a new member.

```typescript
import { createInvitation } from '@/lib/services/invitations';

const inviteId = await createInvitation({
  familyId: 'family123',
  email: 'newmember@example.com',
  role: 'editor',
  invitedBy: userId
});
```

---

### acceptInvitation

Accept an invitation.

```typescript
import { acceptInvitation } from '@/lib/services/invitations';

await acceptInvitation(invitationId, userId);
```

---

### cancelInvitation

Cancel/delete an invitation.

```typescript
import { cancelInvitation } from '@/lib/services/invitations';

await cancelInvitation(invitationId);
```

---

### getInvitationsByFamily

Get all invitations for a family.

```typescript
import { getInvitationsByFamily } from '@/lib/services/invitations';

const invitations = await getInvitationsByFamily(familyId);
```

---

## 📤 Export Service

**Location:** `src/lib/services/exports.ts`

### exportToImage

Export family tree as image (PNG).

```typescript
import { exportToImage } from '@/lib/services/exports';

const dataUrl = await exportToImage(treeElement, {
  format: 'png',
  quality: 0.95,
  backgroundColor: '#ffffff'
});

// Download
const link = document.createElement('a');
link.download = 'family-tree.png';
link.href = dataUrl;
link.click();
```

---

### exportToPDF

Export family tree as PDF.

```typescript
import { exportToPDF } from '@/lib/services/exports';

await exportToPDF(treeElement, {
  filename: 'family-tree.pdf',
  orientation: 'landscape',
  format: 'a4',
  script: 'both'
});
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `filename` | string | Output filename |
| `orientation` | 'portrait' \| 'landscape' | Page orientation |
| `format` | 'a4' \| 'a3' \| 'letter' | Paper size |
| `script` | 'latin' \| 'lontara' \| 'both' | Script mode |

---

## 📜 Transliteration Engine

**Location:** `src/lib/transliteration/engine.ts`

### transliterateLatin

Transliterate Latin text to Lontara.

```typescript
import { transliterateLatin } from '@/lib/transliteration/engine';

const result = transliterateLatin('Budiman');
console.log(result.lontara);  // ᨅᨘᨉᨗᨆᨊ
console.log(result.details);  // Array of transliteration steps
```

**Returns:**

```typescript
interface TransliterationResult {
  original: string;      // Original Latin text
  lontara: string;       // Transliterated Lontara text
  details: Array<{
    latin: string;
    lontara: string;
    type: 'consonant' | 'vowel' | 'foreign' | 'cluster';
  }>;
}
```

---

### transliterateName

Transliterate a name object.

```typescript
import { transliterateName } from '@/lib/transliteration/engine';

const lontaraName = transliterateName({
  first: 'Ahmad',
  middle: 'Budiman',
  last: 'Putra'
});
// { first: 'ᨕᨖᨆᨉ', middle: 'ᨅᨘᨉᨗᨆᨊ', last: 'ᨄᨘᨈᨑ' }
```

---

### getLontaraReference

Get reference table of all Lontara characters.

```typescript
import { getLontaraReference } from '@/lib/transliteration/engine';

const reference = getLontaraReference();
// { consonants: {...}, vowels: {...}, diacritics: {...} }
```

---

## 🔢 Generation Calculator

**Location:** `src/lib/generation/calculator.ts`

### calculateGeneration

Calculate generation number for a person.

```typescript
import { calculateGeneration } from '@/lib/generation/calculator';

const gen = calculateGeneration(personId, rootAncestorId, personsMap);
// 3 (meaning 3rd generation from root)
```

---

### getGenerationLabel

Get Indonesian label for generation.

```typescript
import { getGenerationLabel } from '@/lib/generation/calculator';

getGenerationLabel(1);  // "Leluhur"
getGenerationLabel(2);  // "Anak"
getGenerationLabel(3);  // "Cucu"
getGenerationLabel(10); // "Generasi ke-10"
```

---

### calculateAllGenerations

Calculate generations for all persons.

```typescript
import { calculateAllGenerations } from '@/lib/generation/calculator';

const genMap = calculateAllGenerations(persons, rootId);
// Map<personId, generation>
```

---

### findRootAncestor

Find the root ancestor in a person list.

```typescript
import { findRootAncestor } from '@/lib/generation/calculator';

const root = findRootAncestor(persons);
// Person with isRootAncestor = true
```

---

### getGenerationStats

Get statistics about generations.

```typescript
import { getGenerationStats } from '@/lib/generation/calculator';

const stats = getGenerationStats(persons, rootId);
// { totalGenerations: 5, personsByGeneration: {1: 2, 2: 4, ...}, disconnectedCount: 0 }
```

---

**Selanjutnya:** [06-HOOKS.md](./06-HOOKS.md)
