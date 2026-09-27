export function collectGuestPlanFilters(plansData) {
    if (!plansData || !plansData.results || typeof plansData.results !== 'object') {
        return {
            availableLecturers: ['all'],
            availableRooms: ['all'],
        };
    }

    const lecturerSet = new Set(['all']);
    const roomSet = new Set(['all']);

    Object.values(plansData.results).forEach((planData) => {
        if (!planData || !Array.isArray(planData.plan)) return;

        planData.plan.forEach((item) => {
            if (item && typeof item.lecturer === 'string' && item.lecturer.trim()) {
                lecturerSet.add(item.lecturer.trim());
            }
            if (item && typeof item.room === 'string' && item.room.trim()) {
                roomSet.add(item.room.trim());
            }
        });
    });

    return {
        availableLecturers: [...lecturerSet].sort((a, b) => {
            if (a === 'all') return -1;
            if (b === 'all') return 1;
            return a.localeCompare(b, 'pl');
        }),
        availableRooms: [...roomSet].sort((a, b) => {
            if (a === 'all') return -1;
            if (b === 'all') return 1;
            return a.localeCompare(b, 'pl');
        }),
    };
}

export function filterGuestPlanData(plansData, filters = {}) {
    if (!plansData) return null;

    const {
        filterText = '',
        specFilter = 'all',
        semesterFilter = 'all',
        studyModeFilter = 'all',
        lecturerFilter = 'all',
        roomFilter = 'all',
    } = filters;

    if (
        !filterText.trim() &&
        specFilter === 'all' &&
        semesterFilter === 'all' &&
        studyModeFilter === 'all' &&
        lecturerFilter === 'all' &&
        roomFilter === 'all'
    ) {
        return plansData;
    }

    const newFilteredData = JSON.parse(JSON.stringify(plansData));
    const filteredResults = {};

    for (const key in newFilteredData.results) {
        const [sem, spec = '', mode = 'STAC'] = String(key).split('|');
        const semMatches = semesterFilter === 'all' || getPlannerSemesters(sem).includes(semesterFilter);
        const modeMatches = studyModeFilter === 'all' || normalizeStudyMode(mode || 'STAC') === studyModeFilter;
        let specMatches = true;

        if (specFilter !== 'all') {
            const isRelevantSem = ['5', '6', '8'].includes(sem);
            if (isRelevantSem) {
                const selectedSpecValue = normalizeSpecializationValue(specFilter);
                const planSpecValue = normalizeSpecializationValue(spec || 'Ogólne');
                specMatches = planVariantMatchesSelectedSpecialization(planSpecValue, selectedSpecValue);
            }
        }

        if (semMatches && modeMatches && specMatches) {
            filteredResults[key] = newFilteredData.results[key];
        }
    }

    newFilteredData.results = filteredResults;

    if (filterText.trim()) {
        const lowerCaseFilter = filterText.toLowerCase();
        for (const key in newFilteredData.results) {
            const planData = newFilteredData.results[key];
            if (planData && Array.isArray(planData.plan)) {
                planData.plan = planData.plan.filter((zajecia) => {
                    return (
                        zajecia.name?.toLowerCase().includes(lowerCaseFilter) ||
                        zajecia.lecturer?.toLowerCase().includes(lowerCaseFilter) ||
                        zajecia.room?.toLowerCase().includes(lowerCaseFilter) ||
                        zajecia.type?.toLowerCase().includes(lowerCaseFilter) ||
                        (Array.isArray(zajecia.group) ? zajecia.group.join(' ') : zajecia.group)?.toLowerCase().includes(lowerCaseFilter)
                    );
                });
            }
        }
    }

    if (lecturerFilter !== 'all' || roomFilter !== 'all') {
        for (const key in newFilteredData.results) {
            const planData = newFilteredData.results[key];
            if (planData && Array.isArray(planData.plan)) {
                planData.plan = planData.plan.filter((zajecia) => {
                    const lecturerMatches = lecturerFilter === 'all' || zajecia.lecturer === lecturerFilter;
                    const roomMatches = roomFilter === 'all' || zajecia.room === roomFilter;
                    return lecturerMatches && roomMatches;
                });
            }
        }
    }

    Object.keys(newFilteredData.results).forEach((key) => {
        const planData = newFilteredData.results[key];
        if (!planData || !Array.isArray(planData.plan) || planData.plan.length === 0) {
            delete newFilteredData.results[key];
        }
    });

    return newFilteredData;
}

function normalizeSpecializationValue(value) {
    if (!value || value === 'Ogólne') return 'Ogólne';
    return String(value).trim();
}

function normalizeStudyMode(mode) {
    const value = String(mode || '').trim().toUpperCase();
    if (value === 'NST' || value === 'NSTAC') return 'NSTAC';
    if (value === 'ST' || value === 'STAC') return 'STAC';
    return value || 'STAC';
}

function getPlannerSemesters(semesterKey) {
    const sem = String(semesterKey || '').trim();
    if (!sem) return [];

    if (sem === '5' || sem === '6' || sem === '8') return [sem];
    if (sem === '7') return ['7'];
    if (sem === '9') return ['9'];

    return [sem];
}

function planVariantMatchesSelectedSpecialization(planSpecValue, selectedSpecValue) {
    const normalizedSelected = normalizeSpecializationValue(selectedSpecValue);
    const normalizedPlan = normalizeSpecializationValue(planSpecValue);

    if (normalizedSelected === 'Ogólne' || normalizedPlan === 'Ogólne') {
        return normalizedPlan === normalizedSelected;
    }

    const selectedParts = new Set(normalizedSelected.split('+').map((part) => part.trim()).filter(Boolean));
    const planParts = new Set(normalizedPlan.split('+').map((part) => part.trim()).filter(Boolean));

    return selectedParts.size > 0 && [...selectedParts].every((part) => planParts.has(part));
}
