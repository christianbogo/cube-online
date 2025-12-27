import { useMemo, useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getUserScrambleStats, type UserScrambleStats, BASE_RATE, LOOT_WEIGHTS } from '../utils/dailyScramble';

export default function Daily() {
    const { user } = useAuth();
    const [scrambleStats, setScrambleStats] = useState<UserScrambleStats | null>(null);

    useEffect(() => {
        if (user) {
            getUserScrambleStats(user.uid).then(setScrambleStats);
        }
    }, [user]);

    // Progress Calculations (Current Year 2025)
    // Assuming max counts: Hours=8760, Days=365, Weeks=52, Months=12, Year=1
    // Filter by '2025' in ID string
    const progress = useMemo(() => {
        if (!scrambleStats) return { h: 0, d: 0, w: 0, m: 0, y: 0 };
        const year = '2025';

        const count = (arr: string[] | undefined, prefix: string) =>
            (arr || []).filter(id => id.includes(prefix)).length;

        return {
            h: count(scrambleStats.completed_hours, `h-${year}`),
            d: count(scrambleStats.completed_days, `d-${year}`),
            w: count(scrambleStats.completed_weeks, `w-${year}`),
            m: count(scrambleStats.completed_months, `m-${year}`),
            y: count(scrambleStats.completed_years, `y-${year}`)
        };
    }, [scrambleStats]);



    // Progress Bar Component
    const ProgressBar = ({ label, value, max, color }: { label: string, value: number, max: number, color: string }) => {
        const pct = Math.min(100, Math.max(0, (value / max) * 100));
        return (
            <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-text-primary">{label}</span>
                    <span className="text-text-secondary">{value} / {max}</span>
                </div>
                <div className="h-2 w-full bg-bg-tertiary rounded-full overflow-hidden border border-border/30">
                    <div
                        className={`h-full ${color} transition-all duration-1000 ease-out`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
        );
    };



    const lootProbabilities = useMemo(() => {
        const total = Object.values(LOOT_WEIGHTS).reduce((a, b) => a + b, 0);
        return {
            h: ((LOOT_WEIGHTS.h / total) * 100).toFixed(1),
            d: ((LOOT_WEIGHTS.d / total) * 100).toFixed(1),
            w: ((LOOT_WEIGHTS.w / total) * 100).toFixed(1),
            m: ((LOOT_WEIGHTS.m / total) * 100).toFixed(1),
            y: ((LOOT_WEIGHTS.y / total) * 100).toFixed(2),
        };
    }, []);

    return (
        <div className="w-full h-full flex flex-col text-left">
            <h2 className="text-3xl font-semibold mb-6 text-text-primary">2025 Progress</h2>

            {/* Loot Stats Section */}
            {scrambleStats && (
                <div className="mb-8 p-4 bg-bg-secondary rounded-lg border border-border/50">
                    <h3 className="text-lg font-medium text-text-primary mb-2">Loot Box Stats</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-text-secondary">Current Loot Chance</p>
                            <div className="text-2xl font-bold text-accent">
                                {((BASE_RATE + (scrambleStats.loot_chance_modifier || 0)) * 100).toFixed(0)}%
                            </div>
                            <p className="text-xs text-text-secondary mt-1">
                                Modifier: +{(scrambleStats.loot_chance_modifier * 100).toFixed(0)}%
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-text-secondary mb-1">Drop Rates</p>
                            <div className="text-xs text-text-secondary space-y-1">
                                <div className="flex justify-between"><span>Hourly</span> <span>{lootProbabilities.h}%</span></div>
                                <div className="flex justify-between"><span>Daily</span> <span>{lootProbabilities.d}%</span></div>
                                <div className="flex justify-between"><span>Weekly</span> <span>{lootProbabilities.w}%</span></div>
                                <div className="flex justify-between"><span>Monthly</span> <span>{lootProbabilities.m}%</span></div>
                                <div className="flex justify-between"><span>Yearly</span> <span>{lootProbabilities.y}%</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-bg-secondary p-6 rounded-lg border border-border animate-in fade-in duration-300">
                <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-500" /> 2025 Progress
                </h3>
                <ProgressBar label="Yearly" value={progress.y} max={1} color="bg-yellow-500" />
                <ProgressBar label="Monthly" value={progress.m} max={12} color="bg-purple-500" />
                <ProgressBar label="Weekly" value={progress.w} max={52} color="bg-blue-500" />
                <ProgressBar label="Daily" value={progress.d} max={365} color="bg-green-500" />
                <ProgressBar label="Hourly (Live)" value={progress.h} max={8760} color="bg-gray-500" />
            </div>
        </div>
    );
}
