const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');

router.post('/auth/login', async (req, res) => {
  try {
    const {
      username: rawUsername,
      password: rawPassword,
      login: rawLogin,
      haslo: rawHaslo,
    } = req.body;

    const username = rawUsername || rawLogin;
    const password = rawPassword || rawHaslo;

    if (!username || !password) {
      return res.status(400).json({ message: 'Wszystkie pola są wymagane' });
    }

    const query = `SELECT u.id, u.id AS uzytkownicy_id, u.rola, u.login, u.haslo, w.idwykladowca, s.idstudent, s.nr_albumu
                   FROM uzytkownicy u
                   LEFT JOIN wykladowca w ON w.uzytkownicy_id = u.id
                   LEFT JOIN student s ON s.uzytkownicy_id = u.id
                   WHERE u.login = $1`;

    const result = await pool.query(query, [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Nieprawidłowy login lub hasło' });
    }

    const userRecord = result.rows[0];
    const storedPassword = userRecord.haslo
    const isHashedPassword = typeof storedPassword === 'string' && /^\$2[abxy]\$/.test(storedPassword)

    const passwordMatch = isHashedPassword
      ? await bcrypt.compare(password, storedPassword)
      : password === storedPassword

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Nieprawidłowy login lub hasło' });
    }

    if (!isHashedPassword && typeof storedPassword === 'string' && storedPassword !== '') {
      try {
        const newHash = await bcrypt.hash(password, 10)
        await pool.query('UPDATE uzytkownicy SET haslo = $1 WHERE id = $2', [newHash, userRecord.id])
      } catch (hashErr) {
        console.error('Failed to update legacy password hash for user', userRecord.login, hashErr)
      }
    }

    const userPayload = { ...userRecord }
    delete userPayload.haslo

    if (userPayload.rola?.toString?.().toLowerCase?.() === 'wykladowca') {
      if (!userPayload.idwykladowca) {
        console.error('Lecturer login returned no idwykladowca for user', userPayload)
        return res.status(500).json({ message: 'Konto wykładowcy nie ma powiązanego rekordu wykładowcy' });
      }
      // Nadpisz 'id' (które może być z tabeli uzytkownicy) poprawnym id wykładowcy
      userPayload.id = userPayload.idwykladowca;
    }

    if (userPayload.rola?.toString?.().toLowerCase?.() === 'student') {
      if (userPayload.idstudent) {
        userPayload.uzytkownicy_id = userPayload.id;
        userPayload.id = userPayload.idstudent;
        if (userPayload.nr_albumu != null) {
          userPayload.indexNumber = userPayload.nr_albumu?.toString?.();
        }
      } else {
        const studentRes = await pool.query(
          'SELECT idstudent, nr_albumu FROM student WHERE uzytkownicy_id = $1 LIMIT 1',
          [userPayload.id]
        );
        if (studentRes.rows.length > 0) {
          userPayload.uzytkownicy_id = userPayload.id;
          userPayload.idstudent = studentRes.rows[0].idstudent;
          userPayload.id = studentRes.rows[0].idstudent;
          if (studentRes.rows[0].nr_albumu != null) {
            userPayload.nr_albumu = studentRes.rows[0].nr_albumu;
            userPayload.indexNumber = studentRes.rows[0].nr_albumu.toString();
          }
        } else {
          console.warn('Student login returned no student record for uzytkownicy_id', userPayload.id);
        }
      }
    }

    if (userPayload.nr_albumu != null && !userPayload.indexNumber) {
      userPayload.indexNumber = userPayload.nr_albumu?.toString?.();
    }

    res.json({ user: userPayload });
  } catch (err) {
    console.error('Auth login error:', err);
    if (err.code === '28P01') {
      return res.status(500).json({ message: 'Błąd uwierzytelniania bazy danych. Sprawdź backend/.env.' });
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return res.status(500).json({ message: 'Nie można połączyć z serwerem bazy danych. Sprawdź backend/.env.' });
    }
    res.status(500).json({ message: 'Błąd serwera podczas logowania' });
  }
});

module.exports = router;
