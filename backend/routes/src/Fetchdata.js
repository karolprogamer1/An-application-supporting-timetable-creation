import knex from 'knex';

// Konfiguracja bazy – dostosuj do swojego środowiska
const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL || {
    host: 'localhost',
    user: 'stefan',
    password: '!@GAMEDEST',
    database: 'stefan'
  }
});

/**
 * @returns {Promise<import('./types.js').SchedulerInput>}
 */
export async function fetchSchedulerInput() {
  // 0. Pobieramy wszystkie grupy i znajdujemy ID dla "Wszyscy"
  const allGroups = await db('grupy_dziekanskie').select('id_grupy', 'nazwa');
  const wszyscyGroup = allGroups.find(g => g.nazwa === 'Wszyscy');
  const wszyscyId = wszyscyGroup ? wszyscyGroup.id_grupy : null;

  // 1. Pobieramy zajęcia – używamy RAW SQL
  const zajeciaResult = await db.raw(`
    SELECT
      z.idzajecia AS id,
      z.przedmiot_id,
      z.typ,
      z.czas,
      p.wykladowca_id,
      zg.grupa_id
    FROM zajecia z
    INNER JOIN przedmiot p ON z.przedmiot_id = p.idprzedmiotu
    INNER JOIN zajecia_grupy zg ON z.idzajecia = zg.zajecia_id
  `);
  const rawZajecia = zajeciaResult.rows; // dla PostgreSQL

  // 2. Przetwarzanie – deduplikacja wykładów i przypisanie grupy 'Wszyscy'
  const zajeciaMap = new Map(); // klucz: przedmiot_id (dla wykładów) lub przedmiot_id+grupa_id+typ (dla innych)
  for (const row of rawZajecia) {
    const isLecture = row.typ === 'wykład';
    let key;
    if (isLecture) {
      // Dla wykładów: nadpisujemy grupę na 'Wszyscy' (jeśli istnieje)
      if (wszyscyId !== null) {
        row.grupa_id = wszyscyId;
      } else {
        // Jeśli nie ma grupy "Wszyscy", pomiń ten wykład (lub rzuć błąd)
        console.warn('Brak grupy "Wszyscy" – pomijam wykład:', row);
        continue;
      }
      // Klucz dla wykładu: przedmiot_id (jeden wykład na przedmiot)
      key = row.przedmiot_id;
    } else {
      // Dla innych typów: klucz = przedmiot_id + grupa_id + typ (zakładamy unikalność)
      key = `${row.przedmiot_id}_${row.grupa_id}_${row.typ}`;
    }

    // Jeśli już mamy ten klucz, pomijamy (deduplikacja)
    if (!zajeciaMap.has(key)) {
      zajeciaMap.set(key, row);
    }
  }

  const zajecia = Array.from(zajeciaMap.values());

  // 3. Sloty
  const slotsResult = await db.raw(`
    SELECT id_slot AS id, day_of_week, start_time, end_time
    FROM slots
  `);
  const slots = slotsResult.rows;

  // 4. Sale
  const roomsResult = await db.raw(`
    SELECT id_sale AS id, name
    FROM SALE
  `);
  const rooms = roomsResult.rows;

  // 5. Dostępność (tylko false)
  const availabilityRaw = await db.raw(`
    SELECT wykladowca_id, slot_id
    FROM dostepnosc_wykladowcy
    WHERE czy_dostepny = false
  `);
  const availability = {};
  for (const row of availabilityRaw.rows) {
    if (!availability[row.wykladowca_id]) availability[row.wykladowca_id] = {};
    availability[row.wykladowca_id][row.slot_id] = false;
  }

  // 6. Preferencje (kary)
  const preferencesRaw = await db.raw(`
    SELECT wykladowca_id, slot_id, waga_kary
    FROM preferencje_wykladowcy
  `);
  const preferences = {};
  for (const row of preferencesRaw.rows) {
    if (!preferences[row.wykladowca_id]) preferences[row.wykladowca_id] = {};
    preferences[row.wykladowca_id][row.slot_id] = row.waga_kary;
  }

  return {
    zajecia,
    slots,
    rooms,
    availability,
    preferences,
    maxTimeSeconds: 30.0,
  };
}
