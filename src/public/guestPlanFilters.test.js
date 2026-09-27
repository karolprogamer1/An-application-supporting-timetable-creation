import test from 'node:test';
import assert from 'node:assert/strict';
import { collectGuestPlanFilters, filterGuestPlanData } from './guestPlanFilters.js';

test('collectGuestPlanFilters gathers unique lecturers and rooms', () => {
  const plansData = {
    results: {
      '5|ASiSK|STAC': {
        plan: [
          { lecturer: 'Adam Kielak', room: 'Sala A' },
          { lecturer: 'Adam Kielak', room: 'Sala B' },
          { lecturer: 'Norbert Sacha', room: 'Sala A' },
        ],
      },
      '6|Ogólne|NSTAC': {
        plan: [
          { lecturer: 'Anna Nowak', room: 'Sala C' },
        ],
      },
    },
  };

  const filters = collectGuestPlanFilters(plansData);

  assert.deepEqual(filters.availableLecturers, ['all', 'Adam Kielak', 'Anna Nowak', 'Norbert Sacha']);
  assert.deepEqual(filters.availableRooms, ['all', 'Sala A', 'Sala B', 'Sala C']);
});

test('filterGuestPlanData filters events by lecturer and room while preserving plan structure', () => {
  const plansData = {
    results: {
      '5|ASiSK|STAC': {
        plan: [
          { lecturer: 'Adam Kielak', room: 'Sala A', name: 'Wykład 1' },
          { lecturer: 'Norbert Sacha', room: 'Sala B', name: 'Wykład 2' },
        ],
      },
      '6|Ogólne|NSTAC': {
        plan: [
          { lecturer: 'Adam Kielak', room: 'Sala C', name: 'Wykład 3' },
        ],
      },
    },
  };

  const filtered = filterGuestPlanData(plansData, {
    filterText: '',
    specFilter: 'all',
    semesterFilter: 'all',
    studyModeFilter: 'all',
    lecturerFilter: 'Adam Kielak',
    roomFilter: 'Sala A',
  });

  assert.deepEqual(Object.keys(filtered.results), ['5|ASiSK|STAC']);
  assert.equal(filtered.results['5|ASiSK|STAC'].plan.length, 1);
  assert.equal(filtered.results['5|ASiSK|STAC'].plan[0].name, 'Wykład 1');
});
