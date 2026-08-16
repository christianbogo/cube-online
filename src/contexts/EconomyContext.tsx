import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import type { EconomyState, ActiveWager, GamblingAlert, CosmeticCategory, CosmeticItem } from '../types/economy';
import { STARTING_COLOR, COLOR_LADDER, GACHA_BOXES, performGachaPull, COSMETICS_CATALOG } from '../utils/cosmeticsData';
import { soundEngine } from '../utils/soundEngine';
import { useAuth } from './AuthContext';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const STORAGE_KEY = 'cube_online_economy_v1';

const defaultState: EconomyState = {
    coins: 50,
    heartbreakTokens: 0,
    unlockedColors: [STARTING_COLOR],
    equippedColor: STARTING_COLOR,
    unlockedCosmetics: ['title-cfop'],
    equippedCosmetics: {
        theme: 'theme-default',
        sound: 'classic',
        title: 'CFOP Novice',
        cubeSkin: 'stickerless'
    },
    streak: {
        count: 0,
        currentPot: 0,
        isRiding: false,
        targetMaxTime: null
    },
    activeWager: null,
    stats: {
        totalGambled: 0,
        totalWon: 0,
        highestStreak: 0,
        highestMultiplier: 1,
        nearMissesCount: 0,
        cratesOpened: 0,
        totalCoinsEarned: 50
    }
};

interface EconomyContextType {
    economy: EconomyState;
    activeAlert: GamblingAlert | null;
    dismissAlert: () => void;
    processSolveGambling: (solveTime: number, isDNF: boolean, isPlusTwo: boolean, sessionAverage: number | null, pb: number | null) => void;
    bankStreakPot: () => void;
    toggleLetItRide: () => void;
    placeWager: (amount: number, targetTime: number, odds: number, targetLabel: string) => boolean;
    cancelWager: () => void;
    purchaseColor: (colorHex: string) => { success: boolean; error?: string };
    equipColor: (colorHex: string) => boolean;
    openGachaBox: (boxType: 'standard' | 'high_roller' | 'heartbreak') => { success: boolean; item?: CosmeticItem; isDuplicate?: boolean; duplicateCompensation?: number; error?: string };
    equipCosmetic: (category: CosmeticCategory, id: string) => void;
    addBonusCoins: (amount: number) => void;
}

const EconomyContext = createContext<EconomyContextType | undefined>(undefined);

export function EconomyProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();

    const [economy, setEconomy] = useState<EconomyState>(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Ensure starting color is always in unlockedColors
                const unlocked = Array.isArray(parsed.unlockedColors) && parsed.unlockedColors.length > 0
                    ? parsed.unlockedColors
                    : [STARTING_COLOR];
                return {
                    ...defaultState,
                    ...parsed,
                    unlockedColors: unlocked,
                    equippedColor: parsed.equippedColor || unlocked[0] || STARTING_COLOR
                };
            } catch (e) {
                console.error('Failed to parse economy state', e);
            }
        }
        return defaultState;
    });

    const [activeAlert, setActiveAlert] = useState<GamblingAlert | null>(null);
    const isInitialSyncRef = useRef(true);

    // Save to LocalStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(economy));
    }, [economy]);

    // Sync with Firestore when user signs in
    useEffect(() => {
        if (!user) {
            isInitialSyncRef.current = true;
            return;
        }

        const loadCloudEconomy = async () => {
            try {
                const userRef = doc(db, 'users', user.uid);
                const snap = await getDoc(userRef);
                if (snap.exists()) {
                    const data = snap.data();
                    if (data.economy) {
                        setEconomy(prev => {
                            const cloud = data.economy;
                            const unlockedColors = Array.from(new Set([...(cloud.unlockedColors || []), ...(prev.unlockedColors || [STARTING_COLOR])]));
                            return {
                                ...prev,
                                ...cloud,
                                unlockedColors,
                                equippedColor: cloud.equippedColor || prev.equippedColor || STARTING_COLOR,
                                unlockedCosmetics: Array.from(new Set([...(cloud.unlockedCosmetics || []), ...(prev.unlockedCosmetics || [])]))
                            };
                        });
                    } else {
                        // First time saving economy to user doc
                        await setDoc(userRef, { economy }, { merge: true });
                    }
                }
            } catch (e) {
                console.error("Failed to sync economy from cloud:", e);
            } finally {
                isInitialSyncRef.current = false;
            }
        };

        loadCloudEconomy();
    }, [user]);

    // Sync changes to Firestore
    const syncToCloud = useCallback(async (stateToSave: EconomyState) => {
        if (!user || isInitialSyncRef.current) return;
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                economy: stateToSave,
                color: stateToSave.equippedColor
            });
        } catch (e) {
            console.error("Failed to save economy to cloud:", e);
        }
    }, [user]);

    const dismissAlert = useCallback(() => {
        setActiveAlert(null);
    }, []);

    // 1. Process Gambling Mechanics on Solve Complete
    const processSolveGambling = useCallback((
        solveTime: number,
        isDNF: boolean,
        isPlusTwo: boolean,
        sessionAverage: number | null,
        pb: number | null
    ) => {
        setEconomy(prev => {
            let newCoins = prev.coins;
            let newHeartbreak = prev.heartbreakTokens;
            let newPot = prev.streak.currentPot;
            let newStreakCount = prev.streak.count;
            let isRiding = prev.streak.isRiding;
            let targetMaxTime = sessionAverage;
            let totalWon = prev.stats.totalWon;
            let totalEarned = prev.stats.totalCoinsEarned;
            let highestStreak = prev.stats.highestStreak;
            let highestMultiplier = prev.stats.highestMultiplier;
            let nearMissesCount = prev.stats.nearMissesCount;

            let alertToTrigger: GamblingAlert | null = null;

            // --- A. PUSH-YOUR-LUCK STREAK MULTIPLIER ---
            if (isRiding) {
                const isUnderAverage = sessionAverage !== null ? solveTime <= sessionAverage : true;
                const wonStreak = !isDNF && isUnderAverage;

                if (wonStreak) {
                    // Pot multiplies by 2x
                    newStreakCount += 1;
                    newPot = Math.max(20, (newPot || 10) * 2);
                    if (newStreakCount > highestStreak) highestStreak = newStreakCount;
                    const mult = Math.pow(2, newStreakCount - 1);
                    if (mult > highestMultiplier) highestMultiplier = mult;

                    soundEngine.playStreakLevelUp(newStreakCount);
                    alertToTrigger = {
                        id: crypto.randomUUID(),
                        type: 'streak_win',
                        title: `Streak x${newStreakCount} Multiplier!`,
                        subtitle: `Under average! Unbanked Pot is now ${newPot} Coins.`,
                        amount: newPot,
                        tokenType: 'coins',
                        timestamp: Date.now()
                    };
                } else {
                    // BUSTED! Pot lost
                    soundEngine.playStreakBust();
                    alertToTrigger = {
                        id: crypto.randomUUID(),
                        type: 'streak_bust',
                        title: 'Streak Busted!',
                        subtitle: isDNF ? 'DNF wiped out your unbanked pot.' : `Exceeded session average (${(sessionAverage! / 1000).toFixed(2)}s). Pot reset.`,
                        amount: newPot,
                        tokenType: 'coins',
                        timestamp: Date.now()
                    };
                    newPot = 0;
                    newStreakCount = 0;
                    isRiding = false;
                }
            } else {
                // Not currently riding -> Start or add base 10 coins to pot
                if (newPot === 0) {
                    newPot = 10;
                    newStreakCount = 1;
                } else {
                    newPot += 10;
                }
            }

            // --- B. PERFORMANCE WAGERING ---
            if (prev.activeWager) {
                const wager = prev.activeWager;
                const wonWager = !isDNF && solveTime <= wager.targetTime;

                if (wonWager) {
                    const payout = Math.round(wager.wagerAmount * wager.odds);
                    newCoins += payout;
                    totalWon += payout;
                    totalEarned += payout;

                    soundEngine.playWagerWin();
                    alertToTrigger = {
                        id: crypto.randomUUID(),
                        type: 'wager_win',
                        title: 'Wager Won!',
                        subtitle: `Beat target ${wager.targetLabel}! Paid out ${wager.odds}x odds.`,
                        amount: payout,
                        tokenType: 'coins',
                        timestamp: Date.now()
                    };
                } else {
                    soundEngine.playWagerLoss();
                    alertToTrigger = {
                        id: crypto.randomUUID(),
                        type: 'wager_loss',
                        title: 'Wager Lost',
                        subtitle: isDNF ? 'DNF solve failed the target.' : `Time exceeded ${wager.targetLabel}.`,
                        amount: wager.wagerAmount,
                        tokenType: 'coins',
                        timestamp: Date.now()
                    };
                }
            }

            // --- C. NEAR MISS PITY SYSTEM ---
            // Detect if missed PB by <= 0.10s (100ms) or +2 penalty ruined a PB solve
            let isNearMiss = false;
            let nearMissReason = '';

            if (pb !== null && !isDNF) {
                const diffFromPb = solveTime - pb;
                if (diffFromPb > 0 && diffFromPb <= 100) {
                    isNearMiss = true;
                    nearMissReason = `Missed PB by only ${(diffFromPb / 1000).toFixed(2)}s!`;
                } else if (isPlusTwo && (solveTime - 2000) <= pb) {
                    isNearMiss = true;
                    nearMissReason = `Heartbreaking +2 penalty ruined a new Personal Best!`;
                }
            }

            // Detect if missed active wager target by <= 0.20s (200ms)
            if (!isNearMiss && prev.activeWager && !isDNF) {
                const diffFromWager = solveTime - prev.activeWager.targetTime;
                if (diffFromWager > 0 && diffFromWager <= 200) {
                    isNearMiss = true;
                    nearMissReason = `Missed wager target by only ${(diffFromWager / 1000).toFixed(2)}s!`;
                }
            }

            if (isNearMiss) {
                newHeartbreak += 1;
                nearMissesCount += 1;
                soundEngine.playHeartbreak();
                alertToTrigger = {
                    id: crypto.randomUUID(),
                    type: 'near_miss',
                    title: 'Near Miss Pity Award!',
                    subtitle: `${nearMissReason} +1 Heartbreak Token (Rage Coin) awarded.`,
                    amount: 1,
                    tokenType: 'heartbreak',
                    timestamp: Date.now()
                };
            }

            if (alertToTrigger) {
                setActiveAlert(alertToTrigger);
            }

            const updated: EconomyState = {
                ...prev,
                coins: newCoins,
                heartbreakTokens: newHeartbreak,
                streak: {
                    count: newStreakCount,
                    currentPot: newPot,
                    isRiding: isRiding,
                    targetMaxTime: targetMaxTime
                },
                activeWager: null, // Clear wager after solve
                stats: {
                    ...prev.stats,
                    totalWon,
                    totalCoinsEarned: totalEarned,
                    highestStreak,
                    highestMultiplier,
                    nearMissesCount
                }
            };

            syncToCloud(updated);
            return updated;
        });
    }, [syncToCloud]);

    // 2. Bank Pot
    const bankStreakPot = useCallback(() => {
        setEconomy(prev => {
            if (prev.streak.currentPot <= 0) return prev;
            const pot = prev.streak.currentPot;
            soundEngine.playBankCoins();

            const updated: EconomyState = {
                ...prev,
                coins: prev.coins + pot,
                streak: {
                    count: 0,
                    currentPot: 0,
                    isRiding: false,
                    targetMaxTime: null
                },
                stats: {
                    ...prev.stats,
                    totalCoinsEarned: prev.stats.totalCoinsEarned + pot
                }
            };

            syncToCloud(updated);
            return updated;
        });
    }, [syncToCloud]);

    // 3. Toggle Let It Ride
    const toggleLetItRide = useCallback(() => {
        setEconomy(prev => {
            const nextRiding = !prev.streak.isRiding;
            // If starting from 0 pot, give initial base 10 pot
            const currentPot = prev.streak.currentPot === 0 ? 10 : prev.streak.currentPot;
            const updated: EconomyState = {
                ...prev,
                streak: {
                    ...prev.streak,
                    currentPot,
                    isRiding: nextRiding
                }
            };
            return updated;
        });
    }, []);

    // 4. Place Wager
    const placeWager = useCallback((amount: number, targetTime: number, odds: number, targetLabel: string): boolean => {
        let success = false;
        setEconomy(prev => {
            if (amount <= 0 || prev.coins < amount) return prev;

            const newWager: ActiveWager = {
                id: crypto.randomUUID(),
                targetTime,
                targetLabel,
                wagerAmount: amount,
                odds,
                potentialPayout: Math.round(amount * odds)
            };

            success = true;
            const updated: EconomyState = {
                ...prev,
                coins: prev.coins - amount,
                activeWager: newWager,
                stats: {
                    ...prev.stats,
                    totalGambled: prev.stats.totalGambled + amount
                }
            };
            syncToCloud(updated);
            return updated;
        });
        return success;
    }, [syncToCloud]);

    // 5. Cancel Wager (Refund)
    const cancelWager = useCallback(() => {
        setEconomy(prev => {
            if (!prev.activeWager) return prev;
            const refund = prev.activeWager.wagerAmount;
            const updated: EconomyState = {
                ...prev,
                coins: prev.coins + refund,
                activeWager: null,
                stats: {
                    ...prev.stats,
                    totalGambled: Math.max(0, prev.stats.totalGambled - refund)
                }
            };
            syncToCloud(updated);
            return updated;
        });
    }, [syncToCloud]);

    // 6. Buy Color from Store
    const purchaseColor = useCallback((colorHex: string): { success: boolean; error?: string } => {
        const item = COLOR_LADDER.find(c => c.hex.toLowerCase() === colorHex.toLowerCase());
        if (!item) return { success: false, error: 'Color not found.' };

        let result: { success: boolean; error?: string } = { success: false, error: '' };

        setEconomy(prev => {
            if (prev.unlockedColors.includes(item.hex)) {
                result = { success: true };
                return prev;
            }
            if (prev.coins < item.price) {
                result = { success: false, error: `Insufficient coins. Requires ${item.price.toLocaleString()} coins.` };
                return prev;
            }

            soundEngine.playWagerWin();
            result = { success: true };
            const updated: EconomyState = {
                ...prev,
                coins: prev.coins - item.price,
                unlockedColors: [...prev.unlockedColors, item.hex],
                equippedColor: item.hex
            };
            syncToCloud(updated);
            return updated;
        });

        return result;
    }, [syncToCloud]);

    // 7. Equip Color
    const equipColor = useCallback((colorHex: string): boolean => {
        let success = false;
        setEconomy(prev => {
            if (!prev.unlockedColors.includes(colorHex)) return prev;
            success = true;
            const updated: EconomyState = {
                ...prev,
                equippedColor: colorHex
            };
            syncToCloud(updated);
            return updated;
        });
        return success;
    }, [syncToCloud]);

    // 8. Open Gacha Capsule
    const openGachaBox = useCallback((boxType: 'standard' | 'high_roller' | 'heartbreak') => {
        const config = GACHA_BOXES.find(b => b.id === boxType);
        if (!config) return { success: false, error: 'Capsule not found.' };

        let res: { success: boolean; item?: CosmeticItem; isDuplicate?: boolean; duplicateCompensation?: number; error?: string } = {
            success: false
        };

        setEconomy(prev => {
            const hasCurrency = config.currency === 'coins'
                ? prev.coins >= config.cost
                : prev.heartbreakTokens >= config.cost;

            if (!hasCurrency) {
                res = {
                    success: false,
                    error: `Insufficient ${config.currency === 'coins' ? 'coins' : 'Heartbreak Tokens'}. Requires ${config.cost}.`
                };
                return prev;
            }

            const pull = performGachaPull(boxType, prev.unlockedCosmetics);
            soundEngine.playGachaReveal(pull.item.rarity);

            const newCoins = config.currency === 'coins'
                ? prev.coins - config.cost + pull.duplicateCompensation
                : prev.coins + pull.duplicateCompensation;

            const newHeartbreak = config.currency === 'heartbreak'
                ? prev.heartbreakTokens - config.cost
                : prev.heartbreakTokens;

            const unlockedCosmetics = pull.isDuplicate
                ? prev.unlockedCosmetics
                : [...prev.unlockedCosmetics, pull.item.id];

            res = {
                success: true,
                item: pull.item,
                isDuplicate: pull.isDuplicate,
                duplicateCompensation: pull.duplicateCompensation
            };

            const updated: EconomyState = {
                ...prev,
                coins: newCoins,
                heartbreakTokens: newHeartbreak,
                unlockedCosmetics,
                stats: {
                    ...prev.stats,
                    cratesOpened: prev.stats.cratesOpened + 1
                }
            };
            syncToCloud(updated);
            return updated;
        });

        return res;
    }, [syncToCloud]);

    // 9. Equip Cosmetic
    const equipCosmetic = useCallback((category: CosmeticCategory, id: string) => {
        setEconomy(prev => {
            const item = COSMETICS_CATALOG.find(c => c.id === id);
            if (!item && id !== 'theme-default' && id !== 'classic' && id !== 'stickerless') return prev;

            const nextEquipped = { ...prev.equippedCosmetics };
            const value = item ? (item.value || item.id) : (id === 'theme-default' ? 'theme-default' : id);

            if (category === 'theme') nextEquipped.theme = value;
            else if (category === 'sound') nextEquipped.sound = value;
            else if (category === 'title') nextEquipped.title = item ? item.name : value;
            else if (category === 'cubeSkin') nextEquipped.cubeSkin = value;

            const updated: EconomyState = {
                ...prev,
                equippedCosmetics: nextEquipped
            };
            syncToCloud(updated);
            return updated;
        });
    }, [syncToCloud]);

    // 10. Add Bonus Coins (for testing or rewards)
    const addBonusCoins = useCallback((amount: number) => {
        setEconomy(prev => {
            const updated: EconomyState = {
                ...prev,
                coins: prev.coins + amount,
                stats: {
                    ...prev.stats,
                    totalCoinsEarned: prev.stats.totalCoinsEarned + amount
                }
            };
            syncToCloud(updated);
            return updated;
        });
    }, [syncToCloud]);

    return (
        <EconomyContext.Provider value={{
            economy,
            activeAlert,
            dismissAlert,
            processSolveGambling,
            bankStreakPot,
            toggleLetItRide,
            placeWager,
            cancelWager,
            purchaseColor,
            equipColor,
            openGachaBox,
            equipCosmetic,
            addBonusCoins
        }}>
            {children}
        </EconomyContext.Provider>
    );
}

export function useEconomy() {
    const context = useContext(EconomyContext);
    if (context === undefined) {
        throw new Error('useEconomy must be used within an EconomyProvider');
    }
    return context;
}
