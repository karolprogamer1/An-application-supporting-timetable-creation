// Active: 1780865938388@@127.0.0.1@5432@postgres
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../db');

router.get('/student', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT s.idstudent, s.nr_albumu, s.uzytkownicy_id, s.rok_semestr, s.tryb, s.specjalnosc, u.login AS user_login FROM student s LEFT JOIN uzytkownicy u ON s.uzytkownicy_id = u.id AND lower(u.rola) = lower('student') ORDER BY s.idstudent"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.get('/student/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
      return res.status(400).json({ error: 'Parametr id musi być liczbą całkowitą' });
    }
    const result = await pool.query(
      "SELECT s.idstudent, s.nr_albumu, s.uzytkownicy_id, s.rok_semestr, s.tryb, s.specjalnosc, u.login AS user_login FROM student s LEFT JOIN uzytkownicy u ON s.uzytkownicy_id = u.id AND lower(u.rola) = lower('student') WHERE s.idstudent = $1",
      [idNum]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Dany element nie istnieje' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

async function resolveStudentUserId(userId) {
  if (userId == null) return null;
  const result = await pool.query('SELECT id, lower(rola) AS rola FROM uzytkownicy WHERE id = $1', [userId]);
  if (result.rows.length === 0) return null;
  return result.rows[0].rola === 'student' ? result.rows[0].id : -1;
}

async function isLoginTakenByOtherRole(login) {
  if (!login) return false;
  const result = await pool.query(
    'SELECT id FROM uzytkownicy WHERE lower(login) = lower($1) AND lower(rola) != lower($2) LIMIT 1',
    [login, 'student']
  );
  return result.rows.length > 0;
}

router.post('/student', async (req, res) => {
  try {
    const { nr_albumu, zajecia_id, uzytkownicy_id, rokSemestr, tryb, login, password, rok_semestr, specjalnosc } = req.body;
    const rok_semestr_val = (rok_semestr ?? rokSemestr) || null;
    const studentTryb = tryb || 'STAC';
    const studentSpecjalnosc = specjalnosc || null;
    const studentNumber = nr_albumu == null || nr_albumu === '' ? null : Number(nr_albumu);
    if (nr_albumu != null && nr_albumu !== '' && Number.isNaN(studentNumber)) {
      return res.status(400).json({ error: 'Numer albumu musi być liczbą' });
    }

    let validUzytkownicyId = null;

    if (uzytkownicy_id != null) {
      const resolvedId = await resolveStudentUserId(Number(uzytkownicy_id));
      if (resolvedId === null) {
        return res.status(400).json({ error: 'Podany uzytkownicy_id nie istnieje' });
      }
      if (resolvedId === -1) {
        return res.status(400).json({ error: 'Podany uzytkownicy_id nie jest kontem studenta' });
      }
      validUzytkownicyId = resolvedId;
    } else if (login) {
      if (await isLoginTakenByOtherRole(login)) {
        return res.status(400).json({ error: 'Login jest już używany przez konto innej roli' });
      }
      const role = 'student';
      const up = await pool.query(
        'SELECT id FROM uzytkownicy WHERE lower(login) = lower($1) AND lower(rola) = lower($2) LIMIT 1',
        [login, role]
      );

      const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
      if (up.rows.length > 0) {
        validUzytkownicyId = up.rows[0].id;
      } else {
        const ins = await pool.query(
          'INSERT INTO uzytkownicy (rola, login, haslo) VALUES($1, $2, $3) RETURNING id',
          [role, login, hashedPassword]
        );
        validUzytkownicyId = ins.rows[0].id;
      }
    }

    if (!validUzytkownicyId) {
      return res.status(400).json({ error: 'Brak poprawnego uzytkownicy_id lub (login/haslo) do utworzenia konta studenta' });
    }

    // Walidacja zajecia_id, jeśli jest podane
    if (zajecia_id != null) {
      const zajeciaCheck = await pool.query('SELECT 1 FROM zajecia WHERE idzajecia = $1', [zajecia_id]);
      if (zajeciaCheck.rows.length === 0) {
        return res.status(400).json({ error: `Nie znaleziono zajęć o ID: ${zajecia_id}` });
      }
    }

    const result = await pool.query(
      'INSERT INTO student (Uzytkownicy_id, nr_albumu, rok_semestr, tryb, specjalnosc) VALUES($1, $2, $3, $4, $5) RETURNING *',
      [validUzytkownicyId, studentNumber, rok_semestr_val, studentTryb, studentSpecjalnosc]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Podany klucz obcy nie istnieje' });
    }
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Login użytkownika już istnieje' });
    }
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.put('/student/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
      return res.status(400).json({ error: 'Parametr id musi być liczbą całkowitą' });
    }
    const { nr_albumu, zajecia_id, uzytkownicy_id, rokSemestr, tryb, rok_semestr, specjalnosc, login, password } = req.body;
    
    const check = await pool.query('SELECT * FROM student WHERE idstudent = $1', [idNum]);
    if (check.rows.length === 0) {
      return res.status(404).json({ message: 'Nie znaleziono rekordu' });
    }
    const current = check.rows[0];

    const rok_semestr_upd = (rok_semestr ?? rokSemestr) || null;
    const studentTrybUpd = tryb || null;
    const studentSpecjalnostUpd = specjalnosc || null;
    const studentNumber = nr_albumu == null || nr_albumu === '' ? null : Number(nr_albumu);

    let validUzytkownicyIdUpd = current.uzytkownicy_id;
    let currentUserRole = null;

    if (validUzytkownicyIdUpd != null) {
      const currentUser = await pool.query('SELECT lower(rola) AS rola FROM uzytkownicy WHERE id = $1', [validUzytkownicyIdUpd]);
      if (currentUser.rows.length > 0) {
        currentUserRole = currentUser.rows[0].rola;
      }
    }

    if (login && await isLoginTakenByOtherRole(login)) {
      return res.status(400).json({ error: 'Login jest już używany przez konto innej roli' });
    }

    if (uzytkownicy_id != null) {
      const resolvedId = await resolveStudentUserId(Number(uzytkownicy_id));
      if (resolvedId === null) {
        return res.status(400).json({ error: 'Podany uzytkownicy_id nie istnieje' });
      }
      if (resolvedId === -1) {
        return res.status(400).json({ error: 'Podany uzytkownicy_id nie jest kontem studenta' });
      }
      validUzytkownicyIdUpd = resolvedId;
      currentUserRole = 'student';
    }

    if (currentUserRole && currentUserRole !== 'student') {
      if (login || password) {
        const userRes = await pool.query(
          'INSERT INTO uzytkownicy (rola, login, haslo) VALUES($1,$2,$3) RETURNING id',
          ['student', login || null, password || null]
        );
        validUzytkownicyIdUpd = userRes.rows[0]?.id || null;
      } else {
        return res.status(400).json({ error: 'Obecne konto powiązane ze studentem nie jest kontem studenta. Podaj nowy login lub uzytkownicy_id.' });
      }
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    if (!validUzytkownicyIdUpd && login) {
      const userRes = await pool.query(
        'INSERT INTO uzytkownicy (rola, login, haslo) VALUES($1,$2,$3) RETURNING id',
        ['student', login, hashedPassword]
      );
      validUzytkownicyIdUpd = userRes.rows[0]?.id || null;
    } else if (validUzytkownicyIdUpd && currentUserRole === 'student' && (login || hashedPassword)) {
      const setClauses = [];
      const values = [];
      if (login) {
        values.push(login);
        setClauses.push(`login = $${values.length}`);
      }
      if (hashedPassword) {
        values.push(hashedPassword);
        setClauses.push(`haslo = $${values.length}`);
      }
      values.push(validUzytkownicyIdUpd);
      await pool.query(
        `UPDATE uzytkownicy SET ${setClauses.join(', ')} WHERE id = $${values.length}`,
        values
      );
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'zajecia_id')) {
      const zajIdVal = zajecia_id != null && zajecia_id !== '' ? Number(zajecia_id) : null;
      if (zajIdVal != null) {
        const zajeciaCheck = await pool.query('SELECT 1 FROM zajecia WHERE idzajecia = $1', [zajIdVal]);
        if (zajeciaCheck.rows.length === 0) {
          return res.status(400).json({ error: `Nie znaleziono zajęć o ID: ${zajIdVal}` });
        }
      }
      // Ta kolumna nie istnieje w tabeli student, więc usuwamy próbę jej aktualizacji.
    }

    const result = await pool.query(
      'UPDATE student SET Uzytkownicy_id = $1, nr_albumu = $2, rok_semestr = $3, tryb = $4, specjalnosc = $5 WHERE idstudent = $6 RETURNING *',
      [validUzytkownicyIdUpd, studentNumber, rok_semestr_upd, studentTrybUpd, studentSpecjalnostUpd, idNum]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Podany klucz obcy nie istnieje' });
    }
    res.status(500).json({ error: 'Błąd serwera' });
  }
});


router.delete('/student/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
      return res.status(400).json({ error: 'Parametr id musi być liczbą całkowitą' });
    }
    await client.query('BEGIN');
    const check = await client.query('SELECT * FROM student WHERE idstudent = $1', [idNum]);
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Nie znaleziono rekordu' });
    }
    await client.query('DELETE FROM grupa WHERE student_id = $1', [idNum]);
    await client.query('DELETE FROM student WHERE idstudent = $1', [idNum]);
    await client.query('COMMIT');
    res.json({ message: 'Usunięcie rekordu się udało' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ error: 'Błąd serwera' });
  } finally {
    client.release();
  }
});

router.delete('/student', async (req, res) => {
  const client = await pool.connect();
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Tablica identyfikatorów studentów jest wymagana' });
    }

    const idNums = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    if (idNums.length !== ids.length) {
      return res.status(400).json({ error: 'Wszystkie identyfikatory muszą być liczbami całkowitymi' });
    }

    await client.query('BEGIN');
    // Usuń powiązane rekordy z tabeli `grupa`
    await client.query('DELETE FROM grupa WHERE student_id = ANY($1::int[])', [idNums]);
    // Usuń studentów
    const deleteResult = await client.query('DELETE FROM student WHERE idstudent = ANY($1::int[])', [idNums]);
    await client.query('COMMIT');

    res.json({ message: `Usunięto ${deleteResult.rowCount} studentów.` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ error: 'Błąd serwera podczas usuwania studentów' });
  } finally {
    client.release();
  }
});

module.exports = router;
