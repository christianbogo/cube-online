export interface LocalDataSettings {
    saveAll: boolean;
    saveLastX: number;
    localLimit: number;
}

export type DataBackupOption = 'all' | 'session-bests' | 'all-time-bests' | 'local-only';

export interface Settings {
    solveInspection: boolean;
    primingLength: number;
    showLiveTimer: boolean;
    scrambleSize: number; // in rem
    localDataSettings: LocalDataSettings;
    dataBackup: DataBackupOption;
    dailySolves: boolean;
    scrambleType: string;
}

export interface SettingsContextType {
    settings: Settings;
    updateSettings: (newSettings: Partial<Settings>) => void;
}
