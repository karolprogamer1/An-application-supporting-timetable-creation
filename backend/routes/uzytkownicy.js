const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator')
const pool = require('../db');

router.get('/uzytkownicy', async (req, res) =>{
    try {
        const result = await pool.query('SELECT * FROM uzytkownicy ORDER BY id');
        res.json(result.rows);
    }catch (err){
        console.error(err.message);
        res.status(500).send('Błąd servera');
    }
});
router.get('/uzytkownicy/:id', async (req, res) =>{
    try{
    const { id } = req.params;
    const idNum = parseInt(id, 10);
    if(isNaN(idNum)){
        return res.status(400).json({error: 'Parametr id musi być liczbą całkowitą'})
    }
    const result = await pool.query('SELECT * FROM uzytkownicy where id = $1', [idNum])
    if (result.rows.length === 0){
        return res.status(404).json({ message: 'Dany element nie istnieje'})
    }
    res.json(result.rows[0]);

    }catch (err){
        console.error(err.message);
        res.status(500).send('Błąd servera');
    }
});

router.get('/uzytkownicy/:id/:idt',async (req, res) =>{
    try{
    const { id, idt  } = req.params;
     const idNum = parseInt(id, 10);
    const idtNum = parseInt(idt, 10);
     if(isNaN(idNum) || isNaN(idtNum)){
            return res.status(400).json({error: 'Parametr id lub idt musi być liczbą całkowitą'})
    }
    const result = await pool.query('SELECT * FROM uzytkownicy WHERE id >= $1 AND id <= $2',[idNum,idtNum])
    if (result.rows.length === 0){
        return res.status(404).json({ message: 'W tym przedziale nie ma elementów'})
    }
    res.json(result.rows);
    }catch (err){
        console.error(err.message);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});
router.post('/uzytkownicy', async (req, res) => {
    try{
        const {rola,login ,haslo} = req.body
        const result = await pool.query(
            'INSERT INTO uzytkownicy (rola , login , haslo) VALUES($1,$2,$3) RETURNING *',
            [
                rola || null,
                login || null,
                haslo || null
            ]
        );
        res.status(201).json(result.rows[0]);
    }catch (err){
        console.error(err.message);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});
router.put('/uzytkownicy/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const idNum = parseInt(id, 10);
        if (isNaN(idNum)) {
            return res.status(400).json({ error: 'Parametr id musi być liczbą całkowitą' });
        }
        const { rola, login, haslo } = req.body;
        const check = await pool.query('SELECT * FROM uzytkownicy where id = $1', [idNum]);
        if (check.rows.length === 0) {
            return res.status(404).json({ message: 'Nie znaleziono rekordu' });
        }
        const existing = check.rows[0];
        const newRola = rola != null ? rola : existing.rola;
        const newLogin = login != null ? login : existing.login;
        const newHaslo = haslo != null ? haslo : existing.haslo;
        const result = await pool.query(
          'UPDATE uzytkownicy SET rola = $1, login = $2, haslo = $3 WHERE id = $4 RETURNING *',
          [
              newRola,
              newLogin,
              newHaslo,
              idNum,
          ]
        );
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: 'Błąd serwera' });
    }
});
router.delete('/uzytkownicy/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const idNum = parseInt(id, 10);
        if (isNaN(idNum)) {
            return res.status(400).json({ error: 'Parametr id musi być liczbą całkowitą' });
        }
        const check = await pool.query('SELECT * FROM uzytkownicy where id = $1', [idNum]);
        if (check.rows.length === 0) {
            return res.status(404).json({ message: 'Nie znaleziono rekordu' });
        }
        await pool.query('DELETE FROM uzytkownicy WHERE id = $1', [idNum]);
        res.json({ message: 'Usunięcie rekordu się udało' });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: 'Błąd serwera' });
    }

});
module.exports = router;
