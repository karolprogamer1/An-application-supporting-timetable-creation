const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator')
const pool = require('../db');

router.get('/przedmiot', async (req, res) =>{
    try {
        const result = await pool.query('SELECT * FROM przedmiot ORDER BY idprzedmiotu');
        res.json(result.rows);
    }catch (err){
        console.error(err.message);
        res.status(500).send('Błąd servera');
    }
});
router.get('/przedmiot/:id', async (req, res) =>{
    try{
    const { id } = req.params;
    const idNum = parseInt(id, 10);
    if(isNaN(idNum)){
        return res.status(400).json({error: 'Parametr id musi być liczbą całkowitą'})
    }
    const result = await pool.query('SELECT * FROM przedmiot where idprzedmiotu = $1', [idNum])
    if (result.rows.length === 0){
        return res.status(404).json({ message: 'Dany element nie istnieje'})
    }
    res.json(result.rows[0]);

    }catch (err){
        console.error(err.message);
        res.status(500).send('Błąd servera');
    }
});

router.get('/przedmiot/:id/:idt',async (req, res) =>{
    try{
    const { id, idt  } = req.params;
    const idNum = parseInt(id, 10);
    const idtNum = parseInt(idt, 10);
     if(isNaN(idNum) || isNaN(idtNum)){
            return res.status(400).json({error: 'Parametry muszą być liczbami całkowitymi'})
        }
    const result = await pool.query('SELECT * FROM przedmiot where idprzedmiotu >= $1 and idprzedmiotu <= $2',[idNum,idtNum])
    if (result.rows.length === 0){
        return res.status(404).json({ message: 'W tym przedziale nie ma elementów'})
    }
    res.json(result.rows);
    }catch (err){
        console.error(err.message);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});
router.post('/przedmiot',  async (req, res) => {
    try{
        const {nazwa, ilosc_godz, semestr, tryb, wykladowca_id, specjalnosc, typ} = req.body
        const wyklId = wykladowca_id != null && wykladowca_id !== '' ? Number(wykladowca_id) : null

        if (!nazwa) {
            return res.status(400).json({ error: 'Nazwa przedmiotu jest wymagana' });
        }

        const result = await pool.query(
            'INSERT INTO przedmiot (nazwa, ilosc_godz, semestr, tryb, wykladowca_id, specjalnosc, typ) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
            [
                nazwa || null,
                ilosc_godz || null,
                semestr || null,
                tryb || null,
                wyklId,
                specjalnosc || null,
                typ || null,
            ]
        );
        res.status(201).json(result.rows[0]);
    }catch (err){
        console.error(err.message);
        if (err.constraint === 'fk_wykladowca') {
            return res.status(400).json({ error: 'Podany wykladowca nie istnieje' });
        }
        res.status(500).json({ error: 'Błąd serwera' });
    }
});
router.put('/przedmiot/:id', async (req,res) =>{
    try{
        const { id } = req.params;
        const idNum = parseInt(id, 10);
        if(isNaN(idNum)){
        return res.status(400).json({error: 'Parametr id musi być liczbą całkowitą'})
        }
        const {nazwa, ilosc_godz, semestr, tryb, wykladowca_id, specjalnosc, typ} = req.body;
        const wyklId = wykladowca_id != null && wykladowca_id !== '' ? Number(wykladowca_id) : null
        const check = await pool.query('SELECT * FROM przedmiot where idprzedmiotu= $1',[idNum]);
        if(check.rows.length === 0) {
            return res.status(404).json({message:'Nie znaleziono rekordu'})
        }

        const result = await pool.query(
                    'UPDATE przedmiot SET nazwa = $1, ilosc_godz = $2, semestr = $3, tryb = $4, wykladowca_id = $5, specjalnosc = $6, typ = $7 WHERE idprzedmiotu = $8 RETURNING *',
                    [
                            nazwa || null,
                            ilosc_godz || null,
                            semestr || null,
                            tryb || null,
                            wyklId,
                            specjalnosc || null,
                            typ || null,
                            idNum
                    ]
                );
        res.status(200).json(result.rows[0]);
        }catch(err){
            console.error(err.message);
            if (err.constraint === 'fk_wykladowca') {
            return res.status(400).json({ error: 'Podany wykladowca nie istnieje' });
            }
            return res.status(500).json({error: 'Błąd serwera'});
        }
});

router.delete('/przedmiot/:id',async (req,res) =>{
    const client = await pool.connect();
    try{
        const { id } = req.params;
        const idNum = parseInt(id, 10);
        if(isNaN(idNum)){
        return res.status(400).json({error: 'Parametr id musi być liczbą całkowitą'})
        }
        await client.query('BEGIN');
        const check = await client.query('SELECT * FROM przedmiot where idprzedmiotu = $1',[idNum]);
        if(check.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({message:'Nie znaleziono rekordu'})
        }
        await client.query('DELETE FROM zajecia WHERE przedmiot_id = $1',[idNum]);
        await client.query('DELETE FROM przedmiot WHERE idprzedmiotu = $1',[idNum]);
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
