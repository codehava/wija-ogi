# 04 - Components

## 📦 Component Structure

```
src/components/
├── ui/                     # Base UI components
│   ├── Modal.tsx
│   ├── Button.tsx
│   ├── Input.tsx
│   └── ...
├── tree/                   # Tree visualization
│   ├── FamilyTree.tsx
│   ├── RelationshipLine.tsx
│   └── index.ts
├── person/                 # Person management
│   ├── PersonForm.tsx
│   ├── PersonCard.tsx
│   ├── SidebarEditForm.tsx
│   └── ...
├── aksara/                 # Lontara components
│   ├── LontaraInput.tsx
│   ├── DualScriptDisplay.tsx
│   └── ...
├── relationship/           # Relationship components
│   ├── RelationshipForm.tsx
│   └── ...
├── export/                 # Export components
│   ├── ExportModal.tsx
│   └── index.ts
├── invitation/             # Invitation components
│   └── ...
└── layout/                 # Layout components
    ├── Header.tsx
    └── Sidebar.tsx
```

---

## 🎨 UI Components

### Modal

Generic modal dialog component.

**Location:** `src/components/ui/Modal.tsx`

```tsx
import { Modal } from '@/components/ui/Modal';

<Modal
  isOpen={isOpen}
  onClose={handleClose}
  title="Modal Title"
  size="md"  // 'sm' | 'md' | 'lg' | 'xl'
>
  <p>Modal content here</p>
</Modal>
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | boolean | required | Controls modal visibility |
| `onClose` | () => void | required | Callback when modal closes |
| `title` | string | - | Modal header title |
| `size` | 'sm' \| 'md' \| 'lg' \| 'xl' | 'md' | Modal size |
| `children` | ReactNode | - | Modal content |

---

## 🌳 Tree Components

### FamilyTree

Main family tree visualization component using Dagre for layout.

**Location:** `src/components/tree/FamilyTree.tsx`

```tsx
import { FamilyTree } from '@/components/tree';

<FamilyTree
  familyId="family123"
  onPersonClick={handlePersonClick}
  onPersonEdit={handlePersonEdit}
  scriptMode="both"
/>
```

**Features:**
- Interactive canvas with zoom & pan
- Dynamic layout using Dagre algorithm
- Dual script display (Latin/Lontara)
- Responsive to any number of generations (24+)
- Auto-fit zoom on load
- Mouse wheel zoom with Ctrl/⌘

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `familyId` | string | ID of the family to display |
| `onPersonClick` | (person: Person) => void | Callback on person click |
| `onPersonEdit` | (person: Person) => void | Callback on edit button click |
| `scriptMode` | 'latin' \| 'lontara' \| 'both' | Display mode for names |

---

### RelationshipLine

SVG line component for connecting family members.

**Location:** `src/components/tree/RelationshipLine.tsx`

```tsx
<RelationshipLine
  type="parent-child"
  startX={100}
  startY={50}
  endX={100}
  endY={150}
/>
```

---

## 👤 Person Components

### PersonForm

Form for creating/editing family members.

**Location:** `src/components/person/PersonForm.tsx`

```tsx
import { PersonForm } from '@/components/person';

<PersonForm
  familyId="family123"
  initialData={existingPerson}  // Optional for edit mode
  onSuccess={handleSuccess}
  onCancel={handleCancel}
/>
```

**Features:**
- Auto-transliteration of names to Lontara
- Gender selection
- Birth/death date and place
- Relationship management (parent/spouse linking)
- Photo upload

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `familyId` | string | Family ID |
| `initialData` | Person | Optional existing person for edit |
| `onSuccess` | () => void | Callback on successful save |
| `onCancel` | () => void | Callback on cancel |

---

### SidebarEditForm

Sidebar form for quick editing of person details.

**Location:** `src/components/person/SidebarEditForm.tsx`

```tsx
<SidebarEditForm
  person={selectedPerson}
  familyId="family123"
  onClose={handleClose}
/>
```

---

### PersonCard

Card component displaying person information.

```tsx
<PersonCard
  person={person}
  scriptMode="both"
  showGeneration={true}
  generation={3}
  onClick={handleClick}
/>
```

---

## 📜 Aksara Components

### LontaraInput

Input field with auto-transliteration preview.

**Location:** `src/components/aksara/LontaraInput.tsx`

```tsx
import { LontaraInput } from '@/components/aksara';

<LontaraInput
  value={latinText}
  onChange={(latin, lontara) => {
    setLatinName(latin);
    setLontaraPreview(lontara);
  }}
  showPreview={true}
  label="Nama Depan"
/>
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `value` | string | Latin text value |
| `onChange` | (latin: string, lontara: string) => void | Callback with both scripts |
| `showPreview` | boolean | Show Lontara preview |
| `label` | string | Input label |

---

### DualScriptDisplay

Component to display text in both Latin and Lontara.

**Location:** `src/components/aksara/DualScriptDisplay.tsx`

```tsx
import { DualScriptDisplay } from '@/components/aksara';

<DualScriptDisplay
  latinText="Budiman"
  mode="both"        // 'latin' | 'lontara' | 'both'
  size="lg"          // 'sm' | 'md' | 'lg' | 'xl'
/>

// Output:
// Budiman
// ᨅᨘᨉᨗᨆᨊ
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `latinText` | string | required | Text to display |
| `mode` | 'latin' \| 'lontara' \| 'both' | 'both' | Display mode |
| `size` | 'sm' \| 'md' \| 'lg' \| 'xl' | 'md' | Text size |

---

### LontaraReference

Reference card showing Lontara character mappings.

```tsx
<LontaraReference />
```

---

## 💍 Relationship Components

### RelationshipForm

Form for managing relationships between persons.

**Location:** `src/components/relationship/RelationshipForm.tsx`

```tsx
<RelationshipForm
  familyId="family123"
  personId="person456"
  type="spouse"  // 'spouse' | 'parent-child'
  onSuccess={handleSuccess}
/>
```

---

## 📤 Export Components

### ExportModal

Modal for exporting family tree to PDF/Image.

**Location:** `src/components/export/ExportModal.tsx`

```tsx
import { ExportModal } from '@/components/export';

<ExportModal
  isOpen={showExport}
  onClose={() => setShowExport(false)}
  familyId="family123"
/>
```

**Export Options:**
- Format: PDF, PNG, SVG
- Script: Latin only, Lontara only, Both
- Include: Photos, Biographies, Dates
- Paper size: A4, A3, Letter
- Orientation: Landscape, Portrait

---

## 📨 Invitation Components

### InvitationForm

Form for inviting new members to family.

```tsx
<InvitationForm
  familyId="family123"
  onSuccess={handleSuccess}
/>
```

### InvitationList

List of pending invitations.

```tsx
<InvitationList familyId="family123" />
```

---

## 🎨 Layout Components

### Header

Application header with navigation and user menu.

**Location:** `src/components/layout/Header.tsx`

```tsx
<Header
  familyName="Keluarga Budiman"
  onMenuClick={toggleSidebar}
/>
```

### Sidebar

Main navigation sidebar.

**Location:** `src/components/layout/Sidebar.tsx`

```tsx
<Sidebar
  isOpen={sidebarOpen}
  familyId="family123"
  currentPage="tree"
/>
```

---

## 🎨 Component Design System

### Colors

```css
/* Brand Colors */
--wija-primary: #FAB034;         /* Amber/Gold */
--wija-secondary: #F89F1F;
--wija-accent: #E68A0F;

/* Gender Colors */
--node-male: #3B82F6;            /* Blue */
--node-female: #EC4899;          /* Pink */

/* Script Colors */
--lontara-text: #92400E;         /* Amber-800 */
--lontara-bg: #FEF3C7;           /* Amber-100 */
```

### Typography

```css
/* Latin fonts */
font-family: 'Inter', sans-serif;

/* Lontara font */
.font-lontara {
  font-family: 'Noto Sans Buginese', serif;
}
```

---

**Selanjutnya:** [05-SERVICES-API.md](./05-SERVICES-API.md)
