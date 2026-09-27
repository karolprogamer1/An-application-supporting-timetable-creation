const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator')
const pool = require('../db');

router.get('/wykladowca', async (req, res) =>{
    try {
        const result = await pool.query(
          `SELECT w.idwykladowca, w.uzytkownicy_id, w.imie, w.nazwisko, w.tytul_naukowy,
                  u.login AS user_login, u.rola AS user_rola
           FROM wykladowca w
           LEFT JOIN uzytkownicy u ON w.uzytkownicy_id = u.id
           ORDER BY w.idwykladowca`
        );
        res.json(result.rows);
    }catch (err){
        console.error(err.message);
        res.status(500).send('Błąd servera');
    }
});
router.get('/wykladowca/:id', async (req, res) =>{
    try{
    const { id } = req.params;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
      return res.status(400).json({ error: 'Parametr id musi być liczbą całkowitą' });
    }
    const result = await pool.query(
      `SELECT w.idwykladowca, w.uzytkownicy_id, w.imie, w.nazwisko, w.tytul_naukowy,
              u.login AS user_login, u.rola AS user_rola
       FROM wykladowca w
       LEFT JOIN uzytkownicy u ON w.uzytkownicy_id = u.id
       WHERE w.idwykladowca = $1`,
      [idNum]
    )
    if (result.rows.length === 0){
        return res.status(404).json({ message: 'Dany element nie istnieje'})
    }
    res.json(result.rows[0]);

    }catch (err){
        console.error(err.message);
        res.status(500).send('Błąd servera');
    }
});

router.get('/wykladowca/range/:id/:idt', async (req, res) => {
    try {
      const { id, idt } = req.params;
      const idNum = parseInt(id, 10);
      const idtNum = parseInt(idt, 10);
      if (isNaN(idNum) || isNaN(idtNum)) {
        return res.status(400).json({ error: 'Parametry muszą być liczbami całkowitymi' });
      }
      const result = await pool.query(
        `SELECT w.idwykladowca, w.uzytkownicy_id, w.imie, w.nazwisko, w.tytul_naukowy,
                u.login AS user_login, u.rola AS user_rola
         FROM wykladowca w
         LEFT JOIN uzytkownicy u ON w.uzytkownicy_id = u.id
         WHERE w.idwykladowca >= $1 AND w.idwykladowca <= $2`,
        [idNum, idtNum]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'W tym przedziale nie ma elementów' });
      }
      res.json(result.rows);
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ error: 'Błąd serwera' });
    }
});
router.post('/wykladowca', async (req, res) => {
    try {
        const {
            uzytkownicy_id,
            imie,
            nazwisko,
            tytul_naukowy,
            login,
            haslo,
            rola
        } = req.body;

        let userId = uzytkownicy_id ?? null;

        // Je�li nie podano ID u�ytkownika, ale podano login,
        // utw�rz nowe konto u�ytkownika.
        if (!userId && login) {
            const userRes = await pool.query(
                `INSERT INTO uzytkownicy (rola, login, haslo)
                 VALUES ($1, $2, $3)
                 RETURNING id`,
                [
                    rola || 'wykladowca',
                    login,
                    haslo || null
                ]
            );

            userId = userRes.rows[0].id;
        }

        // Je�li podano uzytkownicy_id, sprawd� czy istnieje.
        if (userId) {
            const checkUser = await pool.query(
                `SELECT id
                 FROM uzytkownicy
                 WHERE id = $1`,
                [userId]
            );

            if (checkUser.rows.length === 0) {
                return res.status(400).json({
                    error: `U�ytkownik o id ${userId} nie istnieje w tabeli uzytkownicy`
                });
            }
        }

        const result = await pool.query(
            `INSERT INTO wykladowca
             (uzytkownicy_id, imie, nazwisko, tytul_naukowy)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [
                userId,
                imie || null,
                nazwisko || null,
                tytul_naukowy || null
            ]
        );

        res.status(201).json(result.rows[0]);

    } catch (err) {
        console.error('B��d dodawania wyk�adowcy:', err);

        if (err.code === '23505' && err.constraint === 'uzytkownicy_login_key') {
            return res.status(400).json({
                error: `Login "${login}" ju� istnieje.`
            });
        }

        if (err.code === '23503' && err.constraint === 'fk_wykladowca_uzytkownik') {
            return res.status(400).json({
                error: 'Podany uzytkownicy_id nie istnieje w tabeli uzytkownicy.'
            });
        }

        res.status(500).json({
            error: 'B��d serwera',
            details: err.message
        });
    }
});router.put('/wykladowca/:id', async (req,res) =>{
    try{
        const { id } = req.params;
        const idNum = parseInt(id, 10);
        if (isNaN(idNum)) {
          return res.status(400).json({ error: 'Parametr id musi być liczbą całkowitą' });
        }

        const {uzytkownicy_id, imie, nazwisko, tytul_naukowy, login, haslo, rola} = req.body;

        const check = await pool.query('SELECT * FROM wykladowca where idwykladowca = $1',[idNum]);
        if(check.rows.length === 0) {
            return res.status(404).json({message:'Nie znaleziono rekordu'})
        }

        const currentLecturer = check.rows[0];
        const currentUserId = currentLecturer.uzytkownicy_id;
        let finalUserId = currentUserId;

        const formUserId = uzytkownicy_id;

        // Scenario 1: The user link is being changed (or set for the first time, or removed).
        if (formUserId !== currentUserId) {
            finalUserId = formUserId;
            // When re-linking, we don't touch the credentials of the target user.
        }
        // Scenario 2: The user link is NOT being changed.
        else {
            // Sub-scenario 2a: No user is linked, but credentials are provided to create one.
            if (!currentUserId && login) {
                const userRes = await pool.query(
                    'INSERT INTO uzytkownicy (rola, login, haslo) VALUES($1,$2,$3) RETURNING id',
                    [rola || 'wykladowca', login, haslo || null]
                );
                finalUserId = userRes.rows[0]?.id || null;
            }
            // Sub-scenario 2b: A user is already linked, and credentials are provided to update them.
            else if (currentUserId && (login || haslo)) {
                await pool.query(
                    'UPDATE uzytkownicy SET rola = COALESCE($1, rola), login = COALESCE($2, login), haslo = COALESCE($3, haslo) WHERE id = $4',
                    [rola || null, login || null, haslo || null, currentUserId]
                );
            }
        }

        const result = await pool.query(
          'UPDATE wykladowca SET uzytkownicy_id = $1, imie = $2, nazwisko = $3, tytul_naukowy = $4 WHERE idwykladowca = $5 RETURNING *',
          [
              finalUserId,
              imie || null,
              nazwisko || null,
              tytul_naukowy || null,
              idNum,
          ]
        );
        res.status(200).json(result.rows[0]);
        }catch(err){
            console.error(err.message);
             if (err.constraint === 'fk_uzytkownicy') {
            return res.status(400).json({ error: 'Podany uzytkownic nie istnieje' });
            }
            if (err.constraint === 'uzytkownicy_login_key') {
                return res.status(400).json({ error: `Login "${login}" już istnieje.` });
            }
            return res.status(500).json({error: 'Błąd serwera'});
        }
});

router.get('/wykladowca/:id/preferences', async (req, res) => {
    try {
        const { id } = req.params;
        const idNum = parseInt(id, 10);
        if (isNaN(idNum)) {
            return res.status(400).json({ error: 'Parametr id musi być liczbą całkowitą' });
        }

        const result = await pool.query(
            'SELECT slot_id, waga_kary FROM preferencje_wykladowcy WHERE wykladowca_id = $1',
            [idNum]
        );

        const preferences = {};
        for (const row of result.rows) {
            preferences[row.slot_id] = row.waga_kary;
        }

        res.json({ preferences });

    } catch (err) {
        console.error('Błąd pobierania preferencji wykładowcy:', err.message);
        if (err.code === '42P01') { // undefined_table
             // Jeśli tabela nie istnieje, zwróć puste preferencje, aby aplikacja mogła działać dalej.
             return res.json({ preferences: {} });
        }
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

router.put('/wykladowca/:id/preferences', async (req, res) => {
    const { id } = req.params;
    const { preferences } = req.body; // Oczekuje obiektu w formacie { slot_id: penalty, ... }
    const idNum = parseInt(id, 10);

    if (isNaN(idNum)) {
        return res.status(400).json({ error: 'Nieprawidłowy ID wykładowcy' });
    }
    if (!preferences || typeof preferences !== 'object') {
        return res.status(400).json({ error: 'Pole "preferences" jest wymagane i musi być obiektem.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query('DELETE FROM preferencje_wykladowcy WHERE wykladowca_id = $1', [idNum]);

        const preferenceEntries = Object.entries(preferences);

        if (preferenceEntries.length > 0) {
            const values = [];
            const placeholders = [];
            let idx = 1;
            for (const [slot_id, waga_kary] of preferenceEntries) {
                const slotIdNum = Number(slot_id);
                const wagaKaryNum = Number(waga_kary);
                if (!Number.isNaN(slotIdNum) && !Number.isNaN(wagaKaryNum) && wagaKaryNum > 0) {
                    values.push(idNum, slotIdNum, wagaKaryNum);
                    placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2})`);
                    idx += 3;
                }
            }

            if (placeholders.length > 0) {
                const query = `INSERT INTO preferencje_wykladowcy (wykladowca_id, slot_id, waga_kary) VALUES ${placeholders.join(', ')}`;
                await client.query(query, values);
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Preferencje zostały zaktualizowane.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Błąd zapisu preferencji wykładowcy:', err);
        if (err.code === '42P01') { // undefined_table
            // Jeśli tabela nie istnieje, poinformuj użytkownika, że funkcja jest niedostępna.
            return res.status(503).json({ error: 'Funkcja zapisywania preferencji jest niedostępna, ponieważ wymagana tabela w bazie danych nie istnieje.' });
        }
        res.status(500).json({ error: 'Błąd serwera' });
    } finally {
        client.release();
    }
});

router.delete('/wykladowca/:id',async (req,res) =>{
    const client = await pool.connect();
    try{
        const { id } = req.params;
        const idNum = parseInt(id, 10);
        if (isNaN(idNum)) {
          return res.status(400).json({ error: 'Parametr id musi być liczbą całkowitą' });
        }
        await client.query('BEGIN');
        const check = await client.query('SELECT * FROM wykladowca where idwykladowca = $1',[idNum]);
        if(check.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({message:'Nie znaleziono rekordu'})
        }
        await client.query('UPDATE zajecia SET wykladowca_id = NULL WHERE wykladowca_id = $1',[idNum]);
        await client.query('UPDATE przedmiot SET wykladowca_id = NULL WHERE wykladowca_id = $1',[idNum]);
        await client.query('DELETE FROM wykladowca WHERE idwykladowca = $1',[idNum]);
        await client.query('COMMIT');
        res.json({message: 'Usunięcie recordu się udało'});
    }catch(err){
        await client.query('ROLLBACK');
        console.error(err.message);
        return res.status(500).json({error: 'Błąd serwera'});
    } finally {
        client.release();
    }

});
module.exports = router;
