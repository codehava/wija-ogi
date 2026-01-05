# 02 - Getting Started

## 📋 Prerequisites

Sebelum memulai, pastikan sistem Anda memiliki:

| Requirement | Minimum Version |
|-------------|-----------------|
| Node.js | 18.17.0+ |
| npm / pnpm | npm 9+ / pnpm 8+ |
| Git | 2.x |

---

## 🚀 Installation

### 1. Clone Repository

```bash
git clone https://github.com/your-org/wija.git
cd wija
```

### 2. Install Dependencies

```bash
# Menggunakan npm
npm install

# Atau menggunakan pnpm
pnpm install
```

### 3. Setup Environment Variables

Copy file environment example:

```bash
cp .env.example .env.local
```

Edit `.env.local` dengan konfigurasi Firebase Anda:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

---

## 🔥 Firebase Setup

### 1. Buat Firebase Project

1. Buka [Firebase Console](https://console.firebase.google.com)
2. Klik **Add Project**
3. Ikuti wizard untuk membuat project baru

### 2. Enable Authentication

1. Di Firebase Console, pilih **Authentication**
2. Klik **Get Started**
3. Enable **Email/Password** provider
4. (Optional) Enable **Google** provider

### 3. Setup Firestore Database

1. Pilih **Firestore Database**
2. Klik **Create Database**
3. Pilih **Start in test mode** untuk development
4. Pilih region terdekat (asia-southeast1 untuk Indonesia)

### 4. Setup Storage

1. Pilih **Storage**
2. Klik **Get Started**
3. Accept default rules untuk development

### 5. Get Firebase Config

1. Buka **Project Settings** (gear icon)
2. Scroll ke **Your apps**
3. Klik icon **Web** (</>)
4. Register app dan copy config ke `.env.local`

---

## 💻 Development Commands

### Run Development Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm run start
```

---

## 📁 Environment Files

| File | Purpose |
|------|---------|
| `.env.example` | Template konfigurasi |
| `.env.local` | Development environment (gitignored) |
| `.env.production` | Production environment |

---

## 🔐 Firebase Security Rules

### Firestore Rules

File: `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isFamilyMember(familyId) {
      return isAuthenticated() && 
        exists(/databases/$(database)/documents/families/$(familyId)/members/$(request.auth.uid));
    }
    
    function canEdit(familyId) {
      let role = get(/databases/$(database)/documents/families/$(familyId)/members/$(request.auth.uid)).data.role;
      return role in ['owner', 'admin', 'editor'];
    }
    
    // Families
    match /families/{familyId} {
      allow read: if isFamilyMember(familyId);
      allow create: if isAuthenticated();
      allow update, delete: if canEdit(familyId);
      
      // Persons subcollection
      match /persons/{personId} {
        allow read: if isFamilyMember(familyId);
        allow write: if canEdit(familyId);
      }
      
      // Relationships subcollection
      match /relationships/{relId} {
        allow read: if isFamilyMember(familyId);
        allow write: if canEdit(familyId);
      }
      
      // Members subcollection
      match /members/{memberId} {
        allow read: if isFamilyMember(familyId);
        allow write: if canEdit(familyId);
      }
    }
    
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Invitations
    match /invitations/{inviteId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated();
    }
  }
}
```

### Storage Rules

File: `storage.rules`

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 🚀 Deploy Firebase Rules

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Storage rules
firebase deploy --only storage

# Deploy all
firebase deploy
```

---

## ❓ Troubleshooting

### Error: Firebase App not initialized

**Solusi:** Pastikan semua environment variables sudah diset dengan benar di `.env.local`

### Error: Permission denied

**Solusi:** Check Firestore rules dan pastikan user sudah login

### Error: Module not found

**Solusi:** Jalankan `npm install` atau hapus `node_modules` dan install ulang

```bash
rm -rf node_modules
npm install
```

---

**Selanjutnya:** [03-ARCHITECTURE.md](./03-ARCHITECTURE.md)
