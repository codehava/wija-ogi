#!/usr/bin/env node
/**
 * Convert "Family Tree WIJA" Excel to GEDCOM 5.5.1 format.
 *
 * Usage:
 *   node sources/xlsx-to-gedcom.mjs
 *
 * Output:
 *   sources/Family_Tree_WIJA.ged
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const INPUT = join(ROOT, 'sources', 'Family Tree WIJA_160202025_2.xlsx');
const OUTPUT = join(ROOT, 'sources', 'Family_Tree_WIJA_16022025.ged');

// ─── Read Excel ──────────────────────────────────────────────
const workbook = XLSX.readFile(INPUT);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

// ─── Parse persons ───────────────────────────────────────────
const persons = new Map(); // rowNo (string) → person data

for (const row of rows) {
    const no = String(row['No'] || '').trim();
    if (!no) continue; // skip empty rows

    const nama = String(row['Nama'] || '').trim();
    if (!nama || nama === '-') continue;

    const gender = String(row['Jenis kelamin'] || '').trim();
    const keterangan = String(row['Keterangan'] || '').trim();
    const pasangan = String(row['Pasangan'] || '').trim();
    const orangTua = String(row['Orang Tua'] || '').trim();
    const anak = String(row['Anak'] || '').trim();

    // Parse comma-separated reference numbers
    const parseRefs = (s) => {
        if (!s) return [];
        return s.split(',').map(x => x.trim()).filter(Boolean);
    };

    persons.set(no, {
        no,
        nama,
        gender: gender.toLowerCase().includes('laki') ? 'M' : 'F',
        keterangan,
        pasanganRefs: parseRefs(pasangan),
        orangTuaRefs: parseRefs(orangTua),
        anakRefs: parseRefs(anak),
    });
}

console.log(`Parsed ${persons.size} persons from Excel.`);

// ─── Build family units ──────────────────────────────────────
// A family = (husband, wife, children[])
// We derive families from the "Orang Tua" (parents) column.
// For each unique pair of parents, create one family.

const familyMap = new Map(); // "parentA-parentB" → { husb, wife, children[] }

for (const [no, person] of persons) {
    const parents = person.orangTuaRefs;
    if (parents.length === 2) {
        const key = parents.sort().join('-');
        if (!familyMap.has(key)) {
            // Determine husband/wife
            const p1 = persons.get(parents[0]);
            const p2 = persons.get(parents[1]);
            let husb = null, wife = null;
            if (p1 && p2) {
                if (p1.gender === 'M') { husb = parents[0]; wife = parents[1]; }
                else { husb = parents[1]; wife = parents[0]; }
            } else {
                husb = parents[0];
                wife = parents[1];
            }
            familyMap.set(key, { husb, wife, children: [] });
        }
        familyMap.get(key).children.push(no);
    } else if (parents.length === 1) {
        // Single parent
        const key = parents[0];
        if (!familyMap.has(key)) {
            const p = persons.get(parents[0]);
            familyMap.set(key, {
                husb: p && p.gender === 'M' ? parents[0] : null,
                wife: p && p.gender === 'F' ? parents[0] : null,
                children: []
            });
        }
        familyMap.get(key).children.push(no);
    }
}

// Also create family units from spouse references where no children exist yet
for (const [no, person] of persons) {
    for (const spouseRef of person.pasanganRefs) {
        const pair = [no, spouseRef].sort();
        const key = pair.join('-');
        if (!familyMap.has(key)) {
            const p1 = persons.get(pair[0]);
            const p2 = persons.get(pair[1]);
            let husb = null, wife = null;
            if (p1 && p1.gender === 'M') { husb = pair[0]; wife = pair[1]; }
            else { husb = pair[1]; wife = pair[0]; }
            familyMap.set(key, { husb, wife, children: [] });
        }
    }
}

console.log(`Built ${familyMap.size} family units.`);

// ─── Generate GEDCOM ─────────────────────────────────────────
const lines = [];
const ln = (text) => lines.push(text);

// Header
ln('0 HEAD');
ln('1 SOUR WIJA-Converter');
ln('2 VERS 1.0');
ln('2 NAME WIJA Excel to GEDCOM Converter');
ln('1 DEST ANY');
ln('1 DATE ' + new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase().replace(/,/g, ''));
ln('1 GEDC');
ln('2 VERS 5.5.1');
ln('2 FORM LINEAGE-LINKED');
ln('1 CHAR UTF-8');
ln('1 SUBM @SUBM1@');

ln('0 @SUBM1@ SUBM');
ln('1 NAME WIJA Family Tree Project');

// ─── Individual records ──────────────────────────────────────
// GEDCOM IDs: @I{no}@ for persons, @F{idx}@ for families
// Handle alphanumeric IDs (215a) by replacing non-alphanumeric
const gedcomId = (no) => `@I${no.replace(/[^a-zA-Z0-9]/g, '')}@`;

for (const [no, person] of persons) {
    const id = gedcomId(no);
    ln(`0 ${id} INDI`);

    // Parse name - try to find meaningful first/last split
    const nameParts = person.nama.split(/\s+/);
    const firstName = nameParts[0] || '';
    const restName = nameParts.slice(1).join(' ');

    ln(`1 NAME ${firstName} /${restName}/`);
    ln(`2 GIVN ${firstName}`);
    if (restName) ln(`2 SURN ${restName}`);

    // Gender
    ln(`1 SEX ${person.gender}`);

    // Title from Keterangan (raja titles)
    if (person.keterangan) {
        ln(`1 TITL ${person.keterangan}`);
        // Also add as a note for full context
        ln(`1 NOTE Keterangan: ${person.keterangan}`);
    }

    // Full original name as note (since Bugis names are complex)
    ln(`1 NOTE Nama lengkap: ${person.nama}`);

    // Link to families as spouse (FAMS)
    for (const [key, fam] of familyMap) {
        if (fam.husb === no || fam.wife === no) {
            ln(`1 FAMS @F${key.replace(/[^a-zA-Z0-9]/g, '')}@`);
        }
    }

    // Link to families as child (FAMC)
    for (const [key, fam] of familyMap) {
        if (fam.children.includes(no)) {
            ln(`1 FAMC @F${key.replace(/[^a-zA-Z0-9]/g, '')}@`);
        }
    }
}

// ─── Family records ──────────────────────────────────────────
for (const [key, fam] of familyMap) {
    const famId = `@F${key.replace(/[^a-zA-Z0-9]/g, '')}@`;
    ln(`0 ${famId} FAM`);
    if (fam.husb && persons.has(fam.husb)) {
        ln(`1 HUSB ${gedcomId(fam.husb)}`);
    }
    if (fam.wife && persons.has(fam.wife)) {
        ln(`1 WIFE ${gedcomId(fam.wife)}`);
    }
    for (const childNo of fam.children) {
        if (persons.has(childNo)) {
            ln(`1 CHIL ${gedcomId(childNo)}`);
        }
    }
}

// Trailer
ln('0 TRLR');

// ─── Write output ────────────────────────────────────────────
const gedcom = lines.join('\n') + '\n';
writeFileSync(OUTPUT, gedcom, 'utf-8');
console.log(`\nGEDCOM written to: ${OUTPUT}`);
console.log(`Total lines: ${lines.length}`);
console.log(`Individuals: ${persons.size}`);
console.log(`Families: ${familyMap.size}`);
