

/**
 * @typedef {Object} Slot
 * @property {number} id - id_slot
 * @property {string} dayOfWeek - dzień tygodnia
 * @property {string} startTime - godzina rozpoczęcia
 * @property {string} endTime - godzina zakończenia
 */

/**
 * @typedef {Object} Room
 * @property {number} id - id_sale
 * @property {string} name - nazwa sali
 */

/**
 * Pojedyncze zajęcia do zaplanowania (z bazy)
 * @typedef {Object} ZajeciaInput
 * @property {number} id - idzajecia
 * @property {number} przedmiot_id - id przedmiotu
 * @property {number} wykladowca_id - id prowadzącego (z przedmiotu)
 * @property {number} grupa_id - id grupy dziekańskiej (z zajecia_grupy)
 * @property {string} typ - typ zajęć (np. "wykład")
 * @property {string} czas - czas trwania (TIME) – na razie ignorujemy
 */

/**
 * Główne dane wejściowe dla solvera (wersja z zajęciami)
 * @typedef {Object} SchedulerInput
 * @property {ZajeciaInput[]} zajecia - lista wszystkich zajęć do zaplanowania
 * @property {Slot[]} slots - lista dostępnych slotów
 * @property {Room[]} rooms - lista sal
 * @property {Object.<number, Object.<number, boolean>>} availability - dostępność: [wykladowca_id][slot_id] -> boolean (false = niedostępny)
 * @property {Object.<number, Object.<number, number>>} preferences - kary: [wykladowca_id][slot_id] -> liczba (im wyższa tym gorszy slot)
 * @property {number} [maxTimeSeconds] - maksymalny czas rozwiązania (opcjonalnie)
 */

/**
 * Pojedynczy wpis w planie (do zapisu w Plan_zajec)
 * @typedef {Object} PlanEntry
 * @property {number} zajecia_id - idzajecia
 * @property {number} sala_id - id_sale
 * @property {number} slot_id - id_slot
 * @property {string} day_of_week - dzień tygodnia (dla czytelności)
 * @property {string} time_day - godzina startu (dla czytelności)
 */

/**
 * Zawartość raportu (JSON)
 * @typedef {Object} ReportContent
 * @property {string} status - status rozwiązania (OPTIMAL, FEASIBLE, INFEASIBLE, UNKNOWN)
 * @property {number} totalZajecia - liczba wszystkich zajęć
 * @property {number} plannedEntries - liczba zaplanowanych (powinna równać się totalZajecia)
 * @property {number} objectiveValue - wartość funkcji celu (suma kar)
 * @property {number} solveTimeSeconds - czas rozwiązania (jeśli dostępny)
 */

/**
 * Wynik solvera
 * @typedef {Object} SchedulerOutput
 * @property {string} status - status rozwiązania
 * @property {PlanEntry[]} planEntries - lista zaplanowanych przypisań
 * @property {Object} report
 * @property {string} report.zawartosc - JSON.stringify(ReportContent)
 */
