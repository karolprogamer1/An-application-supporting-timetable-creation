const SPECIALIZATION_ALIASES = {
  ASiSK: 'CTS',
  PBDiOU: 'IOSI',
  M3D: 'ISP',
  'ASiSK+M3D': 'CTS+ISP',
  'ASiSK+PBDiOU': 'CTS+IOSI',
  'ASiSK+PBDiOU+M3D': 'CTS+IOSI+ISP',
  CTS: 'CTS',
  IOSI: 'IOSI',
  ISP: 'ISP',
};

export const normalizeSpecializationValue = (value) => {
  const raw = String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/\+\s*/g, '+')
    .replace(/^\+|\+$/g, '');

  if (!raw) return '';

  const normalizedParts = raw
    .split('+')
    .filter(Boolean)
    .map((part) => SPECIALIZATION_ALIASES[part] || part);

  return [...new Set(normalizedParts)].join('+');
};

export const isGeneralSpecialization = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
  return normalized === '' || normalized === 'ogólne' || normalized === 'ogolne';
};

export const normalizeStudyMode = (value) => {
  const mode = String(value ?? '').trim().toUpperCase();
  if (mode === 'NST' || mode === 'NSTAC') return 'NSTAC';
  if (mode === 'ST' || mode === 'STAC') return 'STAC';
  return 'all';
};

export const getPlannerSemesters = (value) => {
  const rawSemesters = Array.isArray(value)
    ? value.map((item) => String(item ?? '').trim()).filter(Boolean)
    : String(value ?? '')
        .split(/[|,/\s]+/)
        .map((item) => item.trim())
        .filter(Boolean);

  return [...new Set(rawSemesters.filter(Boolean))];
};

export const planVariantMatchesSelectedSpecialization = (value, selectedFilter) => {
  if (selectedFilter === 'all' || selectedFilter === 'Wszystkie') {
    return true;
  }

  if (selectedFilter === 'Ogólne') {
    return true;
  }

  const selectedSpecValue = normalizeSpecializationValue(selectedFilter);
  const planSpecValue = normalizeSpecializationValue(value);

  if (isGeneralSpecialization(planSpecValue)) {
    return true;
  }

  const filterParts = new Set(selectedSpecValue.split('+').filter(Boolean));
  const planParts = new Set(planSpecValue.split('+').filter(Boolean));

  if (filterParts.size === 0 || planParts.size === 0) {
    return false;
  }

  const selectedParts = [...filterParts];
  const planPartList = [...planParts];

  if (selectedParts.length === 1) {
    return planPartList.includes(selectedParts[0]);
  }

  return selectedParts.every((part) => planPartList.includes(part));
};

export const courseMatchesSelectedSpecialization = (value, selectedFilter) => {
  if (selectedFilter === 'all' || selectedFilter === 'Wszystkie') {
    return true;
  }

  const selectedSpecValue = normalizeSpecializationValue(selectedFilter);
  const itemSpecValue = normalizeSpecializationValue(value);

  if (selectedFilter === 'Ogólne') {
    return isGeneralSpecialization(itemSpecValue);
  }

  if (isGeneralSpecialization(itemSpecValue)) {
    return true;
  }

  const filterParts = new Set(selectedSpecValue.split('+').filter(Boolean));
  const itemParts = new Set(itemSpecValue.split('+').filter(Boolean));

  if (filterParts.size === 0 || itemParts.size === 0) {
    return false;
  }

  const selectedParts = [...filterParts];
  const itemPartList = [...itemParts];

  if (selectedParts.length === 1) {
    return itemPartList.includes(selectedParts[0]);
  }

  return selectedParts.every((part) => itemPartList.includes(part));
};

export const resolveSemesterFilterValue = (value, options) => {
  if (!value || value === 'all' || value === 'Wszystkie') return 'all';

  const normalizedValue = String(value).trim();
  const normalizedOptions = options.map((option) => String(option).trim());

  if (normalizedOptions.includes(normalizedValue)) return normalizedValue;

  if (normalizedValue.includes('|')) {
    const [semesterPart = ''] = normalizedValue.split('|');
    const semesterOnlyValue = semesterPart.trim();

    if (semesterOnlyValue && normalizedOptions.includes(semesterOnlyValue)) {
      return semesterOnlyValue;
    }

    const exactSemesterMatch = normalizedOptions.find((option) => {
      const [optionSemester = ''] = String(option).split('|');
      return optionSemester === semesterOnlyValue;
    });

    if (exactSemesterMatch) {
      return exactSemesterMatch;
    }

    const prefixedMatch = normalizedOptions.find((option) => String(option).startsWith(`${semesterOnlyValue}|`));
    if (prefixedMatch) return prefixedMatch;
  }

  if (/^\d+$/.test(normalizedValue)) {
    const fallbackMatch = normalizedOptions.find((option) => String(option).split('|')[0] === normalizedValue);
    if (fallbackMatch) return fallbackMatch;
  }

  if (normalizedOptions.length > 0) {
    const firstNonAll = normalizedOptions.find((option) => option !== 'all');
    return firstNonAll || 'all';
  }

  return 'all';
};
