export function getGenerationPlanCollections(generationResult) {
    const source = generationResult && typeof generationResult === 'object' && !Array.isArray(generationResult)
        ? (generationResult.results && typeof generationResult.results === 'object' && !Array.isArray(generationResult.results)
            ? generationResult.results
            : generationResult)
        : {};

    const entries = Object.values(source || {});

    const allScheduled = entries.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
        return Array.isArray(entry.plan) ? entry.plan : [];
    });

    const allUnscheduled = entries.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
        return Array.isArray(entry.unscheduled) ? entry.unscheduled : [];
    });

    return {
        allScheduled,
        allUnscheduled,
        isResultEmpty: allScheduled.length === 0 && allUnscheduled.length === 0,
    };
}
