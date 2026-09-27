// routes/plan.js
const express = require('express');
const pool = require('../db.js');
const ExcelJS = require('exceljs');
const router = express.Router();
const scheduler = require('../common/scheduler');

// PostgreSQL zwraca kolumnę JSONB jako obiekt, a starsze schematy mogą
// zwracać tekst. Obsługujemy oba warianty przy odczycie zapisanych planów.
const parseReportContent = (value) => {
  if (value && typeof value === 'object') return value;
  return JSON.parse(value);
};

const toSafeInteger = (value) => {
  if (value == null) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
};

const getPlanEntryZajeciaId = (entry) => {
  if (!entry || typeof entry !== 'object') return null;

  const parseCandidate = (value) => {
    if (value == null) return null;
    if (typeof value === 'number') return toSafeInteger(value);
    if (typeof value === 'string') {
      const direct = toSafeInteger(value);
      if (direct != null) return direct;
      const firstPart = value.split('-')[0];
      return toSafeInteger(firstPart);
    }
    return null;
  };

  const candidates = [entry.courseId, entry.sourceId, entry.id, entry.zajecia_id, entry.idzajecia];
  for (const candidate of candidates) {
    const safeValue = parseCandidate(candidate);
    if (safeValue != null) return safeValue;
  }
  return null;
};

const normalizeText = (value) => {
  if (value == null) return '';
  return String(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
};

const matchesLecturerEntry = (entry, lecturerId, lecturerName, lecturerSurname) => {
  if (!entry || typeof entry !== 'object') return false;

  const idFields = [entry.lecturerId, entry.wykladowca_id, entry.lecturer_id, entry.idwykladowca];
  for (const field of idFields) {
    const idValue = toSafeInteger(field);
    if (idValue != null && idValue === lecturerId) return true;
  }

  const lecturerText = String(entry.lecturer || entry.lektor || entry.instructor || '')
    .trim();
  if (!lecturerText) return false;

  const normalizedLecturer = normalizeText(lecturerText);
  if (lecturerName && normalizedLecturer === lecturerName) return true;
  if (lecturerSurname && normalizedLecturer.includes(lecturerSurname)) return true;

  return false;
};

router.get('/last', async (req, res) => {
  try {
    // Pobierz zawartość ostatniego raportu z ostatniego wygenerowanego planu.
    const lastReportRes = await pool.query(
      `SELECT r.zawartosc, p.id_plan, p.selected_semesters, p.study_mode, p.data_utworzenia, p.opis
       FROM raport r
       JOIN plan p ON r.plan_id_fk = p.id_plan
       ORDER BY p.data_utworzenia DESC
       LIMIT 1`
    );

    if (lastReportRes.rows.length === 0) {
      return res.status(404).json({ error: 'Brak zapisanych planów' });
    }

    const row = lastReportRes.rows[0];
    const reportContent = parseReportContent(row.zawartosc);
    if (!reportContent || !reportContent.results || Object.keys(reportContent.results).length === 0) {
      return res.status(404).json({ error: 'Ostatni wygenerowany plan nie zawierał żadnych zajęć lub miał nieprawidłową strukturę.' });
    }

    res.json({
      results: reportContent.results,
      metadata: {
        id_plan: row.id_plan,
        selected_semesters: row.selected_semesters || [],
        study_mode: row.study_mode || 'STAC',
        data_utworzenia: row.data_utworzenia,
        opis: row.opis,
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd pobierania ostatniego planu' });
  }
});

router.get('/student/:studentId', async (req, res) => {
  const { studentId } = req.params;
  const idNum = parseInt(studentId, 10);
  const requestedPlanId = toSafeInteger(req.query.planId);
  const requestedPlanKey = typeof req.query.planKey === 'string' ? req.query.planKey : null;
  if (isNaN(idNum)) {
      return res.status(400).json({ error: 'Nieprawidłowy ID studenta' });
  }

  try {
      // 1. Get the latest plan ID
      const lastPlanRes = requestedPlanId
        ? { rows: [{ id_plan: requestedPlanId }] }
        : await pool.query('SELECT id_plan FROM plan ORDER BY data_utworzenia DESC LIMIT 1');
      if (lastPlanRes.rows.length === 0) {
          return res.status(404).json({ error: 'Brak zapisanych planów' });
      }
      const planId = lastPlanRes.rows[0].id_plan;

      // 2. Get all zajecia_id for the student
      let studentGroupsRes = await pool.query('SELECT zajecia_id FROM grupa WHERE student_id = $1', [idNum]);
      if (studentGroupsRes.rows.length === 0) {
          const userAsStudentRes = await pool.query('SELECT idstudent FROM student WHERE uzytkownicy_id = $1 LIMIT 1', [idNum]);
          if (userAsStudentRes.rows.length > 0) {
              const studentId = userAsStudentRes.rows[0].idstudent;
              studentGroupsRes = await pool.query('SELECT zajecia_id FROM grupa WHERE student_id = $1', [studentId]);
          }
      }
      if (studentGroupsRes.rows.length === 0) {
          return res.json({ results: {} }); // Student is not in any group, return empty plan
      }
      const studentZajeciaIds = new Set(studentGroupsRes.rows.map(r => r.zajecia_id));

      // 3. Get the structured report for the latest plan
      const reportRes = await pool.query('SELECT zawartosc FROM raport WHERE plan_id_fk = $1', [planId]);
      if (reportRes.rows.length === 0 || !reportRes.rows[0].zawartosc) {
          return res.status(404).json({ error: 'Nie znaleziono raportu dla ostatniego planu.' });
      }

      const reportContent = parseReportContent(reportRes.rows[0].zawartosc);
      if (!reportContent || !reportContent.results) {
          return res.json({ results: {} });
      }

      const resultsToFilter = requestedPlanKey
        ? { [requestedPlanKey]: reportContent.results[requestedPlanKey] }
        : reportContent.results;

      // 4. Filter the plan entries for the student
      const studentPlanResults = {};
        for (const key in resultsToFilter) {
          const planData = resultsToFilter[key];
          const planEntries = Array.isArray(planData?.plan)
              ? planData.plan
              : Array.isArray(planData)
                ? planData
                : [];

          const studentSpecificPlan = planEntries.filter((zajecia) => {
              const entryId = getPlanEntryZajeciaId(zajecia);
              return entryId != null && studentZajeciaIds.has(entryId);
          });

          if (studentSpecificPlan.length > 0) {
              studentPlanResults[key] = { ...planData, plan: studentSpecificPlan };
          }
      }
      res.json({ results: studentPlanResults });
  } catch (err) {
      console.error('Błąd pobierania planu studenta:', err);
      res.status(500).json({ error: 'Błąd serwera podczas pobierania planu studenta' });
  }
});

const getLecturerPlanFromReport = (reportContent, lecturerId, lecturerNameNormalized, lecturerSurnameNormalized) => {
  if (!reportContent || !reportContent.results) return null;

  const lecturerResults = {};

  for (const key in reportContent.results) {
    const planData = reportContent.results[key];
    const planEntries = Array.isArray(planData)
      ? planData
      : Array.isArray(planData?.plan)
        ? planData.plan
        : [];

    const lecturerSpecific = planEntries.filter((entry) =>
      matchesLecturerEntry(entry, lecturerId, lecturerNameNormalized, lecturerSurnameNormalized)
    );

    if (lecturerSpecific.length > 0) {
      lecturerResults[key] = Array.isArray(planData)
        ? lecturerSpecific
        : { ...planData, plan: lecturerSpecific };
    }
  }

  return Object.keys(lecturerResults).length > 0 ? lecturerResults : null;
};

const getLecturerFullName = (row) => {
  if (!row) return null;
  const names = [row.imie, row.nazwisko].filter(Boolean).map((value) => String(value).trim());
  return names.length > 0 ? names.join(' ') : null;
};

const buildLecturerStructuredPlan = (rows) => rows.map((r) => ({
  day: r.day_of_week,
  time: `${r.time_day?.slice(0, 5)} - ${r.end_time_day?.slice(0, 5)}`,
  name: r.przedmiot || 'Zajęcia',
  type: r.typ,
  group: r.grupa_nazwa || r.grupa || null,
  room: r.sala_id ? `Sala ${r.sala_id}` : null,
  roomId: r.sala_id,
  courseId: r.zajecia_id,
}));

const getLecturerPlanResult = async (lecturerId, requestedPlanId = null, requestedPlanKey = null) => {
  const lastPlanRes = requestedPlanId
    ? { rows: [{ id_plan: requestedPlanId }] }
    : await pool.query('SELECT id_plan FROM plan ORDER BY data_utworzenia DESC LIMIT 1');
  if (lastPlanRes.rows.length === 0) return { error: 'Brak zapisanych planów', status: 404 };
  const planId = lastPlanRes.rows[0].id_plan;

  const [reportRes, lecturerRes] = await Promise.all([
    pool.query('SELECT zawartosc FROM raport WHERE plan_id_fk = $1', [planId]),
    pool.query('SELECT imie, nazwisko FROM wykladowca WHERE idwykladowca = $1 LIMIT 1', [lecturerId]),
  ]);

  const lecturerName = getLecturerFullName(lecturerRes.rows[0]);
  const lecturerNameNormalized = normalizeText(lecturerName);
  const lecturerSurnameNormalized = lecturerName ? normalizeText(lecturerName.split(' ').slice(-1)[0]) : null;

  if (reportRes.rows.length > 0 && reportRes.rows[0].zawartosc) {
    const reportContent = parseReportContent(reportRes.rows[0].zawartosc);
    const reportToFilter = requestedPlanKey
      ? { results: { [requestedPlanKey]: reportContent.results?.[requestedPlanKey] } }
      : reportContent;
    const reportPlan = getLecturerPlanFromReport(reportToFilter, lecturerId, lecturerNameNormalized, lecturerSurnameNormalized);
    if (reportPlan) return { results: reportPlan };
  }

  const fallbackPlan = await getFallbackLecturerPlan(planId, lecturerId);
  if (fallbackPlan) return fallbackPlan;

  return { results: {} };
};

const getFallbackLecturerPlan = async (planId, lecturerId) => {
  const structured = await pool.query(
    `SELECT pz.plan_id, pz.sala_id, pz.zajecia_id, pz.day_of_week,
            pz.start_time AS time_day, pz.end_time AS end_time_day,
            pr.nazwa AS przedmiot, pr.semestr, pr.tryb, z.typ,
            COALESCE(z.wykladowca_id, pr.wykladowca_id) AS wykładowca_id,
            COALESCE(gd.nazwa, z.grupa) AS grupa_nazwa
     FROM plan_zajec pz
     JOIN zajecia z ON pz.zajecia_id = z.idzajecia
     LEFT JOIN przedmiot pr ON z.przedmiot_id = pr.idprzedmiotu
     LEFT JOIN zajecia_grupy zg ON z.idzajecia = zg.zajecia_id
     LEFT JOIN grupy_dziekanskie gd ON zg.grupa_id = gd.id_grupy
     WHERE pz.plan_id = $1
       AND COALESCE(z.wykladowca_id, pr.wykladowca_id) = $2
     ORDER BY pz.day_of_week, pz.start_time`,
    [planId, lecturerId]
  );

  if (structured.rows.length === 0) return null;
  return {
    results: {
      [`lecturer_${lecturerId}`]: {
        plan: buildLecturerStructuredPlan(structured.rows),
        stats: {},
        activeDays: [],
        unscheduled: [],
        columnWidths: {},
      },
    },
  };
};

router.get('/lecturer/:lecturerId', async (req, res) => {
  const { lecturerId } = req.params;
  const idNum = parseInt(lecturerId, 10);
  if (isNaN(idNum)) return res.status(400).json({ error: 'Nieprawidłowy ID wykładowcy' });

  try {
    const result = await getLecturerPlanResult(idNum, toSafeInteger(req.query.planId), typeof req.query.planKey === 'string' ? req.query.planKey : null);
    if (result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json(result);
  } catch (err) {
    console.error('Błąd pobierania planu wykładowcy:', err);
    res.status(500).json({ error: 'Błąd serwera podczas pobierania planu wykładowcy' });
  }
});

router.get('/list', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id_plan, p.data_utworzenia, p.opis, r.zawartosc
       FROM plan p
       JOIN raport r ON p.id_plan = r.plan_id_fk
       ORDER BY data_utworzenia DESC`
    );

    if (result.rows.length === 0) {
      return res.json([]);
    }

    const availablePlans = [];
    result.rows.forEach(row => {
      const reportContent = parseReportContent(row.zawartosc);
      if (!reportContent || !reportContent.results) {
        return;
      }

      const planDate = new Date(row.data_utworzenia).toLocaleString('pl-PL');

      Object.keys(reportContent.results).forEach(planKey => {
        let label;

        const parts = planKey.split('|');
        if (parts.length === 3) {
            const [sem, spec, mode] = parts;
            if (spec === 'Ogólne') {
                label = `Semestr ${sem} (${mode})`;
            } else {
                label = `Semestr ${sem} / ${spec} (${mode})`;
            }
        } else {
            label = planKey;
        }
        
        availablePlans.push({
          value: `${row.id_plan}|${planKey}`,
          label: `${label} - wygenerowano ${planDate}`,
          planId: row.id_plan,
          planKey: planKey,
          date: row.data_utworzenia,
        });
      });
    });

    res.json(availablePlans);
  } catch (err) {
    console.error('Błąd pobierania listy planów:', err);
    res.status(500).json({ error: 'Błąd serwera podczas pobierania listy planów' });
  }
});

router.get('/structured/:id', async (req, res) => {
  try {
    const planId = parseInt(req.params.id, 10);
    const requestedPlanKey = typeof req.query.planKey === 'string' ? req.query.planKey : null;
    if (isNaN(planId)) {
      return res.status(400).json({ error: 'Nieprawidłowy ID planu' });
    }

    const reportRes = await pool.query(
      `SELECT zawartosc FROM raport WHERE plan_id_fk = $1`,
      [planId]
    );

    if (reportRes.rows.length > 0 && reportRes.rows[0].zawartosc) {
      const reportContent = parseReportContent(reportRes.rows[0].zawartosc);
      if (reportContent.results) {
        if (requestedPlanKey) {
          if (!Object.prototype.hasOwnProperty.call(reportContent.results, requestedPlanKey)) {
            return res.status(404).json({ error: 'Nie znaleziono wybranego wariantu planu' });
          }
          return res.json({ [requestedPlanKey]: reportContent.results[requestedPlanKey] });
        }
        return res.json(reportContent.results);
      }
      return res.json(reportContent);
    }

    // Fallback: jeśli nie ma raportu, zbuduj płaski plan jak poprzednio
    const result = await pool.query(
      `SELECT
         pz.plan_id, pz.sala_id, pz.zajecia_id, pz.day_of_week,
         pz.start_time AS time_day, pz.end_time AS end_time_day,
         pr.nazwa AS przedmiot, pr.semestr, pr.tryb, z.typ,
         gd.nazwa AS grupa_nazwa
       FROM plan_zajec pz
       JOIN zajecia z ON pz.zajecia_id = z.idzajecia
       JOIN przedmiot pr ON z.przedmiot_id = pr.idprzedmiotu
       LEFT JOIN zajecia_grupy zg ON z.idzajecia = zg.zajecia_id
       LEFT JOIN grupy_dziekanskie gd ON zg.grupa_id = gd.id_grupy
       WHERE pz.plan_id = $1
       ORDER BY pz.day_of_week, pz.start_time`,
      [planId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plan o podanym ID nie istnieje lub jest pusty' });
    }
    res.json({ 'plan': { plan: result.rows } });
  } catch (err) {
    console.error('Błąd pobierania planu strukturalnego:', err);
    res.status(500).json({ error: 'Błąd serwera podczas pobierania planu' });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const startTime = process.hrtime();
    const result = await scheduler.generateAndSavePlan(req.body, pool);
    const endTime = process.hrtime(startTime);
    const generationTimeMs = (endTime[0] * 1000) + (endTime[1] / 1000000);

    // Dodaj czas generowania do statystyk każdego wariantu planu
    Object.values(result).forEach(planVariant => {
      if (planVariant.stats) {
        planVariant.stats.generationTimeMs = generationTimeMs;
      }
    });

    res.json(result);
  } catch (error) {
    console.error('Błąd generowania planu:', error);
    if (error.isUserInputError) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Błąd serwera podczas generowania planu' });
    }
  }
});

router.get('/options', async (req, res) => {
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
            ...allSpecsRes.rows.map(r => normalizeSpecializationName(r.specjalnosc)),
            'CTS+ISP',
            'CTS+IOSI+ISP',
            'CTS+IOSI',
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
                [...group.specializations].sort().forEach(spec => semesterOptions.push({ label: `Semestr ${group.semestr} / ${spec} (${group.tryb})`, value: `${group.semestr}|${group.tryb}|${spec}` }));
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
        // Widok planu użyje tego do zbudowania siatki godzinowej.
        for (let hour = 8; hour <= 21; hour++) {
            timeLabels.push(`${String(hour).padStart(2, '0')}:00`);
        }

        const lecturersRes = await pool.query("SELECT idwykladowca AS id, imie, nazwisko, tytul_naukowy FROM wykladowca ORDER BY nazwisko, imie");
        const lecturerOptions = lecturersRes.rows.map(l => ({
            value: l.id,
            label: `${l.tytul_naukowy || ''} ${l.imie || ''} ${l.nazwisko || ''}`.trim().replace(/,$/, '') || `Wykładowca ${l.id}`,
            imie: l.imie || '',
            nazwisko: l.nazwisko || '',
        }));
 
        const roomsRes = await pool.query("SELECT id_sala AS id, nazwa, budynek FROM sala ORDER BY nazwa");
        const roomOptions = roomsRes.rows.map(r => ({ value: r.id, label: r.nazwa ? `${r.nazwa} (${r.budynek || 'N/A'})` : `Sala ${r.id}` }));
 
        res.json({ semesterOptions, lecturerOptions, roomOptions, subjectOptions, timeLabels });
 
    } catch (err) {
        console.error('Błąd pobierania opcji dla planisty:', err.message);
        res.status(500).json({ error: 'Błąd serwera podczas pobierania opcji dla planisty' });
    }
});

router.get('/wykladowca/by-user/:userId', async (req, res) => {
    const { userId } = req.params;
    const idNum = parseInt(userId, 10);
    if (isNaN(idNum)) {
        return res.status(400).json({ error: 'Nieprawidłowy ID użytkownika' });
    }
    const client = await pool.connect();
    try {
        // First, try to get the lecturer profile directly. This is the most common case.
        let lecturerProfile = await client.query(
            'SELECT * FROM wykladowca WHERE Uzytkownicy_id = $1',
            [idNum]
        );

        if (lecturerProfile.rows.length > 0) {
            return res.json(lecturerProfile.rows[0]);
        }

        // If profile is not found, check the user account.
        const userAccount = await client.query(
            "SELECT id, lower(rola) as rola FROM uzytkownicy WHERE id = $1",
            [idNum]
        );

        // If no user account exists, we cannot proceed.
        if (userAccount.rows.length === 0) {
            return res.status(404).json({ message: 'Nie znaleziono konta użytkownika dla podanego ID.' });
        }

        // --- Self-healing logic ---
        await client.query('BEGIN');

        if (userAccount.rows[0].rola !== 'wykladowca') {
            await client.query("UPDATE uzytkownicy SET rola = 'wykladowca' WHERE id = $1", [idNum]);
        }
        // Sprawdź, czy profil już istnieje, aby uniknąć błędu z ON CONFLICT, jeśli brakuje ograniczenia UNIQUE
        const existingProfile = await client.query('SELECT 1 FROM wykladowca WHERE uzytkownicy_id = $1', [idNum]);
        if (existingProfile.rows.length === 0) {
            // Jeśli profil nie istnieje, wstaw go
            await client.query(
                'INSERT INTO wykladowca (uzytkownicy_id, imie, nazwisko, tytul_naukowy) VALUES ($1, NULL, NULL, NULL)',
                [idNum]
            );
        }
        await client.query('COMMIT');

        const finalProfile = await client.query('SELECT * FROM wykladowca WHERE Uzytkownicy_id = $1', [idNum]);
        if (finalProfile.rows.length > 0) return res.json(finalProfile.rows[0]);

        throw new Error('Nie udało się utworzyć profilu wykładowcy po próbie naprawy danych.');
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {}); // Rollback on any error
        console.error('Błąd pobierania lub naprawy profilu wykładowcy:', err);
        res.status(500).json({ error: 'Błąd serwera podczas pobierania profilu wykładowcy.', details: err.message });
    } finally {
        client.release();
    }
});
router.get('/wykladowca/:id/availability', async (req, res) => {
    const { id } = req.params;
    const { rok_akademicki, semestr_numer, tryb_studiow, specjalnosc } = req.query;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
        return res.status(400).json({ error: 'Nieprawidłowy ID wykładowcy' });
    }

    const safeParse = (json) => {
        if (!json) return {};
        if (typeof json === 'object') return json; // It's already an object
        try {
            return JSON.parse(json);
        } catch (e) {
            console.error('Błąd parsowania JSON z dostępnością:', json, e);
            return {};
        }
    };
    try {
        if (rok_akademicki && semestr_numer && tryb_studiow) {
            const spec = String(specjalnosc || '').trim();
            // Pobierz dla konkretnego semestru (dla widoku wykładowcy)
            const approvedRes = await pool.query(
                'SELECT availability FROM wykladowca_availability WHERE wykladowca_id = $1 AND rok_akademicki = $2 AND semestr_numer = $3 AND tryb_studiow = $4 AND specjalnosc = $5',
                [idNum, rok_akademicki, semestr_numer, tryb_studiow, spec]
            );
            const proposedRes = await pool.query(
                'SELECT availability, submitted_at FROM wykladowca_availability_proposed WHERE wykladowca_id = $1 AND rok_akademicki = $2 AND semestr_numer = $3 AND tryb_studiow = $4 AND specjalnosc = $5',
                [idNum, rok_akademicki, semestr_numer, tryb_studiow, spec]
            );

            return res.json({
                approved: approvedRes.rows.length > 0 ? safeParse(approvedRes.rows[0].availability) : {},
                proposed: proposedRes.rows.length > 0 ? {
                    availability: safeParse(proposedRes.rows[0].availability),
                    submitted_at: proposedRes.rows[0].submitted_at,
                } : null,
            });
        } else {
            // Pobierz wszystkie dla danego wykładowcy (dla widoku planisty)
            const approvedRes = await pool.query(
                'SELECT rok_akademicki, semestr_numer, tryb_studiow, specjalnosc, availability FROM wykladowca_availability WHERE wykladowca_id = $1',
                [idNum]
            );
            const proposedRes = await pool.query(
                'SELECT rok_akademicki, semestr_numer, tryb_studiow, specjalnosc, availability, submitted_at FROM wykladowca_availability_proposed WHERE wykladowca_id = $1',
                [idNum]
            );

            const allAvailabilities = {};

            const normalizeAcademicYear = (value) => {
                if (value == null) return '';
                const normalized = String(value).trim().replace(/\/{2,}/g, '/');
                const match = normalized.match(/^(\d{4})\/+(.+)$/);
                if (!match) return normalized;

                const startYear = Number(match[1]);
                const tail = String(match[2]).replace(/[^\d]/g, '');

                if (!Number.isFinite(startYear) || !tail) return normalized;

                if (tail.length <= 2) {
                    return `${startYear}/${startYear + 1}`;
                }

                const secondYear = Number(tail.slice(0, 4));
                if (Number.isFinite(secondYear) && secondYear >= startYear && secondYear <= startYear + 10) {
                    return `${startYear}/${startYear + 1}`;
                }

                return `${startYear}/${startYear + 1}`;
            };

            approvedRes.rows.forEach(row => {
                const normalizedYear = normalizeAcademicYear(row.rok_akademicki);
                const key = `${normalizedYear}|${row.semestr_numer}|${row.tryb_studiow}|${row.specjalnosc || ''}`;
                if (!allAvailabilities[key]) {
                    allAvailabilities[key] = { rok_akademicki: normalizedYear, semestr_numer: row.semestr_numer, tryb_studiow: row.tryb_studiow, specjalnosc: row.specjalnosc || null, approved: null, proposed: null };
                }
                allAvailabilities[key].approved = safeParse(row.availability);
            });

            proposedRes.rows.forEach(row => {
                const normalizedYear = normalizeAcademicYear(row.rok_akademicki);
                const key = `${normalizedYear}|${row.semestr_numer}|${row.tryb_studiow}|${row.specjalnosc || ''}`;
                if (!allAvailabilities[key]) {
                    allAvailabilities[key] = { rok_akademicki: normalizedYear, semestr_numer: row.semestr_numer, tryb_studiow: row.tryb_studiow, specjalnosc: row.specjalnosc || null, approved: {}, proposed: null };
                }
                allAvailabilities[key].proposed = {
                    availability: safeParse(row.availability),
                    submitted_at: row.submitted_at,
                };
            });

            // Uzupełnij o brakujące semestry z domyślnej siatki dla bieżącego roku akademickiego.
            const getCurrentAcademicYear = () => {
                const now = new Date();
                const year = now.getFullYear();
                const month = now.getMonth(); // 0-11
                if (month >= 9) return `${year}/${year + 1}`;
                return `${year - 1}/${year}`;
            };
            const currentYear = getCurrentAcademicYear();
            const defaultSemesters = [1, 2, 3, 4, 5, 6, 7, 8];
            const defaultModes = ['STAC', 'NSTAC'];

            const specRes = await pool.query("SELECT DISTINCT specjalnosc FROM przedmiot WHERE specjalnosc IS NOT NULL AND specjalnosc <> ''");
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
                ...specRes.rows.map(r => normalizeSpecializationName(r.specjalnosc)),
            ])];

            defaultModes.forEach(mode => {
                defaultSemesters.forEach(sem => {
                    const semStr = String(sem);
                    if (sem === 5 || sem === 6) {
                        const generalKey = `${currentYear}|${semStr}|${mode}|`;
                        if (!allAvailabilities[generalKey]) {
                            allAvailabilities[generalKey] = { rok_akademicki: currentYear, semestr_numer: semStr, tryb_studiow: mode, specjalnosc: null, approved: {}, proposed: null };
                        }
                        allSpecializations.forEach(spec => {
                            const specKey = `${currentYear}|${semStr}|${mode}|${spec}`;
                            if (!allAvailabilities[specKey]) {
                                allAvailabilities[specKey] = { rok_akademicki: currentYear, semestr_numer: semStr, tryb_studiow: mode, specjalnosc: spec, approved: {}, proposed: null };
                            }
                        });
                    } else {
                        const key = `${currentYear}|${semStr}|${mode}|`;
                        if (!allAvailabilities[key]) {
                            allAvailabilities[key] = { rok_akademicki: currentYear, semestr_numer: semStr, tryb_studiow: mode, specjalnosc: null, approved: {}, proposed: null };
                        }
                      if (sem === 1 && mode === 'STAC') {
                        const idsiKey = `${currentYear}|1|STAC|IDSI`;
                        if (!allAvailabilities[idsiKey]) {
                          allAvailabilities[idsiKey] = { rok_akademicki: currentYear, semestr_numer: '1', tryb_studiow: 'STAC', specjalnosc: 'IDSI', approved: {}, proposed: null };
                        }
                      }
                    }
                });
            });

            const finalAvailabilities = Object.values(allAvailabilities);
            res.json({ all: finalAvailabilities });
        }
    } catch (err) {
        console.error('Błąd pobierania dostępności wykładowcy:', err);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

router.put('/wykladowca/:id/availability', async (req, res) => {
    const { id } = req.params;
    const { availability, rok_akademicki, semestr_numer, tryb_studiow, specjalnosc } = req.body;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
        return res.status(400).json({ error: 'Nieprawidłowy ID wykładowcy' });
    }
    if (!rok_akademicki || !semestr_numer || !tryb_studiow) {
        return res.status(400).json({ error: 'Pola "rok_akademicki", "semestr_numer" i "tryb_studiow" są wymagane.' });
    }
    const spec = String(specjalnosc || '').trim();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Krok 1: Zatwierdź i zapisz dostępność w głównej tabeli
        await client.query(
            `INSERT INTO wykladowca_availability (wykladowca_id, rok_akademicki, semestr_numer, tryb_studiow, specjalnosc, availability)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (wykladowca_id, rok_akademicki, semestr_numer, tryb_studiow, specjalnosc) DO UPDATE
             SET availability = $6`,
            [idNum, rok_akademicki, semestr_numer, tryb_studiow, spec, JSON.stringify(availability || {})]
        );

        // Krok 2: Usuń propozycję, ponieważ została już rozpatrzona
        await client.query(
            'DELETE FROM wykladowca_availability_proposed WHERE wykladowca_id = $1 AND rok_akademicki = $2 AND semestr_numer = $3 AND tryb_studiow = $4 AND specjalnosc = $5',
            [idNum, rok_akademicki, semestr_numer, tryb_studiow, spec]
        );

        await client.query('COMMIT');
        res.status(200).json({ message: 'Dostępność zatwierdzona i zapisana pomyślnie.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Błąd zapisu dostępności wykładowcy:', err);
        res.status(500).json({ error: 'Błąd serwera' });
    } finally {
        client.release();
    }
});

router.post('/wykladowca/:id/propose-availability', async (req, res) => {
    const { id } = req.params;
    const { availability, rok_akademicki, semestr_numer, tryb_studiow, specjalnosc } = req.body;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
        return res.status(400).json({ error: 'Nieprawidłowy ID wykładowcy' });
    }
    if (!rok_akademicki || !semestr_numer || !tryb_studiow) {
        return res.status(400).json({ error: 'Pola "rok_akademicki", "semestr_numer" i "tryb_studiow" są wymagane.' });
    }
    const spec = String(specjalnosc || '').trim();

    try {
        await pool.query(
            `INSERT INTO wykladowca_availability_proposed (wykladowca_id, rok_akademicki, semestr_numer, tryb_studiow, specjalnosc, availability, submitted_at)
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
             ON CONFLICT (wykladowca_id, rok_akademicki, semestr_numer, tryb_studiow, specjalnosc) DO UPDATE
             SET availability = $6, submitted_at = CURRENT_TIMESTAMP`,
            [idNum, rok_akademicki, semestr_numer, tryb_studiow, spec, JSON.stringify(availability || {})]
        );
        res.status(200).json({ message: 'Propozycja dostępności została zapisana.' });
    } catch (err) {
        console.error('Błąd zapisu propozycji dostępności wykładowcy:', err);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

router.get('/export/:id', async (req, res) => {
  try {
    const planId = parseInt(req.params.id, 10);
    if (isNaN(planId)) {
      return res.status(400).json({ error: 'Nieprawidłowy ID planu' });
    }

    const result = await pool.query(
      `SELECT
         pz.plan_id,
         pz.sala_id,
         pz.zajecia_id,
         pz.day_of_week,
         pz.start_time AS time_day,
         pz.end_time AS end_time_day,
         pr.nazwa AS przedmiot,
         z.typ,
         gd.nazwa AS grupa_nazwa
       FROM plan_zajec pz
       JOIN zajecia z ON pz.zajecia_id = z.idzajecia
       JOIN przedmiot pr ON z.przedmiot_id = pr.idprzedmiotu
       LEFT JOIN zajecia_grupy zg ON z.idzajecia = zg.zajecia_id
       LEFT JOIN grupy_dziekanskie gd ON zg.grupa_id = gd.id_grupy
       WHERE pz.plan_id = $1
       ORDER BY pz.day_of_week, pz.start_time`,
      [planId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plan o podanym ID nie istnieje' });
    }

    const planEntries = result.rows;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Plan zajęć');

    const daysOrder = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek'];
    const dayMap = {
      'Poniedziałek': 'Poniedziałek',
      'Poniedzialek': 'Poniedziałek',
      'Wtorek': 'Wtorek',
      'Środa': 'Środa',
      'Sroda': 'Środa',
      'Czwartek': 'Czwartek',
      'Piątek': 'Piątek',
      'Piatek': 'Piątek'
    };

    const timetable = {};
    for (const entry of planEntries) {
      const day = dayMap[entry.day_of_week] || entry.day_of_week;
      const time = entry.time_day ? entry.time_day.slice(0, 5) : '';
      if (!day || !time) continue;
      if (!timetable[day]) timetable[day] = {};
      if (!timetable[day][time]) timetable[day][time] = [];
      timetable[day][time].push(entry);
    }

    const columns = [{ header: 'Godzina', key: 'time', width: 15 }];
    for (const day of daysOrder) {
      columns.push({ header: day, key: day, width: 35 });
    }
    worksheet.columns = columns;

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4A90D9' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 30;

    const allTimes = new Set();
    for (const day of Object.keys(timetable)) {
      for (const time of Object.keys(timetable[day])) {
        allTimes.add(time);
      }
    }
    const sortedTimes = Array.from(allTimes).sort();

    for (const time of sortedTimes) {
      const rowData = { time };
      for (const day of daysOrder) {
        const entries = timetable[day]?.[time] || [];
        if (entries.length > 0) {
          const content = entries.map(e => {
            let text = `${e.przedmiot || 'Zajęcia'}`;
            if (e.typ) text += ` (${e.typ})`;
            if (e.grupa_nazwa && e.grupa_nazwa !== 'Wszyscy') text += `\nGr. ${e.grupa_nazwa}`;
            if (e.sala_id) text += `\nSala: ${e.sala_id}`;
            return text;
          }).join('\n\n');
          rowData[day] = content;
        } else {
          rowData[day] = '';
        }
      }
      worksheet.addRow(rowData);
    }

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // pomiń nagłówek
      row.eachCell((cell) => {
        cell.alignment = {
          horizontal: 'left',
          vertical: 'top',
          wrapText: true
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
        };
      });
    });

    worksheet.eachRow((row) => {
      if (row.number === 1) return;
      let maxLines = 1;
      row.eachCell((cell) => {
        if (cell.value && typeof cell.value === 'string') {
          const lines = cell.value.split('\n').length;
          if (lines > maxLines) maxLines = lines;
        }
      });
      row.height = Math.max(20, maxLines * 18);
    });

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Disposition', `attachment; filename=plan_${planId}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (err) {
    console.error('Błąd eksportu do Excela:', err);
    res.status(500).json({ error: 'Błąd eksportu do Excela' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const planId = parseInt(req.params.id, 10);
    if (isNaN(planId)) {
      return res.status(400).json({ error: 'Nieprawidłowy ID planu' });
    }

    const result = await pool.query(
      `SELECT
         pz.plan_id,
         pz.sala_id,
         pz.zajecia_id,
         pz.day_of_week,
         pz.start_time AS time_day,
         pz.end_time AS end_time_day,
         pr.nazwa AS przedmiot,
         z.typ,
         gd.nazwa AS grupa_nazwa
       FROM plan_zajec pz
       JOIN zajecia z ON pz.zajecia_id = z.idzajecia
       JOIN przedmiot pr ON z.przedmiot_id = pr.idprzedmiotu
       LEFT JOIN zajecia_grupy zg ON z.idzajecia = zg.zajecia_id
       LEFT JOIN grupy_dziekanskie gd ON zg.grupa_id = gd.id_grupy
       WHERE pz.plan_id = $1
       ORDER BY pz.day_of_week, pz.start_time`,
      [planId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plan o podanym ID nie istnieje' });
    }

    res.json({ plan: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd pobierania planu' });
  }
});
module.exports = router;
