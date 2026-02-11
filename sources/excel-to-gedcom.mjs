#!/usr/bin/env node
/**
 * Excel → GEDCOM 5.5.1 converter for WIJA family tree data
 * 
 * Excel columns: No, Nama, Jenis kelamin, Keterangan, Pasangan, Orang Tua, Saudara, Anak
 * - "Pasangan" = spouse number
 * - "Orang Tua" = parent numbers (e.g. "3, 4")
 * - "Anak" = child numbers (e.g. "20, 21, 23")
 */

import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Use npx-installed xlsx
let XLSX;
try {
    XLSX = require('xlsx');
} catch {
    console.error('Installing xlsx...');
    const { execSync } = await import('child_process');
    execSync('npm install --no-save xlsx', { stdio: 'inherit' });
    XLSX = require('xlsx');
}

// ── Read Excel ──
const inputFile = process.argv[2] || 'sources/Family Tree WIJA_190125.xlsx';
const outputFile = process.argv[3] || 'sources/Family Tree WIJA.ged';

const wb = XLSX.readFile(inputFile);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws);

console.log(`📋 Read ${rows.length} rows from "${inputFile}"`);

// ── Parse persons ──
const persons = new Map();  // No → person data

for (const row of rows) {
    const no = parseInt(row['No'] || row['﻿No']);
    if (!no || isNaN(no)) continue;

    const nama = (row['Nama'] || '').trim();
    if (!nama) continue;

    const gender = (row['Jenis kelamin'] || '').trim();
    const keterangan = (row['Keterangan'] || '').trim();
    const spouseStr = String(row['Pasangan'] || '').trim();
    const parentStr = String(row['Orang Tua'] || '').trim();
    const childStr = String(row['Anak'] || '').trim();

    // Parse number references
    const parseNums = (s) => {
        if (!s) return [];
        return s.split(',')
            .map(n => parseInt(n.trim()))
            .filter(n => !isNaN(n) && n > 0);
    };

    persons.set(no, {
        no,
        nama,
        gender: gender.toLowerCase().includes('laki') ? 'M' : 'F',
        keterangan,
        spouseNos: parseNums(spouseStr),
        parentNos: parseNums(parentStr),
        childNos: parseNums(childStr),
    });
}

console.log(`👤 Parsed ${persons.size} persons`);

// ── Build family groups (FAM records) ──
// A family = a couple (husband + wife) with their children
const families = new Map();  // "husbNo-wifeNo" → { husb, wife, children[] }
const familyIdMap = new Map();  // key → FAM id
let famCounter = 1;

for (const [no, person] of persons) {
    if (person.spouseNos.length > 0) {
        for (const spouseNo of person.spouseNos) {
            const spouse = persons.get(spouseNo);
            if (!spouse) continue;

            // Determine husband/wife
            let husbNo, wifeNo;
            if (person.gender === 'M') {
                husbNo = no;
                wifeNo = spouseNo;
            } else {
                husbNo = spouseNo;
                wifeNo = no;
            }

            const key = `${Math.min(husbNo, wifeNo)}-${Math.max(husbNo, wifeNo)}`;
            if (!families.has(key)) {
                const famId = `F${famCounter++}`;
                families.set(key, {
                    id: famId,
                    husbNo,
                    wifeNo,
                    childNos: new Set(),
                });
                familyIdMap.set(key, famId);
            }

            // Add children from both spouses
            const fam = families.get(key);
            for (const childNo of person.childNos) {
                fam.childNos.add(childNo);
            }
        }
    }
}

// Also check children's parent references to fill in any missing families  
for (const [no, person] of persons) {
    if (person.parentNos.length === 2) {
        const p1 = person.parentNos[0];
        const p2 = person.parentNos[1];
        const key = `${Math.min(p1, p2)}-${Math.max(p1, p2)}`;

        if (!families.has(key)) {
            const parent1 = persons.get(p1);
            const parent2 = persons.get(p2);
            if (parent1 && parent2) {
                const husbNo = parent1.gender === 'M' ? p1 : p2;
                const wifeNo = parent1.gender === 'M' ? p2 : p1;
                const famId = `F${famCounter++}`;
                families.set(key, {
                    id: famId,
                    husbNo,
                    wifeNo,
                    childNos: new Set([no]),
                });
            }
        } else {
            families.get(key).childNos.add(no);
        }
    }
}

console.log(`👪 Created ${families.size} family groups`);

// ── Generate GEDCOM ──
const lines = [];

// Header
lines.push('0 HEAD');
lines.push('1 SOUR WIJA-Ogi');
lines.push('2 NAME WIJA-Ogi Excel Converter');
lines.push('2 VERS 1.0');
lines.push('1 DEST WIJA-Ogi');
lines.push('1 DATE ' + new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase().replace(',', ''));
lines.push('1 GEDC');
lines.push('2 VERS 5.5.1');
lines.push('2 FORM LINEAGE-LINKED');
lines.push('1 CHAR UTF-8');
lines.push('1 LANG Indonesian');

// Person (INDI) records
for (const [no, person] of persons) {
    lines.push(`0 @I${no}@ INDI`);

    // Parse name - try to split into given name / surname
    const namaParts = person.nama.split(' ');
    const givenName = namaParts[0] || person.nama;
    const surname = namaParts.length > 1 ? namaParts.slice(1).join(' ') : '';

    lines.push(`1 NAME ${givenName} /${surname}/`);
    if (givenName) lines.push(`2 GIVN ${givenName}`);
    if (surname) lines.push(`2 SURN ${surname}`);

    lines.push(`1 SEX ${person.gender}`);

    // Add note with keterangan if available
    if (person.keterangan) {
        lines.push(`1 NOTE ${person.keterangan}`);
    }

    // Link to families as spouse (FAMS)
    for (const [key, fam] of families) {
        if (fam.husbNo === no || fam.wifeNo === no) {
            lines.push(`1 FAMS @${fam.id}@`);
        }
    }

    // Link to families as child (FAMC)
    for (const [key, fam] of families) {
        if (fam.childNos.has(no)) {
            lines.push(`1 FAMC @${fam.id}@`);
        }
    }
}

// Family (FAM) records
for (const [key, fam] of families) {
    lines.push(`0 @${fam.id}@ FAM`);

    if (fam.husbNo && persons.has(fam.husbNo)) {
        lines.push(`1 HUSB @I${fam.husbNo}@`);
    }
    if (fam.wifeNo && persons.has(fam.wifeNo)) {
        lines.push(`1 WIFE @I${fam.wifeNo}@`);
    }

    // Sort children by number for consistent ordering
    const sortedChildren = [...fam.childNos].sort((a, b) => a - b);
    for (const childNo of sortedChildren) {
        if (persons.has(childNo)) {
            lines.push(`1 CHIL @I${childNo}@`);
        }
    }
}

// Trailer
lines.push('0 TRLR');

// Write GEDCOM file
const gedcomContent = lines.join('\n') + '\n';
writeFileSync(outputFile, gedcomContent, 'utf-8');

console.log(`\n✅ GEDCOM file created: ${outputFile}`);
console.log(`   📊 ${persons.size} individuals, ${families.size} families`);
console.log(`   📄 ${lines.length} lines`);
