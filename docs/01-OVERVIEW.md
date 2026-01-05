# 01 - Overview

## 🌟 Ringkasan Eksekutif

**WIJA** (Warisan Jejak Keluarga) adalah aplikasi Pohon Keluarga Digital modern dengan:

- Arsitektur **multitenant** (setiap keluarga = 1 tenant)
- Mendukung hingga **30-40 generasi** (kalkulasi dinamis)
- **Dual aksara**: Latin & Lontara dengan auto-transliterasi
- **Real-time collaboration** antar anggota keluarga

---

## 🎯 Vision & Mission

### Vision
Menjadi platform terdepan untuk preservasi dan dokumentasi sejarah keluarga di Indonesia dengan teknologi modern dan penghormatan terhadap budaya lokal.

### Mission
- Memudahkan keluarga mendokumentasikan silsilah hingga puluhan generasi
- Melestarikan aksara tradisional melalui teknologi digital
- Menyediakan platform kolaborasi keluarga yang aman dan real-time

---

## 💎 Keunggulan Utama

| Feature | Description | Technology |
|---------|-------------|------------|
| 🏠 **Multitenant** | Setiap keluarga punya workspace terpisah | Firestore Collections |
| 🔄 **Dynamic Generation** | Generasi dihitung dari relationships | BFS Algorithm |
| 📜 **Dual Aksara** | Latin & Lontara auto-transliteration | Unicode + Custom Engine |
| 🌐 **Foreign Letters** | F, V, Z, X, dll dengan pendekatan fonologis | Phonetic Mapping |
| 🔥 **Real-time Sync** | Perubahan langsung terlihat semua user | Firestore Real-time |
| 📱 **Mobile Ready** | Responsive design & PWA support | Next.js + TailwindCSS |

---

## 🔥 Tech Stack

### Frontend

| Teknologi | Versi | Kegunaan |
|-----------|-------|----------|
| Next.js | 15.x | React framework, SSR, App Router |
| React | 18.x | UI library dengan hooks |
| TypeScript | 5.x | Type safety |
| TailwindCSS | 3.x | Utility-first CSS |
| Zustand | 4.x | Client state management |
| TanStack Query | 5.x | Server state & caching |
| Dagre | 0.8.x | Graph layout algorithm |

### Backend (Firebase)

| Service | Kegunaan |
|---------|----------|
| Firebase Auth | Email/Password, Google OAuth |
| Cloud Firestore | NoSQL database, real-time sync |
| Firebase Storage | Photos, PDFs, assets |
| Firebase Hosting | CDN, SSL, custom domain |

### Aksara Support

| Komponen | Keterangan |
|----------|------------|
| Noto Sans Buginese | Font Lontara (Unicode) |
| Custom Engine | Transliterasi Latin → Lontara |
| Unicode Block | U+1A00 - U+1A1F (Buginese) |

---

## 📊 Feature Matrix by Plan

| Feature | Free | Basic | Premium |
|---------|------|-------|---------|
| Persons | 100 | 500 | Unlimited |
| Photos per person | 3 | 5 | 10 |
| Storage | 1 GB | 5 GB | 50 GB |
| PDF Exports/month | 5 | 20 | Unlimited |
| Real-time Sync | ✅ | ✅ | ✅ |
| Lontara Support | ✅ | ✅ | ✅ |
| Custom Templates | ❌ | ✅ | ✅ |
| API Access | ❌ | ❌ | ✅ |

---

## 📁 Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── family/                   # Family pages
│   ├── invite/                   # Invitation pages
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Landing/Dashboard page
├── components/
│   ├── ui/                       # Base UI components
│   ├── tree/                     # Tree visualization
│   ├── person/                   # Person management
│   ├── aksara/                   # Lontara components
│   ├── relationship/             # Relationship components
│   ├── export/                   # Export components
│   ├── invitation/               # Invitation components
│   └── layout/                   # Layout components
├── contexts/
│   └── AuthContext.tsx           # Authentication context
├── hooks/
│   ├── useAuth.ts                # Auth hooks
│   └── useFirestore.ts           # Firestore hooks
├── lib/
│   ├── firebase/                 # Firebase config & auth
│   ├── services/                 # Service layer
│   ├── transliteration/          # Lontara engine
│   └── generation/               # Generation calculator
└── types/
    └── index.ts                  # TypeScript types
```

---

## ⚠️ Breaking Changes v5.0

| Perubahan | Sebelum | Sesudah |
|-----------|---------|---------|
| Field `generation` | Disimpan di database | **DIHAPUS** - dikalkulasi runtime |
| Transliterasi | Manual | **AUTO** dari Latin ke Lontara |
| Huruf Asing | Tidak didukung | **11+ huruf** dengan pendekatan fonologis |

---

**Selanjutnya:** [02-GETTING-STARTED.md](./02-GETTING-STARTED.md)
