import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Settings, LocalDataSettings, SettingsContextType, DataBackupOption } from '../types';

export type { Settings, LocalDataSettings, SettingsContextType, DataBackupOption };

const defaultSettings: Settings = {
    solveInspection: false,
    primingLength: 0.6,
    showLiveTimer: false,
    scrambleSize: 1.5,
    localDataSettings: {
        saveAll: true,
        saveLastX: 100,
        localLimit: 250,
    },
    dataBackup: 'session-bests',
    scrambleType: '333',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<Settings>(() => {
        const stored = localStorage.getItem('cutter-cubing-settings');
        // Migration/Initialization logic for scrambleType
        const storedScrambleType = localStorage.getItem('cube-online-scramble-type') || '333';

        if (stored) {
            try {
                // Merge stored settings with defaults to handle new fields in future
                return { ...defaultSettings, scrambleType: storedScrambleType, ...JSON.parse(stored) };
            } catch (e) {
                console.error('Failed to parse settings', e);
                return { ...defaultSettings, scrambleType: storedScrambleType };
            }
        }
        return { ...defaultSettings, scrambleType: storedScrambleType };
    });

    useEffect(() => {
        localStorage.setItem('cutter-cubing-settings', JSON.stringify(settings));
        localStorage.setItem('cube-online-scramble-type', settings.scrambleType);
    }, [settings]);

    const updateSettings = (newSettings: Partial<Settings>) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
