const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator')
const pool = require('../db');

router.get('/grupy-dziekanskie', async (req, res) => {
    try {
        const result = await pool.query('SELECT id_grupy, nazwa FROM grupy_dziekanskie ORDER BY nazwa');
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Błąd serwera');
    }
});

router.post('/grupy-dziekanskie', [body('nazwa').notEmpty().withMessage('Nazwa jest wymagana')], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { nazwa } = req.body;
        const newGroup = await pool.query(
            'INSERT INTO grupy_dziekanskie (nazwa) VALUES ($1) RETURNING *',
            [nazwa]
        );
        res.status(201).json(newGroup.rows[0]);
    } catch (err) {
        console.error(err.message);
        if (err.code === '23505') { // unique_violation
            return res.status(400).json({ error: 'Grupa o tej nazwie już istnieje.' });
        }
        res.status(500).send('Błąd serwera');
    }
});

router.put('/grupy-dziekanskie/:id', [body('nazwa').notEmpty().withMessage('Nazwa jest wymagana')], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { id } = req.params;
        const { nazwa } = req.body;
        const idNum = parseInt(id, 10);
        if (isNaN(idNum)) {
            return res.status(400).json({ error: 'ID musi być liczbą' });
        }

        const updatedGroup = await pool.query(
            'UPDATE grupy_dziekanskie SET nazwa = $1 WHERE id_grupy = $2 RETURNING *',
            [nazwa, idNum]
        );

        if (updatedGroup.rows.length === 0) {
            return res.status(404).json({ message: 'Grupa nie znaleziona' });
        }
        res.json(updatedGroup.rows[0]);
    } catch (err) {
        console.error(err.message);
        if (err.code === '23505') { // unique_violation
            return res.status(400).json({ error: 'Grupa o tej nazwie już istnieje.' });
        }
        res.status(500).send('Błąd serwera');
    }
});

router.get('/grupy-dziekanskie/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const idNum = parseInt(id, 10);
        if (isNaN(idNum)) {
            return res.status(400).json({ error: 'Parametr id musi być liczbą całkowitą' });
        }
        const result = await pool.query('SELECT id_grupy AS id, nazwa FROM grupy_dziekanskie WHERE id_grupy = $1', [
            idNum,
        ]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Dany element nie istnieje' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Błąd servera');
    }
});

router.get('/grupa', async (req, res) =>{
    try {
        const result = await pool.query(
            'SELECT id_grupa, student_id, zajecia_id FROM grupa');
        res.json(result.rows);
    }catch (err){
        console.error(err.message);
        res.status(500).send('Błąd servera');
    }
});

router.get('/grupa/:id/:idt',async (req, res) =>{
    try{
    const { id, idt  } = req.params;
    const idNum = parseInt(id, 10);
    const idtNum = parseInt(idt, 10);
    if(isNaN(idNum) || isNaN(idtNum)){
            return res.status(400).json({error: 'Parametr id musi być liczbą całkowitą'})
    }
    const result = await pool.query('SELECT * FROM grupa where id_grupa >= $1 and id_grupa <= $2',[idNum,idtNum])
    if (result.rows.length === 0){
        return res.status(404).json({ message: 'W tym przedziale nie ma elementów'})
    }
    res.json(result.rows);
    }catch (err){
        console.error(err.message);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

router.get('/student/:id/zajecia', async (req, res) => {
    const { id } = req.params;
    const studentId = parseInt(id, 10);
    if (isNaN(studentId)) {
        return res.status(400).json({ error: 'Nieprawidłowy ID studenta' });
    }

    try {
        const query = `
            SELECT
                z.idzajecia, p.nazwa AS subject_name, z.typ, z.czas,
                s.nazwa AS sala_nazwa, s.budynek AS sala_budynek,
                (SELECT COUNT(*) FROM grupa WHERE zajecia_id = z.idzajecia) AS group_count
            FROM grupa g
            JOIN zajecia z ON g.zajecia_id = z.idzajecia
            JOIN przedmiot p ON z.przedmiot_id = p.idprzedmiotu
            LEFT JOIN SALE s ON z.sala_id = s.id_sala
            WHERE g.student_id = $1 ORDER BY p.nazwa, z.typ;
        `;
        const result = await pool.query(query, [studentId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Błąd pobierania zajęć studenta:', err);
        res.status(500).json({ error: 'Błąd serwera podczas pobierania zajęć studenta' });
    }
});

router.post('/grupa', async (req, res) => {
        try {

        const { student_id, student_ids, zajecia_id, ilosc, studentIds, zajeciaId } = req.body;

        // Obsługa bulk: frontend wysyła student_ids, ale wspieramy też student_id (legacy)
        const idsRaw = Array.isArray(student_ids) ? student_ids : (Array.isArray(studentIds) ? studentIds : (student_id != null ? [student_id] : []));
        const studentIdNums = idsRaw
          .map((x) => (x != null && x !== '' ? Number(x) : null))
          .filter((x) => x != null && !Number.isNaN(x));

        if (studentIdNums.length === 0) {
            return res.status(400).json({ error: 'Pole student_id jest wymagane' });
        }

        const zajIdNum = (zajecia_id ?? zajeciaId) != null ? Number(zajecia_id ?? zajeciaId) : null;
        if (zajIdNum == null || Number.isNaN(zajIdNum)) {
            return res.status(400).json({ error: 'Pole zajecia_id musi być liczbą' });
        }

        const studentCheck = await pool.query(
            'SELECT idstudent FROM student WHERE idstudent = ANY($1::int[])',
            [studentIdNums]
        );
        if (studentCheck.rows.length !== studentIdNums.length) {
            const foundIds = new Set(studentCheck.rows.map(r => r.idstudent));
            const missingIds = studentIdNums.filter(id => !foundIds.has(id));
            return res.status(400).json({ error: `Nie znaleziono studentów o ID: ${missingIds.join(', ')}` });
        }

        const zajeciaCheck = await pool.query('SELECT 1 FROM zajecia WHERE idzajecia = $1', [zajIdNum]);
        if (zajeciaCheck.rows.length === 0) {
            return res.status(400).json({ error: `Nie znaleziono zajęć o ID: ${zajIdNum}` });
        }

        const insertOrUpdateResult = await Promise.all(
          studentIdNums.map(async (sid) => {
            // Używamy ON CONFLICT, aby zignorować duplikaty.
            // Dodatkowe zapytanie SELECT jest niepotrzebne.
            const ins = await pool.query(
              'INSERT INTO grupa (student_id, zajecia_id) VALUES ($1, $2) ON CONFLICT (student_id, zajecia_id) DO NOTHING RETURNING *',
              [sid, zajIdNum]
            );
            return ins.rows[0]; // Zwróci wstawiony wiersz lub undefined, jeśli konflikt wystąpił
          })
        )

        const created = insertOrUpdateResult.filter(Boolean); // Filtrujemy puste wyniki z ON CONFLICT
        res.status(201).json(created.length === 1 ? created[0] : created);
    } catch (err) {
        console.error(err.message);
        if (err.code === '23503') {
            return res.status(400).json({ error: 'Podana wartość nie istnieje' });
        }
        return res.status(500).json({ error: 'Błąd serwera' });
    }
});
router.put('/grupa/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const idNum = parseInt(id, 10);
        if (isNaN(idNum)) {
            return res.status(400).json({ error: 'Parametr id musi być liczbą całkowitą' });
        }

        const { student_id, zajecia_id } = req.body;
        const studentIdNum = student_id != null ? Number(student_id) : null;
        const zajIdNum = zajecia_id != null ? Number(zajecia_id) : null;

        if (!studentIdNum) {
            return res.status(400).json({ error: 'Pole student_id jest wymagane' });
        }

        const studentCheck = await pool.query(
            'SELECT idstudent FROM student WHERE idstudent = $1',
            [studentIdNum]
        );
        if (studentCheck.rows.length === 0) {
            return res.status(400).json({ error: `Nie znaleziono studenta o ID: ${studentIdNum}` });
        }

        const check = await pool.query('SELECT * FROM grupa where id_grupa = $1', [idNum]);
        if (check.rows.length === 0) {
            return res.status(404).json({ message: 'Nie znaleziono rekordu' });
        }

        if (zajIdNum != null) {
            const zajeciaCheck = await pool.query('SELECT 1 FROM zajecia WHERE idzajecia = $1', [zajIdNum]);
            if (zajeciaCheck.rows.length === 0) {
                return res.status(400).json({ error: `Nie znaleziono zajęć o ID: ${zajIdNum}` });
            }
        }

        const result = await pool.query(
            'UPDATE grupa SET student_id = $1, zajecia_id = $2 WHERE id_grupa = $3 RETURNING *',
            [studentIdNum, zajIdNum, idNum]
        );
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        if (err.code === '23503') {
            return res.status(400).json({ error: 'Podana wartość nie istnieje' });
        }
        return res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Usuwanie studenta z grupy (bez kasowania rekordów studenta)
// Body: { entries: [{ student_id, id_grupa }] } lub samo: [{ student_id, id_grupa }]
router.delete('/grupa/student', async (req, res) => {
    const client = await pool.connect();
    try {
        const payload = req.body || {};
        const entries = Array.isArray(payload) ? payload : (Array.isArray(payload.entries) ? payload.entries : []);
        if (!Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({ error: 'Tablica entries [{ student_id, id_grupa }] jest wymagana' });
        }

        const parsed = entries.map(e => {
            const student_id = e?.student_id ?? e?.studentId;
            const id_grupa = e?.id_grupa ?? e?.idGrupa;
            const sid = Number(student_id);
            const gid = id_grupa == null ? null : Number(id_grupa);
            return { student_id: sid, id_grupa: gid };
        });

        if (parsed.some(p => !Number.isInteger(p.student_id) || p.student_id <= 0)) {
            return res.status(400).json({ error: 'Każdy entry musi zawierać poprawne student_id (int)' });
        }
        if (parsed.some(p => p.id_grupa != null && (!Number.isInteger(p.id_grupa) || p.id_grupa <= 0))) {
            return res.status(400).json({ error: 'id_grupa jeśli podane, musi być poprawnym int' });
        }

        await client.query('BEGIN');

        let deletedGroups = 0;
        for (const { student_id, id_grupa } of parsed) {
            if (id_grupa != null) {
                const del = await client.query(
                    'DELETE FROM grupa WHERE student_id = $1 AND id_grupa = $2 RETURNING 1',
                    [student_id, id_grupa]
                );
                deletedGroups += del.rowCount;
            } else {
                const del = await client.query(
                    'DELETE FROM grupa WHERE student_id = $1 RETURNING 1',
                    [student_id]
                );
                deletedGroups += del.rowCount;
            }
        }

        await client.query('COMMIT');
        return res.json({ message: 'Usunięto studenta z grupy', deletedGroups });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        return res.status(500).json({ error: 'Błąd serwera' });
    } finally {
        client.release();
    }
});

router.post('/grupy/auto-assign', async (req, res) => {
    const { rok_semestr, tryb } = req.body;

    if (!rok_semestr || !tryb) {
        return res.status(400).json({ error: 'Pola "rok_semestr" i "tryb" są wymagane.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Pobierz wszystkich studentów z danego roku i trybu
        const studentsRes = await client.query(
            'SELECT idstudent, specjalnosc FROM student WHERE rok_semestr = $1 AND tryb = $2',
            [rok_semestr, tryb]
        );
        const allStudents = studentsRes.rows;

        if (allStudents.length === 0) {
            return res.status(404).json({ message: 'Nie znaleziono studentów pasujących do kryteriów.' });
        }

        // 2. Pobierz wszystkie zajęcia dla przedmiotów z danego roku i trybu
        const zajeciaRes = await client.query(
            `SELECT z.idzajecia, p.specjalnosc, p.nazwa AS przedmiot_nazwa
             FROM zajecia z
             JOIN przedmiot p ON z.przedmiot_id = p.idprzedmiotu
             WHERE p.semestr = $1 AND p.tryb = $2`,
            [rok_semestr, tryb]
        );
        const allZajecia = zajeciaRes.rows;

        if (allZajecia.length === 0) {
            return res.status(404).json({ message: 'Nie znaleziono zajęć pasujących do kryteriów.' });
        }

        const summary = [];
        let totalAssignments = 0;

        for (const zajecia of allZajecia) {
            const zajeciaSpecjalnosc = zajecia.specjalnosc || null;
            let studentsToAssign;

            if (zajeciaSpecjalnosc) {
                // Filtruj studentów po specjalizacji
                studentsToAssign = allStudents.filter(s => s.specjalnosc === zajeciaSpecjalnosc);
            } else {
                // Przedmiot ogólny - przypisz wszystkich
                studentsToAssign = allStudents;
            }

            if (studentsToAssign.length > 0) {
                const studentIds = studentsToAssign.map(s => s.idstudent);

                // Usuń istniejące przypisania dla tych zajęć, aby uniknąć duplikatów
                await client.query('DELETE FROM grupa WHERE zajecia_id = $1', [zajecia.idzajecia]);

                // Stwórz nowe przypisania
                const insertQuery = `
                    INSERT INTO grupa (student_id, zajecia_id)
                    SELECT student_id, $1
                    FROM unnest($2::int[]) AS student_id
                `;
                const insertResult = await client.query(insertQuery, [zajecia.idzajecia, studentIds]);
                
                totalAssignments += insertResult.rowCount;
                summary.push({
                    zajeciaId: zajecia.idzajecia,
                    przedmiot: zajecia.przedmiot_nazwa,
                    specjalnosc: zajeciaSpecjalnosc || 'Ogólne',
                    przypisano: insertResult.rowCount
                });
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ message: `Pomyślnie przypisano studentów. Łącznie ${totalAssignments} przypisań.`, summary });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Błąd automatycznego przypisywania grup:', err);
        res.status(500).json({ error: 'Wystąpił błąd serwera.' });
    } finally {
        client.release();
    }
});

router.delete('/grupy-dziekanskie/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const idNum = parseInt(id, 10);
        if (isNaN(idNum)) {
            return res.status(400).json({ error: 'ID musi być liczbą' });
        }

        // TODO: Dodać poprawne sprawdzenie, czy grupa dziekańska jest w użyciu.
        // Poniższy warunek został tymczasowo wykomentowany, ponieważ zapytanie do tabeli `zajecia_grupy`
        // może powodować błąd 500, jeśli tabela nie istnieje lub ma inną strukturę.
        // const usageCheck = await pool.query('SELECT 1 FROM zajecia_grupy WHERE grupa_id = $1 LIMIT 1', [idNum]);
        // if (usageCheck.rows.length > 0) {
        //     return res.status(400).json({ error: 'Nie można usunąć grupy, ponieważ jest przypisana do zajęć.' });
        // }
        const deleteOp = await pool.query('DELETE FROM grupy_dziekanskie WHERE id_grupy = $1', [idNum]);

        if (deleteOp.rowCount === 0) {
            return res.status(404).json({ message: 'Grupa nie znaleziona' });
        }
        res.json({ message: 'Grupa usunięta' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Błąd serwera');
    }
});

router.delete('/grupa/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const idNum = parseInt(id, 10);
        if (isNaN(idNum)) {
            return res.status(400).json({ error: 'Parametr id musi być liczbą całkowitą' });
        }

        const check = await pool.query('SELECT * FROM grupa where id_grupa = $1', [idNum]);
        if (check.rows.length === 0) {
            return res.status(404).json({ message: 'Nie znaleziono rekordu' });
        }

        await pool.query('DELETE FROM grupa WHERE id_grupa = $1', [idNum]);

        res.json({ message: 'Usunięcie rekordu się udało' });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: 'Błąd serwera' });
    }
});
module.exports = router;
