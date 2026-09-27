const scheduler = require('./common/scheduler');
const { getSemesterNumbers } = require('./common/utils');

const sampleRows = [
  { semestr: '5', tryb: 'STAC', specjalnosc: 'PBDiOU' },
  { semestr: '5', tryb: 'STAC', specjalnosc: 'ASiSK+PBDiOU+M3D' },
  { semestr: '5', tryb: 'STAC', specjalnosc: '' },
  { semestr: '3', tryb: 'NST', specjalnosc: null },
  { semestr: '3', tryb: 'STAC', specjalnosc: null },
];

const filters = [
  ['5|STAC|'],
  ['5|STAC|PBDiOU'],
  ['5|STAC|ASiSK+PBDiOU+M3D'],
  ['3|NST|'],
  ['3|STAC|'],
  ['5|STAC|ASiSK'],
];

for (const filter of filters) {
  console.log('filter', filter[0]);
  for (const row of sampleRows) {
    console.log(' ', row.semestr, row.tryb, row.specjalnosc, '=>', scheduler.matchesCourseFilter(row, filter.map((value) => {
      const [semestr, tryb, specjalnosc] = value.split('|');
      const normalizedSemestr = String(semestr || '').trim();
      const semestrs = normalizedSemestr ? getSemesterNumbers(normalizedSemestr) : [];
      return { semestrs, tryb: String(tryb || '').trim() || null, specjalnosc: String(specjalnosc || '').trim() || null };
    })));
  }
}
