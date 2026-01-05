# 09 - Deployment

## 🚀 Deployment Overview

WIJA menggunakan **Firebase Hosting** untuk deployment dengan support untuk:
- Static site generation (SSG)
- Server-side rendering (SSR) via Cloud Functions
- CDN dengan SSL otomatis
- Custom domain

---

## 🌍 Environments

| Environment | URL | Branch |
|-------------|-----|--------|
| Development | `localhost:3000` | `feature/*` |
| Staging | `staging.wija.app` | `develop` |
| Production | `wija.app` | `main` |

---

## 📋 Prerequisites

1. **Node.js** 18.17+ installed
2. **Firebase CLI** installed and logged in
3. **Firebase Project** created

### Install Firebase CLI

```bash
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize project (if not done)
firebase init
```

---

## 🔧 Configuration Files

### firebase.json

```json
{
  "hosting": {
    "public": ".next",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|js|css|eot|otf|ttf|ttc|woff|woff2|font.css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      }
    ]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

### .firebaserc

```json
{
  "projects": {
    "default": "your-project-id",
    "staging": "your-project-id-staging",
    "production": "your-project-id"
  }
}
```

---

## 📦 Build Commands

### Development

```bash
# Start development server
npm run dev

# With turbo mode
npm run dev -- --turbo
```

### Production Build

```bash
# Build for production
npm run build

# Check build output
npm run start
```

### Type Check

```bash
npm run type-check
```

### Lint

```bash
npm run lint
```

---

## 🚀 Deploy Commands

### Deploy Everything

```bash
# Deploy hosting, rules, and indexes
firebase deploy
```

### Deploy Hosting Only

```bash
firebase deploy --only hosting
```

### Deploy Rules Only

```bash
# Firestore rules
firebase deploy --only firestore:rules

# Storage rules
firebase deploy --only storage
```

### Deploy Indexes Only

```bash
firebase deploy --only firestore:indexes
```

### Deploy to Specific Project

```bash
# Deploy to staging
firebase deploy --project staging

# Deploy to production
firebase deploy --project production
```

---

## 🔐 Environment Variables

### .env.example

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### .env.local (Development)

```env
# Development Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...dev
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=wija-dev.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=wija-dev
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=wija-dev.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

### .env.production

```env
# Production Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...prod
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=wija.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=wija-prod
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=wija-prod.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=987654321
NEXT_PUBLIC_FIREBASE_APP_ID=1:987654321:web:xyz789
```

---

## 🔒 Security Rules

### Firestore Rules

File: `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isSuperAdmin() {
      return isAuthenticated() && 
        exists(/databases/$(database)/documents/superadmins/$(request.auth.uid));
    }
    
    function isFamilyMember(familyId) {
      return isAuthenticated() && 
        exists(/databases/$(database)/documents/families/$(familyId)/members/$(request.auth.uid));
    }
    
    function canEdit(familyId) {
      return isSuperAdmin() || (
        isFamilyMember(familyId) &&
        get(/databases/$(database)/documents/families/$(familyId)/members/$(request.auth.uid)).data.role in ['owner', 'admin', 'editor']
      );
    }
    
    function isAdmin(familyId) {
      return isSuperAdmin() || (
        isFamilyMember(familyId) &&
        get(/databases/$(database)/documents/families/$(familyId)/members/$(request.auth.uid)).data.role in ['owner', 'admin']
      );
    }
    
    // Super admins
    match /superadmins/{userId} {
      allow read: if isAuthenticated();
    }
    
    // Users
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Families
    match /families/{familyId} {
      allow read: if isSuperAdmin() || isFamilyMember(familyId);
      allow create: if isAuthenticated();
      allow update: if isAdmin(familyId);
      allow delete: if isSuperAdmin() || 
        resource.data.ownerId == request.auth.uid;
      
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
    
    // Invitations
    match /invitations/{inviteId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (
        resource.data.invitedBy == request.auth.uid ||
        resource.data.email == request.auth.token.email
      );
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
    
    // Family photos
    match /families/{familyId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        request.resource.size < 10 * 1024 * 1024 && // 10MB limit
        request.resource.contentType.matches('image/.*');
    }
    
    // User avatars
    match /users/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth.uid == userId &&
        request.resource.size < 5 * 1024 * 1024;
    }
  }
}
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Example

File: `.github/workflows/deploy.yml`

```yaml
name: Deploy to Firebase

on:
  push:
    branches:
      - main
      - develop

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Type check
        run: npm run type-check
      
      - name: Lint
        run: npm run lint
      
      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: ${{ secrets.FIREBASE_AUTH_DOMAIN }}
          NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
          NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: ${{ secrets.FIREBASE_STORAGE_BUCKET }}
          NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.FIREBASE_MESSAGING_SENDER_ID }}
          NEXT_PUBLIC_FIREBASE_APP_ID: ${{ secrets.FIREBASE_APP_ID }}
      
      - name: Deploy to Firebase (Staging)
        if: github.ref == 'refs/heads/develop'
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_STAGING }}
          projectId: wija-staging
          channelId: live
      
      - name: Deploy to Firebase (Production)
        if: github.ref == 'refs/heads/main'
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_PROD }}
          projectId: wija-prod
          channelId: live
```

---

## 🌐 Custom Domain Setup

### 1. Add Custom Domain in Firebase Console

1. Go to **Hosting** → **Add custom domain**
2. Enter your domain (e.g., `wija.app`)
3. Follow verification steps

### 2. Update DNS Records

Add the following DNS records to your domain:

| Type | Host | Value |
|------|------|-------|
| A | @ | Firebase IP 1 |
| A | @ | Firebase IP 2 |
| TXT | @ | Verification token |

### 3. Wait for SSL Certificate

Firebase will automatically provision an SSL certificate (may take up to 24 hours).

---

## 📊 Monitoring

### Firebase Console

- **Hosting** - Deploy history, bandwidth usage
- **Analytics** - User engagement, events
- **Performance** - Load times, network latency
- **Crashlytics** - Error tracking

### Recommended Monitoring

```bash
# View hosting deployment history
firebase hosting:channel:list

# View current deployment
firebase hosting:sites:list
```

---

## 🔧 Troubleshooting

### Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
npm install

# Rebuild
npm run build
```

### Deploy Errors

```bash
# Check Firebase login
firebase login:list

# Re-login if needed
firebase login --reauth

# Check project
firebase projects:list
```

### Security Rules Not Updating

```bash
# Force deploy rules
firebase deploy --only firestore:rules --force
```

---

## 📝 Deployment Checklist

- [ ] Environment variables set correctly
- [ ] `npm run build` passes without errors
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Firestore rules tested
- [ ] Storage rules tested
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate active
- [ ] Analytics enabled
- [ ] Error tracking enabled

---

**Kembali ke:** [README.md](./README.md)
