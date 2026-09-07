import { useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { SCRAMBLE_TYPES, type ScrambleTypeOption } from '../utils/constants';

export function useEvents() {
    const { settings } = useSettings();

    const customEventOptions: ScrambleTypeOption[] = useMemo(() => {
        if (!settings.customEvents) return [];
        return settings.customEvents.map(ce => ({
            label: ce.name,
            value: ce.id,
            isAverageable: true,
            description: ce.scrambleType !== 'none' ? `Scramble: ${ce.scrambleType}` : 'No scramble'
        }));
    }, [settings.customEvents]);

    const allEvents: ScrambleTypeOption[] = useMemo(() => {
        return [...SCRAMBLE_TYPES, ...customEventOptions];
    }, [customEventOptions]);

    const getEventLabel = (eventId: string) => {
        return allEvents.find(e => e.value === eventId)?.label || eventId;
    };

    const getBaseScrambleType = (eventId: string): string | 'none' => {
        if (SCRAMBLE_TYPES.some(s => s.value === eventId)) {
            return eventId;
        }
        const custom = settings.customEvents?.find(c => c.id === eventId);
        if (custom) {
            return custom.scrambleType;
        }
        return '333';
    };

    return {
        allEvents,
        customEventOptions,
        getEventLabel,
        getBaseScrambleType
    };
}
