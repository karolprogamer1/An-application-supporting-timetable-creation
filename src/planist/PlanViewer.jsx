import { useState, useMemo, useEffect } from 'react';
import '../App.css';

const parseTimeToMinutes = (timeString) => {
    if (!timeString) return null;
    const [hours, minutes] = timeString.split(':').map((part) => Number(part.trim()));
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return hours * 60 + minutes;
};

const formatMinutesToTime = (minutes) => {
    if (minutes == null || Number.isNaN(minutes)) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const stringToHslColor = (str, s = 60, l = 55) => {
    if (!str) return `hsl(208, 73%, 60%)`; // Kolor domyślny
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
        hash &= hash; // Konwersja do 32-bitowej liczby całkowitej
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, ${s}%, ${l}%)`;
};

// Komponent do renderowania siatki planu
const PlanGrid = ({ planData, studyMode, columnWidths = {}, activeDays = [] }) => {
    const days = useMemo(() => {
        if (activeDays && activeDays.length > 0) {
            return activeDays;
        }
        if (studyMode === 'NSTAC') {
            return ['Piątek', 'Sobota', 'Niedziela'];
        }
        return ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek'];
    }, [studyMode, activeDays]);

    const schedule = useMemo(() => {
        if (!planData || planData.length === 0) {
            return { timeSlots: [], cells: {}, covered: new Set() };
        }

        const events = planData.map((item) => {
            const [startTime = '', endTime = ''] = (item.time || '').split(' - ').map((value) => value.trim());
            const startMinutes = parseTimeToMinutes(startTime);
            const endMinutes = parseTimeToMinutes(endTime);
            const duration = (startMinutes != null && endMinutes != null && endMinutes > startMinutes)
                ? endMinutes - startMinutes
                : 60;
            return {
                ...item,
                startTime,
                endTime,
                startMinutes,
                endMinutes: endMinutes || (startMinutes != null ? startMinutes + duration : null),
                duration,
                rowSpan: Math.max(1, Math.ceil(duration / 15)),
            };
        }).filter((item) => item.day && item.startMinutes != null && item.endMinutes != null);

        if (events.length === 0) {
            return { timeSlots: [], cells: {}, covered: new Set() };
        }

        const minStart = Math.min(...events.map((item) => item.startMinutes));
        const maxEnd = Math.max(...events.map((item) => item.endMinutes));
        const alignedStart = Math.floor(minStart / 15) * 15;
        let alignedEnd = Math.ceil(maxEnd / 15) * 15;

        // Upewnij się, że siatka jest rysowana co najmniej do 21:00
        const minEndTime = 21 * 60;
        if (alignedEnd < minEndTime) {
            alignedEnd = minEndTime;
        }

        const timeSlots = [];
        for (let minute = alignedStart; minute < alignedEnd; minute += 15) {
            timeSlots.push(minute);
        }

        const cells = {};
        const covered = new Set();

        const eventsByDay = {};
        events.forEach((item) => {
            if (!eventsByDay[item.day]) eventsByDay[item.day] = [];
            eventsByDay[item.day].push(item);
        });

        Object.entries(eventsByDay).forEach(([day, dayEvents]) => {
            dayEvents.sort((a, b) => a.startMinutes - b.startMinutes);
            let parallelGroupStart = null;
            let parallelGroupEnd = null;
            let previousEnd = null;
            let segmentOriginalStart = null;

            dayEvents.forEach((item) => {
                const itemEnd = item.startMinutes + item.duration;
                const sameSegment = segmentOriginalStart != null && item.startMinutes < parallelGroupEnd;
                if (!sameSegment) {
                    segmentOriginalStart = item.startMinutes;
                    parallelGroupStart = item.startMinutes;
                    parallelGroupEnd = item.startMinutes + item.duration;
                } else {
                    parallelGroupEnd = Math.max(parallelGroupEnd, item.startMinutes + item.duration);
                }

                const key = `${day}|${parallelGroupStart}`;
                if (!cells[key]) cells[key] = [];
                cells[key].push(item);
                previousEnd = Math.max(previousEnd || 0, item.startMinutes + item.duration);
            });
        });

        Object.entries(cells).forEach(([key, cellEvents]) => {
            const [day, start] = key.split('|');
            const startMinutes = Number(start);
            const groupEnd = Math.max(...cellEvents.map((item) => item.startMinutes + item.duration));
            if (cellEvents.length > 1) {
                const sharedStart = Math.min(...cellEvents.map((item) => item.startMinutes));
                const sharedEnd = Math.max(...cellEvents.map((item) => item.startMinutes + item.duration));
                cellEvents.forEach((item) => {
                    item.startTime = formatMinutesToTime(sharedStart);
                    item.endTime = formatMinutesToTime(sharedEnd);
                });
            }
            for (let minute = startMinutes; minute < groupEnd; minute += 15) {
                covered.add(`${day}|${minute}`);
            }
        });

        return { timeSlots, cells, covered };
    }, [planData]);

    const { timeSlots } = schedule;
    const [slotHeight] = useState(32);

    if (!planData || planData.length === 0) {
        return <p style={{ marginTop: '1rem', fontWeight: 'bold' }}>Brak zaplanowanych zajęć dla tego semestru.</p>;
    }

    return (
        <>
            <div className="schedule-wrapper" style={{ '--slot-height': `${slotHeight}px` }}>
                <table className="schedule-table">
                    <thead>
                        <tr>
                            <th style={{ minWidth: '90px' }}>Godzina</th>
                            {days.map(day => <th key={day} style={columnWidths[day] === 'wide' ? { minWidth: '240px' } : {}}>{day}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {timeSlots.map((time) => (
                            <tr key={time}>
                                <td className="time-cell">{formatMinutesToTime(time)}</td>
                                {days.map((day) => {
                                    const eventKey = `${day}|${time}`;
                                    if (schedule.covered.has(eventKey) && !schedule.cells[eventKey]) {
                                        return null;
                                    }

                                    const eventsForCell = schedule.cells[eventKey] || [];
                                    const rowSpan = eventsForCell.length > 0
                                        ? Math.max(1, Math.ceil(Math.max(...eventsForCell.map((item) => item.startMinutes + item.duration - time)) / 15))
                                        : 1;

                                    return (
                                        <td key={day} className="plan-cell" rowSpan={rowSpan}>
                                            {eventsForCell.length > 0 ? (
                                                <div className="plan-cell-content" style={{ '--plan-columns': eventsForCell.length, gridTemplateColumns: `repeat(${eventsForCell.length}, minmax(0, 1fr))` }}>
                                                    {eventsForCell.map((event, index) => {
                                                        const blockStyle = {
                                                            height: `calc(${event.rowSpan} * var(--slot-height))`,
                                                            minHeight: `calc(${event.rowSpan} * var(--slot-height))`,
                                                            alignSelf: 'start',
                                                        };
                                                const periodKey = event.data_rozpoczecia ? `${event.data_rozpoczecia}|${event.data_zakonczenia}` : null;
                                                if (periodKey) {
                                                    // Dodaje kolorowy pasek po lewej stronie dla zajęć z tego samego okresu
                                                    blockStyle.borderLeft = `5px solid ${stringToHslColor(periodKey, 60, 55)}`;
                                                }

                                                        return (
                                                            <div key={index} className="plan-block plan-block--other" style={blockStyle}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                                                                    <div className="plan-block-title" title={event.fullName || event.name}>{event.name}</div>
                                                                    {event.group && event.group.toString().length > 0 ? <div className="group-badge">gr. {event.group}</div> : null}
                                                                </div>
                                                                <div className="time-label">{event.startTime} — {event.endTime}</div>
                                                                <div className="plan-block-details">
                                                                    {[event.type, event.specjalnosc, event.room, event.lecturer].filter(Boolean).join(' • ')}
                                                                </div>
                                                                {event.data_rozpoczecia && (
                                                                    <div style={{ marginTop: 'auto', paddingTop: '6px', fontSize: '0.78rem', opacity: 0.85, borderTop: '1px solid rgba(255,255,255,0.18)' }}>
                                                                        {new Date(event.data_rozpoczecia).toLocaleDateString()} — {new Date(event.data_zakonczenia).toLocaleDateString()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : null}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
};

function PlanViewer({ plansData }) {
    const normalizeStudyModeProp = (mode) => {
        const value = String(mode || '').trim().toUpperCase();
        if (value === 'NST' || value === 'NSTAC') return 'NSTAC';
        if (value === 'ST' || value === 'STAC') return 'STAC';
        return 'STAC';
    };

    const normalizePlanPayload = (payload) => {
        if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
            return {};
        }

        if (payload.results && typeof payload.results === 'object' && !Array.isArray(payload.results)) {
            return payload.results;
        }

        if (payload.plan && typeof payload.plan === 'object' && !Array.isArray(payload.plan) && Object.values(payload.plan).some((value) => value && typeof value === 'object' && Array.isArray(value?.plan))) {
            return payload.plan;
        }

        if (payload.plans && typeof payload.plans === 'object' && !Array.isArray(payload.plans)) {
            return payload.plans;
        }

        if (Object.values(payload).some((value) => value && typeof value === 'object' && !Array.isArray(value) && Array.isArray(value.plan))) {
            return payload;
        }

        if (payload.plan && Array.isArray(payload.plan)) {
            return { default: { plan: payload.plan, stats: payload.stats || null, label: payload.opis || 'Plan' } };
        }

        return {};
    };

    const storageKey = useMemo(() => {
        const planId = plansData?.metadata?.id_plan ?? 'default';
        return `planist:lastSelectedPlanVariant:${planId}`;
    }, [plansData?.metadata?.id_plan]);

    const [selectedVariant, setSelectedVariant] = useState(() => {
        if (typeof window === 'undefined') {
            return '';
        }

        try {
            return window.sessionStorage.getItem(storageKey) || '';
        } catch (error) {
            console.warn('Nie udało się odczytać wybranego wariantu planu.', error);
            return '';
        }
    });

    const normalizedPlans = useMemo(() => normalizePlanPayload(plansData), [plansData]);

    const variants = useMemo(() => {
        if (!normalizedPlans || Object.keys(normalizedPlans).length === 0) {
            return [];
        }

        return Object.entries(normalizedPlans).map(([key, value]) => {
            const [semesterRaw = 'all', specialization = 'Ogólne', studyMode = 'STAC'] = String(key).split('|');
            const semester = String(semesterRaw || '').trim();
            const label = `Semestr ${semester || 'all'}${specialization && specialization !== 'Ogólne' ? ` / ${specialization}` : ''} (${studyMode})`;
            return {
                key,
                label,
                plan: Array.isArray(value?.plan) ? value.plan : [],
                unscheduled: Array.isArray(value?.unscheduled) ? value.unscheduled : [],
                stats: value?.stats || null,
                columnWidths: value?.columnWidths || {},
                activeDays: value?.activeDays || [],
                studyMode: normalizeStudyModeProp(studyMode),
            };
        });
    }, [normalizedPlans]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        try {
            if (selectedVariant) {
                window.sessionStorage.setItem(storageKey, selectedVariant);
            } else {
                window.sessionStorage.removeItem(storageKey);
            }
        } catch (error) {
            console.warn('Nie udało się zapisać wybranego wariantu planu.', error);
        }
    }, [selectedVariant, storageKey]);

    useEffect(() => {
        if (!variants.length) {
            setSelectedVariant('');
            return;
        }

        if (selectedVariant && variants.some(v => v.key === selectedVariant)) {
            return;
        }

        const restoredVariant = typeof window !== 'undefined'
            ? window.sessionStorage.getItem(storageKey)
            : null;

        if (restoredVariant && variants.some(v => v.key === restoredVariant)) {
            setSelectedVariant(restoredVariant);
            return;
        }

        const firstVariantWithContent = variants.find(v => v.plan && v.plan.length > 0);
        if (firstVariantWithContent) {
            setSelectedVariant(firstVariantWithContent.key);
        } else {
            setSelectedVariant(variants[0].key);
        }
    }, [variants, selectedVariant, storageKey]);

    const currentVariant = variants.find((variant) => variant.key === selectedVariant) || null;

    if (variants.length === 0) {
        return <p>Brak danych planu do wyświetlenia.</p>;
    }

    return (
        <>
            {variants.length > 1 && (
                <div className="form-row" style={{ alignItems: 'center', marginTop: '1rem', gap: '12px', display: 'flex', flexWrap: 'wrap' }}>
                    <label htmlFor="plan-key-select" style={{ marginRight: '10px', fontWeight: 'bold' }}>Wariant:</label>
                    <select id="plan-key-select" value={selectedVariant} onChange={(event) => setSelectedVariant(event.target.value)}>
                        {variants.map((variant) => (
                            <option key={variant.key} value={variant.key}>{variant.label}</option>
                        ))}
                    </select>
                </div>
            )}

            {currentVariant?.stats && (
                <div className="stats-container">
                    <h4>Statystyki dla tego planu:</h4>
                    <p>Spełnienie ograniczeń twardych: <strong>{currentVariant.stats.hardOkPct}%</strong> ({currentVariant.stats.hard.ok} / {currentVariant.stats.hard.total})</p>
                    <p>Spełnienie ograniczeń miękkich: <strong>{currentVariant.stats.softOkPct}%</strong> ({currentVariant.stats.soft.ok} / {currentVariant.stats.soft.total})</p>
                    <p>Konflikty studentów: <strong>{currentVariant.stats.studentConflicts?.count || 0}</strong> (z {currentVariant.stats.studentConflicts?.totalStudents || 0} studentów)</p>
                    {currentVariant.stats.generationTimeMs != null && (
                        <p>Czas generowania: <strong>{(currentVariant.stats.generationTimeMs / 1000).toFixed(2)} s</strong></p>
                    )}
                </div>
            )}

            {currentVariant?.unscheduled?.length > 0 && (
                <div className="error-message" style={{ marginTop: '1rem', padding: '1rem' }}>
                    <strong>Nie udało się zaplanować {currentVariant.unscheduled.length} zajęć.</strong>
                    <ul style={{ marginTop: '0.75rem', paddingLeft: '1.25rem' }}>
                        {currentVariant.unscheduled.map((item, index) => (
                            <li key={item.id || `${item.name}-${index}`}>
                                {item.name || 'Zajęcia'}{item.lecturer ? ` — ${item.lecturer}` : ''}{item.group ? ` (gr. ${item.group})` : ''}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {currentVariant ? (
                <PlanGrid
                    planData={currentVariant.plan}
                    studyMode={currentVariant.studyMode}
                    columnWidths={currentVariant.columnWidths}
                    activeDays={currentVariant.activeDays}
                />
            ) : (
                <p>Wybierz wariant, aby zobaczyć plan.</p>
            )}
        </>
    );
}

export default PlanViewer;