import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface LocalDataSettings {
    saveAll: boolean;
    saveLastX: number;
}

interface Settings {
    solveInspection: boolean;
    primingLength: number;
    showLiveTimer: boolean;
    scrambleSize: number; // in rem
    localDataSettings: LocalDataSettings;
}

interface SettingsContextType {
    settings: Settings;
    updateSettings: (newSettings: Partial<Settings>) => void;
}

const defaultSettings: Settings = {
    solveInspection: false,
    primingLength: 0.6,
    showLiveTimer: false,
    scrambleSize: 1.5,
    localDataSettings: {
        saveAll: true,
        saveLastX: 100,
    },
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<Settings>(() => {
        const stored = localStorage.getItem('cutter-cubing-settings');
        if (stored) {
            try {
                // Merge stored settings with defaults to handle new fields in future
                return { ...defaultSettings, ...JSON.parse(stored) };
            } catch (e) {
                console.error('Failed to parse settings', e);
                return defaultSettings;
            }
        }
        return defaultSettings;
    });

    useEffect(() => {
        localStorage.setItem('cutter-cubing-settings', JSON.stringify(settings));
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
