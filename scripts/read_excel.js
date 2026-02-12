const XLSX = require('xlsx');
const path = require('path');

const wb = XLSX.readFile(path.join(__dirname, '..', 'sources', 'Family Tree WIJA_190125.xlsx'));
console.log('Sheets:', wb.SheetNames);

wb.SheetNames.forEach(name => {
    const ws = wb.Sheets[name];
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    console.log('\nSheet:', name, 'Range:', ws['!ref'], 'Rows:', range.e.r + 1, 'Cols:', range.e.c + 1);

    // Print first 5 rows to see headers and sample data
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    data.slice(0, 5).forEach((row, i) => console.log('Row', i, ':', JSON.stringify(row)));
    console.log('... total', data.length, 'rows');
});
