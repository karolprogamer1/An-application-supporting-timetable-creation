const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator')
const pool = require('../db');

const normalizeTime = (time) => {
  if (typeof time !== 'string') return time
  const trimmed = time.trim()
  const hhmm = /^([01]\d|2[0-3]):([0-5]\d)$/
  const hhmmss = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/
  if (hhmmss.test(trimmed)) return trimmed
  if (hhmm.test(trimmed)) return `${trimmed}:00`
  return trimmed
}

const validateClassTime = [
  body().custom((_, { req }) => {
    const rawTime = req.body.czas ?? req.body.time

    if (rawTime == null || rawTime === '') {
      // Czas nie jest już wymagany, może być ustawiony przez generator
      return true;
    }

    const normalized = normalizeTime(rawTime)
    const isValid = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/.test(normalized)

    if (!isValid) {
      throw new Error('Format czasu musi być HH:MM lub HH:MM:SS (np. 09:05 lub 09:05:00)')
    }

    return true
  }),
  body('przedmiot_id').optional().isInt().withMessage('Pole "przedmiot_id" musi być liczbą całkowitą'),
  body('wykladowca_id').optional({ nullable: true }).isInt().withMessage('Pole "wykladowca_id" musi być liczbą całkowitą'),
  body('sala_id').optional({ nullable: true }).isInt().withMessage('Pole "sala_id" musi być liczbą całkowitą'),
  body('grupa').optional({ nullable: true }).isInt().withMessage('Pole "grupa" musi być liczbą całkowitą'),
]


async function resolveLecturerId({ resolvedPrzedmiotId, resolvedWykladowcaId }) {
  const explicitLecturerId = resolvedWykladowcaId != null && resolvedWykladowcaId !== ''
    ? Number(resolvedWykladowcaId)
    : null

  if (explicitLecturerId != null) {
    return explicitLecturerId
  }

  if (resolvedPrzedmiotId != null) {
    const subjectResult = await pool.query(
      'SELECT wykladowca_id FROM przedmiot WHERE idprzedmiotu = $1',
      [resolvedPrzedmiotId]
    )

    if (subjectResult.rows.length > 0 && subjectResult.rows[0].wykladowca_id != null) {
      return Number(subjectResult.rows[0].wykladowca_id)
    }
  }

  return null
}

async function getZajeciaDetailsById(id) {
  const result = await pool.query(
    `SELECT
       z.idzajecia, z.przedmiot_id, z.typ, z.czas, z.sala_id, z.grupa, z.data_rozpoczecia, z.data_zakonczenia, z.dozwolone_dni,
       COALESCE(z.wykladowca_id, p.wykladowca_id) AS wykladowca_id,
       p.nazwa AS subject_name_for_display, p.specjalnosc,
       p.semestr AS semestr_for_display, p.tryb AS tryb_for_display,
       w.imie AS wykladowca_imie, w.nazwisko AS wykladowca_nazwisko,
       s.nazwa AS sala_nazwa,
       s.budynek AS sala_budynek
     FROM zajecia z
     LEFT JOIN przedmiot p ON z.przedmiot_id = p.idprzedmiotu
     LEFT JOIN wykladowca w ON COALESCE(z.wykladowca_id, p.wykladowca_id) = w.idwykladowca
     LEFT JOIN sala s ON z.sala_id = s.id_sala
     WHERE z.idzajecia = $1`,
    [id]
  );
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows[0];
}

router.get('/test', (req, res) => res.send('route works'));
router.get('/zajecia', async (req, res) =>{
    try {
        const result = await pool.query(
          `SELECT
             z.idzajecia,
             z.przedmiot_id,
             z.typ,
             z.czas,
             z.sala_id,
             z.grupa,
             z.data_rozpoczecia,
             z.data_zakonczenia,
             z.dozwolone_dni,
             COALESCE(z.wykladowca_id, p.wykladowca_id) AS wykladowca_id,
             p.nazwa AS subject_name_for_display,
             p.semestr AS semestr_for_display, p.specjalnosc,
             p.tryb AS tryb_for_display,
             w.imie AS wykladowca_imie,
             w.nazwisko AS wykladowca_nazwisko,
             s.nazwa AS sala_nazwa,
             s.budynek AS sala_budynek
           FROM zajecia z
           LEFT JOIN przedmiot p ON z.przedmiot_id = p.idprzedmiotu
           LEFT JOIN wykladowca w ON COALESCE(z.wykladowca_id, p.wykladowca_id) = w.idwykladowca
           LEFT JOIN sala s ON z.sala_id = s.id_sala
           ORDER BY z.idzajecia`
        );
        res.json(result.rows);
    }catch (err){
        console.error(err.message);
        res.status(500).send('Błąd servera');
    }
});

router.get('/zajecia/student/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userIdNum = parseInt(userId, 10);
    if (isNaN(userIdNum)) {
      return res.status(400).json({ error: 'Parametr userId musi być liczbą całkowitą' });
    }

    const studentRes = await pool.query('SELECT idstudent FROM student WHERE uzytkownicy_id = $1', [userIdNum]);
    if (studentRes.rows.length === 0) {
      return res.json([]);
    }
    const studentId = studentRes.rows[0].idstudent;

    const result = await pool.query(
      `SELECT
         g.id_grupa,
         z.idzajecia,
         p.nazwa AS subject_name,
         z.typ,
         z.czas,
         s.nazwa AS sala_nazwa,
         s.budynek AS sala_budynek,
         (SELECT COUNT(*)::int FROM grupa WHERE zajecia_id = z.idzajecia) AS group_count
       FROM grupa g
       JOIN zajecia z ON g.zajecia_id = z.idzajecia
       LEFT JOIN przedmiot p ON z.przedmiot_id = p.idprzedmiotu
       LEFT JOIN sala s ON z.sala_id = s.id_sala
       WHERE g.student_id = $1
       ORDER BY p.nazwa, z.typ`,
      [studentId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Błąd pobierania zajęć studenta:', err.message);
    res.status(500).json({ error: 'Błąd serwera podczas pobierania zajęć studenta' });
  }
});

router.get('/zajecia/:id', async (req, res) =>{
    try{
    const { id } = req.params;
    const idNum = parseInt(id, 10);
    if(isNaN(idNum)){
            return res.status(400).json({error: 'Parametr id musi być liczbą całkowitą'})
        }
    const result = await pool.query('SELECT idzajecia, przedmiot_id, wykladowca_id, typ, czas, sala_id, grupa, data_rozpoczecia, data_zakonczenia, dozwolone_dni FROM zajecia where idzajecia = $1', [idNum])
    if (result.rows.length === 0){
        return res.status(404).json({ message: 'Dany element nie istnieje'})
    }
    res.json(result.rows[0]);

    }catch (err){
        console.error(err.message);
        res.status(500).send('Błąd servera');
    }
});

router.get('/zajecia/:id/:idt',async (req, res) =>{
    try{
    const { id, idt  } = req.params;
    const idNum = parseInt(id, 10);
    const idtNum = parseInt(idt, 10);
     if(isNaN(idNum) || isNaN(idtNum)){
            return res.status(400).json({error: 'Parametr id musi być liczbą całkowitą'})
        }
    const result = await pool.query('SELECT idzajecia, przedmiot_id, wykladowca_id, typ, czas, sala_id, grupa, data_rozpoczecia, data_zakonczenia, dozwolone_dni FROM zajecia where idzajecia >= $1 and idzajecia <= $2',[idNum,idtNum])
    if (result.rows.length === 0){
        return res.status(404).json({ message: 'W tym przedziale nie ma elementów'})
    }
    res.json(result.rows);
    }catch (err){
        console.error(err.message);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});
router.post('/zajecia', validateClassTime, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()){
        return res.status(400).json({ errors: errors.array() });
    }
    try{
        let {przedmiot_id, subjectId, wykladowca_id, lecturerId, typ, czas, time, sala_id, roomId, grupa, groupId, data_rozpoczecia, data_zakonczenia, dozwolone_dni} = req.body
        const resolvedPrzedmiotId = przedmiot_id ?? subjectId ?? null
        const resolvedWykladowcaIdInput = wykladowca_id ?? lecturerId ?? null
        let resolvedSalaId = sala_id ?? roomId ?? null
        const resolvedGrupa = grupa ?? groupId ?? null
        const resolvedTime = normalizeTime(czas ?? time)

        const resolvedWykladowcaId = await resolveLecturerId({
            resolvedPrzedmiotId,
            resolvedWykladowcaId: resolvedWykladowcaIdInput,
        })

        // jeśli podano przedmiot_id — sprawdź czy istnieje
        if (resolvedPrzedmiotId != null) {
            const chk = await pool.query('SELECT 1 FROM przedmiot WHERE idprzedmiotu = $1', [resolvedPrzedmiotId])
            if (chk.rows.length === 0) {
                return res.status(400).json({ error: `Przedmiot o id ${resolvedPrzedmiotId} nie istnieje` })
            }
        }
        if (resolvedWykladowcaId != null) {
            const chk = await pool.query('SELECT 1 FROM wykladowca WHERE idwykladowca = $1', [resolvedWykladowcaId])
            if (chk.rows.length === 0) {
                return res.status(400).json({ error: `Wykladowca o id ${resolvedWykladowcaId} nie istnieje` })
            }
        }
        // sala jest opcjonalna
        if (resolvedSalaId != null && resolvedSalaId !== '') {
          const roomIdNumber = Number(resolvedSalaId);
          const chkSala = await pool.query('SELECT 1 FROM sala WHERE id_sala = $1', [roomIdNumber])
          if (chkSala.rows.length === 0) {
            return res.status(400).json({ error: `Sala o id ${roomIdNumber} nie istnieje` })
          }
        }

        const result = await pool.query(
            `INSERT INTO zajecia (przedmiot_id, wykladowca_id, typ, czas, sala_id, grupa, data_rozpoczecia, data_zakonczenia, dozwolone_dni)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING idzajecia`,
            [resolvedPrzedmiotId, resolvedWykladowcaId, typ || null, resolvedTime, (resolvedSalaId != null && resolvedSalaId !== '') ? Number(resolvedSalaId) : null, resolvedGrupa, data_rozpoczecia || null, data_zakonczenia || null, dozwolone_dni || null]
        );

        const row = result.rows[0];
        const newClassDetails = await getZajeciaDetailsById(row.idzajecia);

        if (!newClassDetails) return res.status(404).json({ message: 'Nie znaleziono dodanego rekordu' });
        res.status(201).json(newClassDetails);
    }catch (err){
        console.error(err.message);
        if (err.code === '23503') {
            return res.status(400).json({ error: 'Niepoprawny klucz obcy' });
        }
        res.status(500).json({ error: 'Błąd serwera' });
    }
});
router.put('/zajecia/:id', validateClassTime, async (req,res) =>{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try{
        const { id } = req.params;
        const idNum = parseInt(id, 10);
         if(isNaN(idNum)){
            return res.status(400).json({error: 'Parametr id musi być liczbą całkowitą'})
        }
        let {przedmiot_id, subjectId, wykladowca_id, lecturerId, typ, czas, time, sala_id, roomId, grupa, groupId, data_rozpoczecia, data_zakonczenia, dozwolone_dni} = req.body;
        const resolvedPrzedmiotId = przedmiot_id ?? subjectId ?? null
        const resolvedWykladowcaIdInput = wykladowca_id ?? lecturerId ?? null
        let resolvedSalaId = sala_id ?? roomId ?? null
        const resolvedGrupa = grupa ?? groupId ?? null
        const resolvedTime = normalizeTime(czas ?? time)
        const check = await pool.query('SELECT idzajecia FROM zajecia WHERE idzajecia = $1',[idNum]);

        if(check.rows.length === 0) {

            return res.status(404).json({message:'Nie znaleziono rekordu'})
        }
        if (resolvedPrzedmiotId != null) {
            const chk = await pool.query('SELECT 1 FROM przedmiot WHERE idprzedmiotu = $1', [resolvedPrzedmiotId])
            if (chk.rows.length === 0) {
                return res.status(400).json({ error: `Przedmiot o id ${resolvedPrzedmiotId} nie istnieje` })
            }
        }
        const resolvedWykladowcaId = await resolveLecturerId({
            resolvedPrzedmiotId,
            resolvedWykladowcaId: resolvedWykladowcaIdInput,
        })

        if (resolvedWykladowcaId != null) {
            const chk = await pool.query('SELECT 1 FROM wykladowca WHERE idwykladowca = $1', [resolvedWykladowcaId])
            if (chk.rows.length === 0) {
                return res.status(400).json({ error: `Wykladowca o id ${resolvedWykladowcaId} nie istnieje` })
            }
        }

        // sala jest opcjonalna
        if (resolvedSalaId != null && resolvedSalaId !== '') {
          const roomIdNumber = Number(resolvedSalaId);
          const chkSala = await pool.query('SELECT 1 FROM sala WHERE id_sala = $1', [roomIdNumber])
          if (chkSala.rows.length === 0) {
            return res.status(400).json({ error: `Sala o id ${roomIdNumber} nie istnieje` })
          }
        }

        const result = await pool.query(
          'UPDATE zajecia SET przedmiot_id = $1, wykladowca_id = $2, typ = $3, czas = $4, sala_id = $5, grupa = $6, data_rozpoczecia = $7, data_zakonczenia = $8, dozwolone_dni = $9 WHERE idzajecia = $10 RETURNING idzajecia',
          [resolvedPrzedmiotId, resolvedWykladowcaId, typ || null, resolvedTime || null, (resolvedSalaId != null && resolvedSalaId !== '') ? Number(resolvedSalaId) : null, resolvedGrupa, data_rozpoczecia || null, data_zakonczenia || null, dozwolone_dni || null, idNum]
        );

        const updatedClassDetails = await getZajeciaDetailsById(idNum);

        if (!updatedClassDetails) {
          return res.status(404).json({ message: 'Zaktualizowany rekord nie został znaleziony' });
        }

        res.json(updatedClassDetails);
    }catch(err){
        console.error(err.message);
        if (err.code === '23503') {
            if (err.constraint === 'fk_zajecia_przedmiot') {
                return res.status(400).json({ error: 'Podany przedmiot_id nie istnieje' });
            }
            if (err.constraint === 'fk_zajecia_wykladowca') {
                return res.status(400).json({ error: 'Podany wykladowca_id nie istnieje' });
            }
            if (err.constraint === 'fk_zajecia_sala') {
                return res.status(400).json({ error: 'Podana sala_id nie istnieje' });
            }
            return res.status(400).json({ error: 'Naruszenie więzów klucza obcego' });
        }
        return res.status(500).json({error: 'Błąd serwera'});
    }
});
router.delete('/zajecia/:id',async (req,res) =>{
    const client = await pool.connect();
    try{
        const { id } = req.params;
        const idNum = parseInt(id, 10);
        if(isNaN(idNum)){
            return res.status(400).json({error: 'Parametr id musi być liczbą całkowitą'})
        }
        await client.query('BEGIN');
        const check = await client.query('SELECT * FROM zajecia WHERE idzajecia = $1',[idNum]);
        if(check.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({message:'Nie znaleziono rekordu'})
        }
        await client.query('DELETE FROM grupa WHERE zajecia_id = $1',[idNum]);
        await client.query('DELETE FROM zajecia WHERE idzajecia = $1',[idNum]);
        await client.query('COMMIT');
        res.json({message: 'Usunięcie rekordu się udało'});
    }catch(err){
        await client.query('ROLLBACK');
        console.error(err.message);
        return res.status(500).json({error: 'Błąd serwera'});
    } finally {
        client.release();
    }

});
module.exports = router;
