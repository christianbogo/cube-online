export interface LocalDataSettings {
    saveAll: boolean;
    saveLastX: number;
    localLimit: number;
}

export type DataBackupOption = 'all' | 'session-bests' | 'all-time-bests' | 'local-only';

export type FollowerDisplayOption = 'default' | 'minimal' | 'popular';

export interface Settings {
    solveInspection: boolean;
    primingLength: number;
    showLiveTimer: boolean;
    scrambleSize: number; // in rem
    timerSize: number; // in rem
    hideScramble: boolean;
    followerDisplay: FollowerDisplayOption;
    localDataSettings: LocalDataSettings;
    dataBackup: DataBackupOption;
    scrambleType: string;
}

export interface SettingsContextType {
    settings: Settings;
    updateSettings: (newSettings: Partial<Settings>) => void;
}
