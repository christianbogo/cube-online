import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import type { Settings, LocalDataSettings, SettingsContextType, DataBackupOption, CustomEvent } from '../types';
import { useAuth } from './AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export type { Settings, LocalDataSettings, SettingsContextType, DataBackupOption, CustomEvent };

const defaultSettings: Settings = {
    solveInspection: false,
    primingLength: 0.6,
    showLiveTimer: false,
    scrambleSize: 1.5,
    timerSize: 8,
    hideScramble: false,
    followerDisplay: 'default',
    localDataSettings: {
        saveAll: true,
        saveLastX: 100,
        localLimit: 250,
    },
    dataBackup: 'session-bests',
    scrambleType: '333',
    customEvents: [],
};

function getStorageKey(uid: string | null | undefined, prefix: string) {
    return uid ? `${prefix}_${uid}` : `${prefix}_guest`;
}

function loadSettingsForUser(uid: string | null | undefined, profileCustomEvents?: CustomEvent[]): Settings {
    const userSettingsKey = getStorageKey(uid, 'cutter-cubing-settings');
    const userScrambleKey = getStorageKey(uid, 'cube-online-scramble-type');

    let stored = localStorage.getItem(userSettingsKey);
    let storedScrambleType = localStorage.getItem(userScrambleKey);

    let resultSettings: Settings = { ...defaultSettings };

    if (stored) {
        try {
            resultSettings = { ...defaultSettings, ...JSON.parse(stored) };
        } catch (e) {
            console.error('Failed to parse user settings', e);
        }
    } else {
        // Fallback to legacy un-scoped settings for generic preferences (sizes, priming length, etc.)
        const legacy = localStorage.getItem('cutter-cubing-settings');
        if (legacy) {
            try {
                const parsed = JSON.parse(legacy);
                // Explicitly strip customEvents from legacy so one account's events don't leak to another
                const { customEvents: _discard, ...otherSettings } = parsed;
                resultSettings = { ...defaultSettings, ...otherSettings };
            } catch (e) {
                console.error('Failed to parse legacy settings', e);
            }
        }
    }

    if (!storedScrambleType) {
        storedScrambleType = localStorage.getItem('cube-online-scramble-type') || '333';
    }
    resultSettings.scrambleType = storedScrambleType;

    // Custom events are bound to user profile when authenticated
    if (uid) {
        resultSettings.customEvents = profileCustomEvents || [];
    } else {
        resultSettings.customEvents = resultSettings.customEvents || [];
    }

    // Safety check on scrambleType: if it's a custom event that doesn't exist in current customEvents, reset to 333
    if (resultSettings.scrambleType.startsWith('custom_')) {
        const exists = (resultSettings.customEvents || []).some(e => e.id === resultSettings.scrambleType);
        if (!exists) {
            resultSettings.scrambleType = '333';
        }
    }

    return resultSettings;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const currentUid = user?.uid || null;
    const prevUidRef = useRef<string | null>(currentUid);

    const [settings, setSettings] = useState<Settings>(() => {
        return loadSettingsForUser(currentUid, user?.customEvents);
    });

    // Clean up any legacy customEvents from the un-scoped localStorage key on mount
    useEffect(() => {
        try {
            const legacy = localStorage.getItem('cutter-cubing-settings');
            if (legacy) {
                const parsed = JSON.parse(legacy);
                if (parsed.customEvents && parsed.customEvents.length > 0) {
                    delete parsed.customEvents;
                    localStorage.setItem('cutter-cubing-settings', JSON.stringify(parsed));
                }
            }
        } catch {
            // Ignore
        }
    }, []);

    // When authenticated user changes (login, logout, switch account)
    useEffect(() => {
        if (currentUid !== prevUidRef.current) {
            prevUidRef.current = currentUid;
            const newSettings = loadSettingsForUser(currentUid, user?.customEvents);
            setSettings(newSettings);
        }
    }, [currentUid, user?.customEvents]);

    // When customEvents in user's profile updates from Firestore (snapshot update for SAME user)
    useEffect(() => {
        if (!currentUid || !user?.customEvents) return;
        const profileEvents = user.customEvents;
        setSettings(prev => {
            const currentEvents = prev.customEvents || [];
            if (JSON.stringify(currentEvents) === JSON.stringify(profileEvents)) {
                return prev;
            }
            let nextScramble = prev.scrambleType;
            if (nextScramble.startsWith('custom_') && !profileEvents.some(e => e.id === nextScramble)) {
                nextScramble = '333';
            }
            return {
                ...prev,
                customEvents: profileEvents,
                scrambleType: nextScramble
            };
        });
    }, [currentUid, user?.customEvents]);

    // Persist to user-scoped localStorage whenever settings change
    useEffect(() => {
        const userSettingsKey = getStorageKey(currentUid, 'cutter-cubing-settings');
        const userScrambleKey = getStorageKey(currentUid, 'cube-online-scramble-type');
        localStorage.setItem(userSettingsKey, JSON.stringify(settings));
        localStorage.setItem(userScrambleKey, settings.scrambleType);

        // Keep un-scoped key updated for backward compatibility, but never store customEvents in it
        const { customEvents: _discard, ...safeGlobalSettings } = settings;
        localStorage.setItem('cutter-cubing-settings', JSON.stringify(safeGlobalSettings));
        localStorage.setItem('cube-online-scramble-type', settings.scrambleType);
    }, [settings, currentUid]);

    const updateSettings = (newSettings: Partial<Settings>) => {
        setSettings(prev => {
            const updated = { ...prev, ...newSettings };
            return updated;
        });

        // Sync customEvents to Firestore profile when user is signed in
        if (newSettings.customEvents !== undefined && currentUid) {
            setDoc(doc(db, 'users', currentUid), {
                customEvents: newSettings.customEvents
            }, { merge: true }).catch(err => {
                console.error('Failed to sync customEvents to Firestore profile:', err);
            });
        }
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
