const XLSX = require('xlsx');
const path = require('path');

const wb = XLSX.readFile(path.join(__dirname, '..', 'sources', 'Family Tree WIJA_190125.xlsx'));
const ws = wb.Sheets['Sheet1'];
const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

// Skip header row
const header = rawData[0];
const rows = rawData.slice(1).filter(r => r[0] !== '');

console.log('Headers:', header);
console.log('Total persons:', rows.length);

// Build person lookup map
const persons = new Map();
rows.forEach(row => {
    const id = String(row[0]).trim();
    persons.set(id, {
        no: id,
        nama: String(row[1] || '').trim(),
        gender: String(row[2] || '').trim(),
        keterangan: String(row[3] || '').trim(),
        rawPasangan: String(row[4] || '').trim(),
        rawOrangTua: String(row[5] || '').trim(),
        rawSaudara: String(row[6] || '').trim(),
        rawAnak: String(row[7] || '').trim(),
    });
});

// Parse relationship IDs (handles comma-separated, ranges, etc.)
function parseIds(raw) {
    if (!raw || raw === '') return [];
    return raw.split(/[,;\s]+/)
        .map(s => s.trim())
        .filter(s => s !== '' && !isNaN(Number(s)));
}

// Build comprehensive relationship table
const outputRows = [];
outputRows.push([
    'No', 'Nama', 'Gender', 'Keterangan',
    'Pasangan_IDs', 'Pasangan_Names',
    'OrangTua_IDs', 'OrangTua_Names',
    'Ayah_ID', 'Ayah_Name',
    'Ibu_ID', 'Ibu_Name',
    'Saudara_IDs', 'Saudara_Names',
    'Anak_IDs', 'Anak_Names',
    'Issues/Warnings'
]);

let warningCount = 0;

persons.forEach((p, id) => {
    const warnings = [];

    // Parse all relationship IDs
    const pasanganIds = parseIds(p.rawPasangan);
    const orangTuaIds = parseIds(p.rawOrangTua);
    const saudaraIds = parseIds(p.rawSaudara);
    const anakIds = parseIds(p.rawAnak);

    // Resolve names
    const resolveName = (rid) => {
        const person = persons.get(rid);
        return person ? person.nama : `[UNKNOWN ID: ${rid}]`;
    };

    const resolveNames = (ids) => ids.map(resolveName);

    // Identify father and mother from parents
    let ayahId = '', ayahName = '', ibuId = '', ibuName = '';
    orangTuaIds.forEach(pid => {
        const parent = persons.get(pid);
        if (!parent) {
            warnings.push(`Parent ID ${pid} not found`);
            return;
        }
        if (parent.gender === 'Laki-Laki') {
            ayahId = pid;
            ayahName = parent.nama;
        } else if (parent.gender === 'Perempuan') {
            ibuId = pid;
            ibuName = parent.nama;
        }
    });

    // Cross-check: if person has a spouse, does the spouse list this person back?
    pasanganIds.forEach(sid => {
        const spouse = persons.get(sid);
        if (!spouse) {
            warnings.push(`Spouse ID ${sid} not found`);
            return;
        }
        const spousePartners = parseIds(spouse.rawPasangan);
        if (!spousePartners.includes(id)) {
            warnings.push(`Spouse ${sid} (${spouse.nama}) doesn't list ${id} back as spouse`);
        }
    });

    // Cross-check: if person has children, do the children list this person as parent?
    anakIds.forEach(cid => {
        const child = persons.get(cid);
        if (!child) {
            warnings.push(`Child ID ${cid} not found`);
            return;
        }
        const childParents = parseIds(child.rawOrangTua);
        if (!childParents.includes(id)) {
            warnings.push(`Child ${cid} (${child.nama}) doesn't list ${id} as parent`);
        }
    });

    // Cross-check: if person has parents, do the parents list this person as child?
    orangTuaIds.forEach(pid => {
        const parent = persons.get(pid);
        if (!parent) return;
        const parentChildren = parseIds(parent.rawAnak);
        if (!parentChildren.includes(id)) {
            warnings.push(`Parent ${pid} (${parent.nama}) doesn't list ${id} as child`);
        }
    });

    if (warnings.length > 0) warningCount++;

    outputRows.push([
        id,
        p.nama,
        p.gender === 'Laki-Laki' ? 'M' : 'F',
        p.keterangan,
        pasanganIds.join(', '),
        resolveNames(pasanganIds).join('; '),
        orangTuaIds.join(', '),
        resolveNames(orangTuaIds).join('; '),
        ayahId,
        ayahName,
        ibuId,
        ibuName,
        saudaraIds.join(', '),
        resolveNames(saudaraIds).join('; '),
        anakIds.join(', '),
        resolveNames(anakIds).join('; '),
        warnings.join(' | ')
    ]);
});

console.log('\nWarning count:', warningCount, 'persons have issues');

// Write output Excel
const newWb = XLSX.utils.book_new();
const newWs = XLSX.utils.aoa_to_sheet(outputRows);

// Set column widths
newWs['!cols'] = [
    { wch: 5 },   // No
    { wch: 50 },  // Nama
    { wch: 5 },   // Gender
    { wch: 20 },  // Keterangan
    { wch: 12 },  // Pasangan IDs
    { wch: 50 },  // Pasangan Names
    { wch: 12 },  // OrangTua IDs
    { wch: 50 },  // OrangTua Names
    { wch: 8 },   // Ayah ID
    { wch: 50 },  // Ayah Name
    { wch: 8 },   // Ibu ID
    { wch: 50 },  // Ibu Name
    { wch: 15 },  // Saudara IDs
    { wch: 60 },  // Saudara Names
    { wch: 15 },  // Anak IDs
    { wch: 60 },  // Anak Names
    { wch: 60 },  // Warnings
];

XLSX.utils.book_append_sheet(newWb, newWs, 'Relationships');

const outputPath = path.join(__dirname, '..', 'sources', 'Family_Tree_Relationships.xlsx');
XLSX.writeFile(newWb, outputPath);
console.log('\nOutput written to:', outputPath);

// Print some sample rows
console.log('\n--- Sample rows ---');
outputRows.slice(1, 6).forEach(row => {
    console.log(`\nNo ${row[0]}: ${row[1]} (${row[2]})`);
    if (row[4]) console.log(`  Pasangan: ${row[5]}`);
    if (row[6]) console.log(`  Orang Tua: ${row[7]}`);
    if (row[8]) console.log(`  Ayah: ${row[9]}`);
    if (row[10]) console.log(`  Ibu: ${row[11]}`);
    if (row[12]) console.log(`  Saudara: ${row[13]}`);
    if (row[14]) console.log(`  Anak: ${row[15]}`);
    if (row[16]) console.log(`  ⚠ Warnings: ${row[16]}`);
});
