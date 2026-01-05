# WIJA - Dokumentasi

> **WIJA** (Warisan Jejak Keluarga) - Aplikasi Pohon Keluarga Digital dengan Aksara Lontara

---

## 📚 Daftar Isi

| File | Deskripsi |
|------|-----------|
| [01-OVERVIEW.md](./01-OVERVIEW.md) | Overview aplikasi, fitur, dan teknologi |
| [02-GETTING-STARTED.md](./02-GETTING-STARTED.md) | Panduan instalasi dan setup |
| [03-ARCHITECTURE.md](./03-ARCHITECTURE.md) | Arsitektur sistem dan database |
| [04-COMPONENTS.md](./04-COMPONENTS.md) | Dokumentasi komponen UI |
| [05-SERVICES-API.md](./05-SERVICES-API.md) | API dan services reference |
| [06-HOOKS.md](./06-HOOKS.md) | Custom React hooks |
| [07-AKSARA-LONTARA.md](./07-AKSARA-LONTARA.md) | Sistem transliterasi Lontara |
| [08-AUTHENTICATION.md](./08-AUTHENTICATION.md) | Autentikasi dan authorization |
| [09-DEPLOYMENT.md](./09-DEPLOYMENT.md) | Panduan deployment |

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local dengan konfigurasi Firebase Anda

# Run development server
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) untuk melihat aplikasi.

---

## 📖 Tech Stack

| Layer | Teknologi |
|-------|-----------|
| **Frontend** | Next.js 15, React 18, TypeScript, TailwindCSS |
| **Backend** | Firebase (Auth, Firestore, Storage) |
| **State** | Zustand, TanStack Query |
| **Visualization** | Dagre, Custom Canvas |
| **Aksara** | Noto Sans Buginese, Custom Engine |

---

## 🔗 Links

- [Blueprint Lengkap](../WIJA-BLUEPRINT-COMPLETE-v5.md)
- [Firebase Console](https://console.firebase.google.com)

---

**Version:** 5.0.0  
**Last Updated:** January 2026
