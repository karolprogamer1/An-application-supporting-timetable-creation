const express = require('express');
const router = express.Router();
const pool = require('../db');
const scheduler = require('../common/scheduler');

router.post('/planista/generate', async (req, res) => {
  try {
    const startTime = process.hrtime();
    const results = await scheduler.generateAndSavePlan(req.body, pool);
    const endTime = process.hrtime(startTime);
    const generationTimeMs = (endTime[0] * 1000) + (endTime[1] / 1000000);

    const unscheduledCount = Object.values(results).reduce((acc, val) => acc + (val.unscheduled?.length || 0), 0);
    const scheduledCount = Object.values(results).reduce((acc, val) => acc + (val.plan?.length || 0), 0);

    res.json({
      results,
      statistics: {
        generationTimeMs,
        scheduledCount,
        unscheduledCount,
      },
    });
  } catch (err) {
    console.error(err);
    if (err.isUserInputError) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: 'Błąd serwera podczas generowania planu' });
    }
  }
});

router.get('/planista/options', async (req, res) => {
    const normalizeStudyModeValue = (value) => {
        const normalized = String(value || '').trim().toUpperCase();
        if (normalized === 'NST' || normalized === 'NSTAC') return 'NSTAC';
        return 'STAC';
    };

    const { getSemesterNumbers } = require('../common/utils');
    try {
        const subjectsPlainRes = await pool.query("SELECT idprzedmiotu AS id, nazwa, semestr, tryb, specjalnosc FROM przedmiot WHERE semestr IS NOT NULL AND semestr <> '' ORDER BY nazwa");
        const allSpecsRes = await pool.query("SELECT DISTINCT specjalnosc FROM przedmiot WHERE specjalnosc IS NOT NULL AND specjalnosc <> ''");
        const specializationAliases = {
            ASiSK: 'CTS',
            PBDiOU: 'IOSI',
            M3D: 'ISP',
            'ASiSK+M3D': 'CTS+ISP',
            'ASiSK+PBDiOU': 'CTS+IOSI',
            'ASiSK+PBDiOU+M3D': 'CTS+IOSI+ISP',
        };
        const normalizeSpecializationName = (value) => {
            if (!value) return '';
            const raw = String(value).trim();
            return raw
                .split('+')
                .map((part) => specializationAliases[part] || part)
                .join('+');
        };
        const allSpecializations = [...new Set([
            'IOSI', 'CTS', 'ISP',
            'CTS+ISP',
            'CTS+IOSI+ISP',
            'CTS+IOSI',
            ...allSpecsRes.rows.map(r => normalizeSpecializationName(r.specjalnosc)),
        ])];
 
        const subjectOptions = [];
        const semesterGroups = {};
 
        for (const s of subjectsPlainRes.rows) {
            const originalSemesters = getSemesterNumbers(s.semestr);
            const effectiveSemesters = originalSemesters;

            subjectOptions.push({
                value: s.id,
                label: s.nazwa,
                semestr: s.semestr,
                tryb: normalizeStudyModeValue(s.tryb),
                specjalnosc: s.specjalnosc,
            });

            const mode = normalizeStudyModeValue(s.tryb);

            for (const semestrValue of effectiveSemesters) {
                let spec = (s.specjalnosc || '').trim();
                const groupSemestrValue = String(semestrValue || '').trim();
                if (!groupSemestrValue) continue;

                // Specjalizacje są istotne tylko dla semestrów 5 i 6.
                // Dla pozostałych, traktujemy przedmioty ze specjalizacją jako ogólne.
                if (!['5', '6', '8'].includes(groupSemestrValue)) {
                    spec = '';
                }

                const key = `${groupSemestrValue}|${mode}`;
                if (!semesterGroups[key]) {
                    semesterGroups[key] = {
                        semestr: groupSemestrValue,
                        tryb: mode,
                        hasGeneralSubjects: false,
                        specializations: new Set(),
                    };
                }
                if (spec) {
                    semesterGroups[key].specializations.add(spec);
                } else {
                    semesterGroups[key].hasGeneralSubjects = true;
                }
            }
        }
 
        // Upewnij się, że wszystkie specjalności są dostępne jako opcje dla semestrów 5 i 6.
        for (const sem of ['5', '6', '8']) {
            for (const mode of ['STAC', 'NSTAC']) {
                const key = `${sem}|${mode}`;
                if (!semesterGroups[key]) {
                    semesterGroups[key] = {
                        semestr: sem,
                        tryb: mode,
                        hasGeneralSubjects: false,
                        specializations: new Set(),
                    };
                }
                allSpecializations.forEach(spec => semesterGroups[key].specializations.add(spec));
            }
        }

        // Upewnij się, że wszystkie semestry (1-8) istnieją jako opcje ogólne dla obu trybów.
        // To gwarantuje, że wykładowca zawsze może wybrać dowolny semestr, nawet jeśli nie ma jeszcze do niego przedmiotów.
        for (const sem of ['1', '2', '3', '4', '5', '6', '7', '8']) {
            for (const mode of ['STAC', 'NSTAC']) {
                const key = `${sem}|${mode}`;
                if (!semesterGroups[key]) {
                    semesterGroups[key] = {
                        semestr: sem,
                        tryb: mode,
                        hasGeneralSubjects: true, // Utwórz jako opcję ogólną
                        specializations: new Set(),
                    };
                } else if (semesterGroups[key].specializations.size === 0 && !semesterGroups[key].hasGeneralSubjects) {
                    // Jeśli grupa istnieje, ale jest pusta, oznacz ją do utworzenia jako ogólna
                    semesterGroups[key].hasGeneralSubjects = true;
                }
            }
        }

        const semesterOptions = [];
        Object.values(semesterGroups).forEach(group => {
            if (group.specializations.size > 0) {
                const sortedSpecs = [...group.specializations].sort((a, b) => {
                    const aIsCombined = a.includes('+');
                    const bIsCombined = b.includes('+');
                    if (aIsCombined && !bIsCombined) return 1;
                    if (!aIsCombined && bIsCombined) return -1;
                    return a.localeCompare(b);
                });

                sortedSpecs.forEach(spec => semesterOptions.push({ label: `Semestr ${group.semestr} / ${spec} (${group.tryb})`, value: `${group.semestr}|${group.tryb}|${spec}` }));
            }
            if (group.hasGeneralSubjects) {
                semesterOptions.push({ label: `Semestr ${group.semestr} (${group.tryb})`, value: `${group.semestr}|${group.tryb}|` });
            }
        });

        if (!semesterOptions.some(option => option.value === '1|STAC|IDSI')) {
            semesterOptions.push({ label: 'Semestr 1 (IDSI / STAC)', value: '1|STAC|IDSI' });
        }
 
        semesterOptions.sort((a, b) => a.label.localeCompare(b.label));

        const timeLabels = [];
        // Generuj etykiety godzinowe od 8:00 do 21:00.
        for (let hour = 8; hour <= 21; hour++) {
            timeLabels.push(`${String(hour).padStart(2, '0')}:00`);
        }
 
        const lecturersRes = await pool.query("SELECT idwykladowca AS id, imie, nazwisko, tytul_naukowy FROM wykladowca ORDER BY nazwisko, imie");
        const lecturerOptions = lecturersRes.rows.map(l => ({ value: l.id, label: `${l.tytul_naukowy || ''} ${l.imie} ${l.nazwisko}`.trim().replace(/,$/, '') }));
 
        const roomsRes = await pool.query("SELECT id_sala AS id, nazwa, budynek FROM sala ORDER BY nazwa");
        const roomOptions = roomsRes.rows.map(r => ({ value: r.id, label: r.nazwa ? `${r.nazwa} (${r.budynek || 'N/A'})` : `Sala ${r.id}` }));
 
        res.json({ semesterOptions, lecturerOptions, roomOptions, subjectOptions, timeLabels });
 
    } catch (err) {
        console.error('Błąd pobierania opcji dla planisty:', err.message);
        res.status(500).json({ error: 'Błąd serwera podczas pobierania opcji dla planisty' });
    }
});
module.exports = router;
