# 07 - Aksara Lontara

## 📜 Overview

**Aksara Lontara** (ᨒᨚᨈᨑ) adalah sistem penulisan tradisional suku Bugis, Makassar, dan Mandar di Sulawesi Selatan, Indonesia.

WIJA menggunakan aksara Lontara untuk menampilkan nama-nama anggota keluarga dalam dual script (Latin & Lontara) dengan auto-transliterasi.

---

## 🔤 Aksara Dasar

### Konsonan (16 Huruf Dasar)

| Latin | Lontara | Unicode | Nama |
|-------|---------|---------|------|
| ka | ᨀ | U+1A00 | KA |
| ga | ᨁ | U+1A01 | GA |
| pa | ᨄ | U+1A04 | PA |
| ba | ᨅ | U+1A05 | BA |
| ma | ᨆ | U+1A06 | MA |
| ta | ᨈ | U+1A08 | TA |
| da | ᨉ | U+1A09 | DA |
| na | ᨊ | U+1A0A | NA |
| ca | ᨌ | U+1A0C | CA |
| ja | ᨍ | U+1A0D | JA |
| ya | ᨐ | U+1A10 | YA |
| ra | ᨑ | U+1A11 | RA |
| la | ᨒ | U+1A12 | LA |
| wa | ᨓ | U+1A13 | WA |
| sa | ᨔ | U+1A14 | SA |
| ha | ᨖ | U+1A16 | HA |

### Konsonan Nasal (Cluster)

| Latin | Lontara | Nama |
|-------|---------|------|
| nga | ᨂ | NGA |
| ngka | ᨃ | NGKA |
| mpa | ᨇ | MPA |
| nra | ᨋ | NRA |
| nya | ᨎ | NYA |
| nca | ᨏ | NCA |

---

### Vokal Mandiri

| Latin | Lontara | Unicode |
|-------|---------|---------|
| a | ᨕ | U+1A15 |
| i | ᨕᨗ | - |
| u | ᨕᨘ | - |
| e | ᨕᨙ | - |
| o | ᨕᨚ | - |

---

### Tanda Vokal (Diacritics)

Tanda vokal digunakan untuk memodifikasi vokal bawaan konsonan (default: /a/).

| Vokal | Tanda | Unicode | Posisi |
|-------|-------|---------|--------|
| i | ᨗ | U+1A17 | Atas |
| u | ᨘ | U+1A18 | Bawah |
| e | ᨙ | U+1A19 | Depan |
| o | ᨚ | U+1A1A | Belakang |
| a | - | - | Inherent (default) |

### Contoh Penggunaan Diakritik

| Latin | Lontara | Keterangan |
|-------|---------|------------|
| ka | ᨀ | Konsonan + vokal /a/ |
| ki | ᨀᨗ | Konsonan + diakritik /i/ |
| ku | ᨀᨘ | Konsonan + diakritik /u/ |
| ke | ᨀᨙ | Konsonan + diakritik /e/ |
| ko | ᨀᨚ | Konsonan + diakritik /o/ |

---

## 🌐 Huruf Asing (Foreign Letters)

Aksara Lontara tidak memiliki huruf untuk beberapa bunyi asing. WIJA menggunakan **pendekatan fonologis** untuk substitusi:

| Latin | Lontara | Substitusi | Penjelasan |
|-------|---------|------------|------------|
| **F** | ᨄ (PA) | /f/ → /p/ | Labiodental → Bilabial |
| **V** | ᨅ (BA) | /v/ → /b/ | Labiodental bersuara → Bilabial |
| **Z** | ᨍ (JA) | /z/ → /j/ | Frikatif → Afrikat |
| **X** | ᨀᨔ | /ks/ | Gabungan KA + SA |
| **Q** | ᨀ (KA) | /q/ → /k/ | Uvular → Velar |
| **KH** | ᨖ (HA) | /x/ → /h/ | Velar frikatif → Glotal |
| **GH** | ᨁ (GA) | /ɣ/ → /g/ | Velar frikatif bersuara |
| **TH** | ᨈ (TA) | /θ/ → /t/ | Dental frikatif |
| **DH** | ᨉ (DA) | /ð/ → /d/ | Dental bersuara |
| **SY** | ᨔ (SA) | /ʃ/ → /s/ | Postalveolar |
| **TS** | ᨌ (CA) | /ts/ → /c/ | Afrikat |

### Diagram Substitusi

```
LABIODENTAL → BILABIAL
┌─────┐      ┌─────┐
│  F  │ ───► │  P  │  ᨄ
│  V  │ ───► │  B  │  ᨅ
└─────┘      └─────┘

ALVEOLAR → AFRIKAT
┌─────┐      ┌─────┐
│  Z  │ ───► │  J  │  ᨍ
└─────┘      └─────┘

CLUSTER → GABUNGAN
┌─────┐      ┌──────────┐
│  X  │ ───► │  K + S   │  ᨀᨔ
└─────┘      └──────────┘
```

---

## ⚙️ Transliteration Engine

### Lokasi

`src/lib/transliteration/engine.ts`

### Fungsi Utama

#### transliterateLatin

```typescript
import { transliterateLatin } from '@/lib/transliteration/engine';

const result = transliterateLatin('Budiman');

console.log(result);
// {
//   original: 'Budiman',
//   lontara: 'ᨅᨘᨉᨗᨆᨊ',
//   details: [
//     { latin: 'Bu', lontara: 'ᨅᨘ', type: 'consonant' },
//     { latin: 'di', lontara: 'ᨉᨗ', type: 'consonant' },
//     { latin: 'ma', lontara: 'ᨆ', type: 'consonant' },
//     { latin: 'n', lontara: 'ᨊ', type: 'consonant' }
//   ]
// }
```

### Algoritma Transliterasi

1. **Normalisasi** - Konversi ke lowercase, handle karakter khusus
2. **Parse Input** - Baca karakter per karakter
3. **Match Patterns** - Cari cluster, digraf, huruf asing
4. **Apply Rules** - Terapkan konsonan + tanda vokal
5. **Return Result** - Output Lontara + detail

```typescript
function transliterateLatin(text: string): TransliterationResult {
  const normalized = normalisasi(text);
  let result = '';
  let i = 0;
  
  while (i < normalized.length) {
    // 1. Check for foreign letter substitution
    if (isForeignLetter(normalized[i])) {
      result += substituteforeign(normalized[i]);
      i++;
      continue;
    }
    
    // 2. Check for nasal clusters (ng, ny, etc)
    if (isNasalCluster(normalized.substring(i, i+2))) {
      result += processNasal(normalized.substring(i, i+2));
      i += 2;
      continue;
    }
    
    // 3. Process consonant + vowel
    if (isConsonant(normalized[i])) {
      const consonant = KONSONAN[normalized[i]];
      const nextChar = normalized[i+1];
      
      if (isVowel(nextChar) && nextChar !== 'a') {
        result += consonant + DIAKRITIK[nextChar];
        i += 2;
      } else {
        result += consonant;
        i++;
      }
      continue;
    }
    
    // 4. Process standalone vowel
    if (isVowel(normalized[i])) {
      result += processVowel(normalized[i]);
      i++;
      continue;
    }
    
    i++;
  }
  
  return { original: text, lontara: result, details: [...] };
}
```

---

## 📝 Contoh Transliterasi

| Latin | Lontara | Keterangan |
|-------|---------|------------|
| Budiman | ᨅᨘᨉᨗᨆᨊ | Nama biasa |
| Sulawesi | ᨔᨘᨒᨓᨙᨔᨗ | Nama tempat |
| Ahmad | ᨕᨖᨆᨉ | Dimulai vokal + HA |
| Festival | ᨄᨙᨔᨈᨗᨅᨒ | F → P |
| Vaksin | ᨅᨀᨔᨗᨊ | V → B |
| Zaman | ᨍᨆᨊ | Z → J |
| Makassar | ᨆᨀᨔᨑ | Double S |
| Ngala | ᨂᨒ | Cluster NG |

---

## 🎨 Font Configuration

### Google Fonts

```css
/* Import from Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Buginese&display=swap');

.font-lontara {
  font-family: 'Noto Sans Buginese', serif;
}
```

### TailwindCSS Config

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        lontara: ['Noto Sans Buginese', 'serif'],
      },
    },
  },
}
```

### CSS Variables

```css
/* globals.css */
:root {
  --lontara-text: #92400E;      /* Amber-800 */
  --lontara-bg: #FEF3C7;        /* Amber-100 */
}

.lontara-display {
  font-family: 'Noto Sans Buginese', serif;
  color: var(--lontara-text);
  background-color: var(--lontara-bg);
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}
```

---

## 📚 Unicode Reference

### Buginese Block (U+1A00 - U+1A1F)

| Unicode | Char | Name |
|---------|------|------|
| U+1A00 | ᨀ | KA |
| U+1A01 | ᨁ | GA |
| U+1A02 | ᨂ | NGA |
| U+1A03 | ᨃ | NGKA |
| U+1A04 | ᨄ | PA |
| U+1A05 | ᨅ | BA |
| U+1A06 | ᨆ | MA |
| U+1A07 | ᨇ | MPA |
| U+1A08 | ᨈ | TA |
| U+1A09 | ᨉ | DA |
| U+1A0A | ᨊ | NA |
| U+1A0B | ᨋ | NRA |
| U+1A0C | ᨌ | CA |
| U+1A0D | ᨍ | JA |
| U+1A0E | ᨎ | NYA |
| U+1A0F | ᨏ | NCA |
| U+1A10 | ᨐ | YA |
| U+1A11 | ᨑ | RA |
| U+1A12 | ᨒ | LA |
| U+1A13 | ᨓ | WA |
| U+1A14 | ᨔ | SA |
| U+1A15 | ᨕ | A |
| U+1A16 | ᨖ | HA |
| U+1A17 | ᨗ | VOWEL I |
| U+1A18 | ᨘ | VOWEL U |
| U+1A19 | ᨙ | VOWEL E |
| U+1A1A | ᨚ | VOWEL O |
| U+1A1E | ᨞ | PALLAWA (period) |
| U+1A1F | ᨟ | END OF SECTION |

---

## 🧩 Component Usage

### DualScriptDisplay

```tsx
import { DualScriptDisplay } from '@/components/aksara';

// Mode: both (default)
<DualScriptDisplay latinText="Budiman" mode="both" />
// Output:
// Budiman
// ᨅᨘᨉᨗᨆᨊ

// Mode: latin only
<DualScriptDisplay latinText="Budiman" mode="latin" />
// Output:
// Budiman

// Mode: lontara only
<DualScriptDisplay latinText="Budiman" mode="lontara" />
// Output:
// ᨅᨘᨉᨗᨆᨊ
```

### LontaraInput

```tsx
import { LontaraInput } from '@/components/aksara';

<LontaraInput
  value={name}
  onChange={(latin, lontara) => {
    console.log('Latin:', latin);     // "Ahmad"
    console.log('Lontara:', lontara); // "ᨕᨖᨆᨉ"
  }}
  showPreview={true}
/>
```

---

**Selanjutnya:** [08-AUTHENTICATION.md](./08-AUTHENTICATION.md)
