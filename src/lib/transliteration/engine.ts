// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Lontara Transliteration Engine
// Based on: kaidah-transliterasi-lontara-bugis-3.md (Tervalidasi v3)
// Prinsip: Berbasis PELAFALAN (Fonetis), bukan ejaan Latin
// ═══════════════════════════════════════════════════════════════════════════════

import { TransliterationResult, TransliterationDetail } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────────
// KONFIGURASI LONTARA (Sesuai Kaidah Pedoman Praktis Tervalidasi v3)
// ─────────────────────────────────────────────────────────────────────────────────

// Konsonan Dasar (16 huruf)
const KONSONAN: Record<string, string> = {
    'k': 'ᨀ', 'g': 'ᨁ', 'p': 'ᨄ', 'b': 'ᨅ',
    'm': 'ᨆ', 't': 'ᨈ', 'd': 'ᨉ', 'n': 'ᨊ',
    'c': 'ᨌ', 'j': 'ᨍ', 'y': 'ᨐ', 'r': 'ᨑ',
    'l': 'ᨒ', 'w': 'ᨓ', 's': 'ᨔ', 'h': 'ᨖ',
};

// Aksara Nasal
const NASAL: Record<string, string> = {
    'ng': 'ᨂ',  // U+1A02 - nga
    'ny': 'ᨎ',  // U+1A0E - nya
};

// Aksara Pranasal (hanya untuk kluster + vokal)
const PRANASAL: Record<string, string> = {
    'ngk': 'ᨃ', // U+1A03 - ngka
    'nk': 'ᨃ',  // nk juga → ngka
    'nc': 'ᨏ',  // U+1A0F - nca
    'nj': 'ᨏ',  // nj juga → nca
};

// Diakritik vokal
const DIAKRITIK: Record<string, string> = {
    'a': '',    // Vokal inheren
    'i': 'ᨗ',   // U+1A17
    'u': 'ᨘ',   // U+1A18
    'e': 'ᨙ',   // U+1A19 - e taling
    'é': 'ᨙ',   // U+1A19 - e taling eksplisit (user input)
    'o': 'ᨚ',   // U+1A1A
    'ə': 'ᨛ',   // U+1A1B - pepet
};

// Substitusi huruf asing (v3: Z → S, bukan J)
const SUBSTITUSI: Record<string, string> = {
    'f': 'p', 'v': 'b', 'z': 's', 'q': 'k',
};

// Aksara vokal mandiri
const AKSARA_A = 'ᨕ'; // U+1A15

// Tanda baca
const PUNCTUATION: Record<string, string> = {
    '.': '᨞', ',': '᨟', ' ': ' ',
    "'": 'ᨕ',  // Glottal stop (hamzah) → aksara A (sebagai pemisah)
};

// Set untuk pengecekan
const VOKAL_SET = new Set(['a', 'i', 'u', 'e', 'é', 'o', 'ə']);
const KONSONAN_SET = new Set(Object.keys(KONSONAN));

// Kluster yang konsonan pertama DIABAIKAN (v3)
const SKIP_CLUSTER = new Set(['mb', 'mp', 'nt', 'nd', 'nr', 'rm', 'bt']);

// Kluster yang konsonan pertama dapat vokal /a/ (v3)
const VOKAL_A_CLUSTER = new Set(['lt', 'bd']);

// Kluster yang konsonan pertama dapat vokal pepet /ə/ (v3.1)
// Untuk nama-nama Indonesia/Arab yang umum mengandung kluster konsonan
const PEPET_CLUSTER = new Set([
    'hm', 'mr',           // Ahmad, Umran
    'sm', 'sr',           // Ismail, Isra
    'br', 'bl',           // Ibrahim, Subli
    'dr', 'dl',           // Badri, -
    'kr', 'kl',           // Sukri, -
    'tr', 'tl',           // Putra, -
    'gr', 'gl',           // Agri, -
    'pr', 'pl',           // Apri, -
    'fr', 'fl',           // Afri (→ Apri), -
    'hr',                 // Bahri
    'wr',                 // -
    'nr', 'nl',           // Anri, -
]);

// Prefiks nama yang 'e'-nya adalah pepet (ə) jika diikuti konsonan
// HANYA berlaku di AWAL KATA untuk menghindari over-detection
// Contoh: Sekanyili, Belajar, Temanggung, Keluarga, Pemalang, Mesin, Dewa
// NOTE: Untuk memaksa e-taling, gunakan 'é' (misal: Déwa)
const PEPET_PREFIX = new Set(['se', 'be', 'de', 'ke', 'te', 'pe', 'me', 're', 'le', 'ne', 'we', 'ge']);

// Konsonan akhir yang diabaikan (sesuai standar Lontara Bugis)
// Hanya konsonan yang TIDAK dilafalkan di akhir kata dalam bahasa Bugis
const SKIP_AKHIR = new Set(['n', 'm', 'k', 't', 'p', 'h', 'l', 'd', 'b', 'g']);

// Konsonan akhir yang dapat vokal /a/ (standar)
const VOKAL_AKHIR = new Set(['r', 's']);

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

function normalisasi(text: string): string {
    let result = text.toLowerCase();

    // Pertahankan é (e-taling eksplisit) - konversi ke marker sementara
    result = result.replace(/é/g, 'E_TALING');

    // Pertahankan glottal stop/hamzah
    // ' di tengah kata tetap dipertahankan untuk diproses

    // Substitusi huruf asing
    for (const [asing, pengganti] of Object.entries(SUBSTITUSI)) {
        result = result.replace(new RegExp(asing, 'g'), pengganti);
    }

    // Kluster Arab: sy → s, kh → k (simplifikasi standar)
    result = result.replace(/sy/g, 's');
    result = result.replace(/kh/g, 'k');

    // X → KS
    result = result.replace(/x/g, 'ks');

    // Konsonan ganda → tunggal (mm→m, ss→s, ll→l, dll)
    result = result.replace(/(.)\1+/g, '$1');

    // Kembalikan marker e-taling
    result = result.replace(/E_TALING/g, 'é');

    return result;
}

function isVokal(char: string): boolean {
    return VOKAL_SET.has(char);
}

function isKonsonan(char: string): boolean {
    return KONSONAN_SET.has(char);
}

function getVokalDiakritik(vokal: string): string {
    return DIAKRITIK[vokal] || '';
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN TRANSLITERATION ENGINE (v3)
// ─────────────────────────────────────────────────────────────────────────────────

export function transliterateLatin(text: string): TransliterationResult {
    if (!text) return { lontara: '', details: [] };

    const input = normalisasi(text);
    const details: TransliterationDetail[] = [];
    let result = '';
    let i = 0;
    let lastVowel = 'a';  // Track last vowel for harmony (default 'a')

    while (i < input.length) {
        const remaining = input.slice(i);
        const isAtEnd = (offset: number) => (i + offset) >= input.length;
        const charAfter = (offset: number) => input[i + offset] || '';

        // Helper: cek apakah karakter di posisi offset adalah akhir kata
        const isWordEnd = (offset: number) => isAtEnd(offset) || charAfter(offset) === ' ';

        // 1. Punctuation dan spasi
        if (PUNCTUATION[remaining[0]] !== undefined) {
            result += PUNCTUATION[remaining[0]];
            details.push({ latin: remaining[0], lontara: PUNCTUATION[remaining[0]], type: 'punctuation' });
            i++;
            continue;
        }

        // 2. Angka
        if (/[0-9]/.test(remaining[0])) {
            result += remaining[0];
            details.push({ latin: remaining[0], lontara: remaining[0], type: 'number' });
            i++;
            continue;
        }

        // 3. Kluster 3 huruf: ngk, ngg
        if (remaining.startsWith('ngk')) {
            const aksara = PRANASAL['ngk'];
            let latinPart = 'ngk';
            let consumed = 3;
            let lontara = aksara;

            if (isVokal(charAfter(3))) {
                const v = charAfter(3);
                lontara += getVokalDiakritik(v);
                latinPart += v;
                consumed++;
            }

            result += lontara;
            details.push({ latin: latinPart, lontara, type: 'cluster' });
            i += consumed;
            continue;
        }

        if (remaining.startsWith('ngg')) {
            // ngg → g (ng diabaikan)
            details.push({ latin: 'ng', lontara: '', type: 'cluster', note: 'ng sebelum g diabaikan' });
            i += 2;
            continue;
        }

        // 4. Nasal 2 huruf: ng, ny
        if (remaining.startsWith('ng')) {
            // Cek apakah ng di akhir kata
            if (isWordEnd(2)) {
                details.push({ latin: 'ng', lontara: '', type: 'consonant', note: 'ng akhir diabaikan' });
                i += 2;
                continue;
            }

            const aksara = NASAL['ng'];
            let latinPart = 'ng';
            let consumed = 2;
            let lontara = aksara;

            if (isVokal(charAfter(2))) {
                const v = charAfter(2);
                lontara += getVokalDiakritik(v);
                latinPart += v;
                consumed++;
            }

            result += lontara;
            details.push({ latin: latinPart, lontara, type: 'cluster' });
            i += consumed;
            continue;
        }

        if (remaining.startsWith('ny')) {
            const aksara = NASAL['ny'];
            let latinPart = 'ny';
            let consumed = 2;
            let lontara = aksara;

            if (isVokal(charAfter(2))) {
                const v = charAfter(2);
                lontara += getVokalDiakritik(v);
                latinPart += v;
                consumed++;
            }

            result += lontara;
            details.push({ latin: latinPart, lontara, type: 'cluster' });
            i += consumed;
            continue;
        }

        // 5. Pranasal 2 huruf: nk, nc, nj
        for (const [pattern, aksara] of Object.entries(PRANASAL)) {
            if (pattern.length === 2 && remaining.startsWith(pattern)) {
                let latinPart = pattern;
                let consumed = 2;
                let lontara = aksara;

                if (isVokal(charAfter(2))) {
                    const v = charAfter(2);
                    lontara += getVokalDiakritik(v);
                    latinPart += v;
                    consumed++;
                }

                result += lontara;
                details.push({ latin: latinPart, lontara, type: 'cluster' });
                i += consumed;
                break;
            }
        }
        if (i > 0 && remaining !== input.slice(i)) continue;

        // 6. Kluster dengan konsonan pertama DIABAIKAN: mb, mp, nt, nd, nr, rm, bt
        const twoChars = remaining.slice(0, 2);
        if (SKIP_CLUSTER.has(twoChars) && remaining.length >= 2) {
            // Skip konsonan pertama, proses konsonan kedua
            const first = twoChars[0];
            const second = twoChars[1];
            details.push({ latin: first, lontara: '', type: 'consonant', note: `${first} sebelum ${second} diabaikan` });
            i++;
            continue;
        }

        // 7. Kluster dengan konsonan pertama dapat /a/: lt, bd
        if (VOKAL_A_CLUSTER.has(twoChars) && remaining.length >= 2) {
            const first = twoChars[0];
            const aksara = KONSONAN[first];
            result += aksara; // dengan vokal inheren /a/
            details.push({ latin: first + 'a', lontara: aksara, type: 'consonant', note: `${first} sebelum ${twoChars[1]} dapat /a/` });
            i++;
            continue;
        }

        // 8. Kluster dengan konsonan pertama dapat vokal pepet /ə/
        if (PEPET_CLUSTER.has(twoChars) && remaining.length >= 2) {
            const first = twoChars[0];
            const aksara = KONSONAN[first] + getVokalDiakritik('ə');
            result += aksara;
            details.push({ latin: first + 'ə', lontara: aksara, type: 'consonant', note: `${first} sebelum ${twoChars[1]} dapat /ə/` });
            i++;
            continue;
        }

        // 9. Konsonan tunggal
        if (isKonsonan(remaining[0])) {
            const konsonan = remaining[0];
            const nextChar = charAfter(1);

            // 9a. Diikuti vokal → konsonan + diakritik
            if (isVokal(nextChar)) {
                // Special case: Auto-detect pepet for prefixes like Se-, Be-, De-, etc.
                // ONLY at word start (i==0 or after space) to avoid over-detection
                const twoCharPrefix = konsonan + nextChar;
                const afterVowel = charAfter(2);
                const isAtWordStart = i === 0 || input[i - 1] === ' ';

                if (nextChar === 'e' && isAtWordStart && PEPET_PREFIX.has(twoCharPrefix) && isKonsonan(afterVowel)) {
                    // Use pepet for this 'e' since it's at word start + followed by consonant
                    const aksara = KONSONAN[konsonan];
                    const lontara = aksara + getVokalDiakritik('ə');
                    result += lontara;
                    details.push({ latin: konsonan + 'ə', lontara, type: 'consonant', note: `'e' dalam ${twoCharPrefix}+konsonan → pepet` });
                    i += 2;
                    continue;
                }

                const aksara = KONSONAN[konsonan];
                const lontara = aksara + getVokalDiakritik(nextChar);
                result += lontara;
                // Track last vowel for harmony
                if (['a', 'i', 'u', 'e', 'o'].includes(nextChar)) {
                    lastVowel = nextChar;
                } else if (nextChar === 'é') {
                    lastVowel = 'e';  // é counts as 'e'
                }
                details.push({ latin: konsonan + nextChar, lontara, type: 'consonant' });
                i += 2;
                continue;
            }

            // 9b. Di akhir kata
            if (isWordEnd(1)) {
                // Konsonan yang diabaikan di akhir kata
                if (SKIP_AKHIR.has(konsonan)) {
                    details.push({ latin: konsonan, lontara: '', type: 'consonant', note: `${konsonan} akhir diabaikan` });
                    i++;
                    continue;
                }

                // Konsonan yang dapat vokal harmoni di akhir kata (r, s)
                // Mengikuti vokal suku kata sebelumnya: Yunus → Yunusu, Aris → Arisi
                if (VOKAL_AKHIR.has(konsonan)) {
                    const aksara = KONSONAN[konsonan];
                    const harmonicVowel = lastVowel;  // Use last vowel for harmony
                    const lontara = aksara + getVokalDiakritik(harmonicVowel);
                    result += lontara;
                    details.push({ latin: konsonan + harmonicVowel, lontara: lontara, type: 'consonant', note: `${konsonan} akhir harmoni vokal /${harmonicVowel}/` });
                    i++;
                    continue;
                }
            }

            // 9c. Default: konsonan dengan vokal inheren /a/
            const aksara = KONSONAN[konsonan];
            result += aksara;
            details.push({ latin: konsonan, lontara: aksara, type: 'consonant' });
            i++;
            continue;
        }

        // 10. Vokal mandiri (di awal kata/suku kata)
        if (isVokal(remaining[0])) {
            const vokal = remaining[0];
            const lontara = AKSARA_A + getVokalDiakritik(vokal);
            result += lontara;
            details.push({ latin: vokal, lontara, type: 'vowel' });
            i++;
            continue;
        }

        // 11. Karakter tidak dikenal → skip
        i++;
    }

    return { lontara: result, details };
}

// ─────────────────────────────────────────────────────────────────────────────────
// REFERENCE & UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export function getLontaraReference() {
    return {
        consonants: Object.entries(KONSONAN).map(([latin, lontara]) => ({
            latin: latin.toUpperCase(), lontara, type: 'consonant' as const
        })),
        vowels: [
            { latin: 'A', lontara: AKSARA_A, type: 'vowel' as const },
            { latin: 'I', lontara: AKSARA_A + 'ᨗ', type: 'vowel' as const },
            { latin: 'U', lontara: AKSARA_A + 'ᨘ', type: 'vowel' as const },
            { latin: 'E', lontara: AKSARA_A + 'ᨙ', type: 'vowel' as const },
            { latin: 'O', lontara: AKSARA_A + 'ᨚ', type: 'vowel' as const },
        ],
        vowelMarkers: Object.entries(DIAKRITIK)
            .filter(([, v]) => v !== '')
            .map(([latin, lontara]) => ({ latin: latin.toUpperCase(), lontara, type: 'marker' as const })),
        clusters: [
            ...Object.entries(NASAL),
            ...Object.entries(PRANASAL)
        ].map(([latin, lontara]) => ({ latin: latin.toUpperCase(), lontara, type: 'cluster' as const })),
        foreignLetters: Object.entries(SUBSTITUSI).map(([latin, base]) => ({
            latin: latin.toUpperCase(),
            lontara: KONSONAN[base] || '',
            description: `${latin.toUpperCase()} → ${base.toUpperCase()}`,
            type: 'foreign' as const
        }))
    };
}

export function transliterateName(latinName: { first: string; middle?: string; last: string }) {
    return {
        first: transliterateLatin(latinName.first).lontara,
        middle: latinName.middle ? transliterateLatin(latinName.middle).lontara : '',
        last: transliterateLatin(latinName.last).lontara || ''
    };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORT CONFIG FOR REFERENCE
// ─────────────────────────────────────────────────────────────────────────────────

export const LONTARA_CONFIG = {
    consonantBase: KONSONAN,
    vowels: { 'a': AKSARA_A, 'i': AKSARA_A + 'ᨗ', 'u': AKSARA_A + 'ᨘ', 'e': AKSARA_A + 'ᨙ', 'o': AKSARA_A + 'ᨚ' },
    vowelMarkers: DIAKRITIK,
    clusters: { ...NASAL, ...PRANASAL },
    foreignLetters: SUBSTITUSI,
    punctuation: PUNCTUATION
};
