import { useMemo, useEffect, useState } from 'react';
import { Calendar, Clock, Trophy, HelpCircle, History, Info } from 'lucide-react';
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

    // Progress Calculations
    const progress = useMemo(() => {
        if (!scrambleStats) return {
            total_solves: 0,
            y_year: 0, m_year: 0, w_year: 0,
            d_month: 0, h_month: 0
        };
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = String(now.getMonth() + 1).padStart(2, '0');

        const count = (arr: string[] | undefined, prefix: string) =>
            (arr || []).filter(id => id.includes(prefix)).length;

        return {
            total_solves: (scrambleStats.completed_hours?.length || 0) + (scrambleStats.completed_days?.length || 0) + (scrambleStats.completed_weeks?.length || 0) + (scrambleStats.completed_months?.length || 0) + (scrambleStats.completed_years?.length || 0),

            // Year Progress (All of 2025)
            y_year: count(scrambleStats.completed_years, `y-${year}`),
            m_year: count(scrambleStats.completed_months, `m-${year}`),
            w_year: count(scrambleStats.completed_weeks, `w-${year}`),

            // Month Progress (Current Month)
            d_month: count(scrambleStats.completed_days, `d-${year}-${month}`), // Correction: days are d-YYYY-MM-DD
            h_month: count(scrambleStats.completed_hours, `h-${year}-${month}`), // Correction: hours are h-YYYY-MM-DD-HH
        };
    }, [scrambleStats]);

    // Calculate max days/hours in current month
    const maxInMonth = useMemo(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const daysInMonth = new Date(year, month, 0).getDate();
        return {
            d: daysInMonth,
            h: daysInMonth * 24
        };
    }, []);

    const ProgressBar = ({ label, value, max, color, icon: Icon }: { label: string, value: number, max: number, color: string, icon?: any }) => {
        const pct = Math.min(100, Math.max(0, (value / max) * 100));
        return (
            <div className="mb-4">
                <div className="flex justify-between text-sm mb-1 items-center">
                    <span className="font-medium text-text-primary flex items-center gap-2">
                        {Icon && <Icon className="w-4 h-4" />} {label}
                    </span>
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
        <div className="w-full h-full flex flex-col text-left overflow-y-auto pb-10">
            <h2 className="text-3xl font-semibold mb-6 text-text-primary">Daily Progress</h2>

            {/* 1. Summary Stats */}
            {scrambleStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-bg-secondary p-4 rounded-lg border border-border/50 flex flex-col items-center justify-center text-center">
                        <Trophy className="w-6 h-6 text-yellow-500 mb-2" />
                        <div className="text-2xl font-bold text-text-primary">{progress.total_solves}</div>
                        <div className="text-xs text-text-secondary">Total Daily Solves</div>
                    </div>
                    <div className="bg-bg-secondary p-4 rounded-lg border border-border/50 flex flex-col items-center justify-center text-center">
                        <div className="text-2xl font-bold text-accent">
                            {((BASE_RATE + (scrambleStats.loot_chance_modifier || 0)) * 100).toFixed(0)}%
                        </div>
                        <div className="text-xs text-text-secondary">Current Drop Chance</div>
                    </div>
                </div>
            )}

            <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* 2. Current Year Progress */}
                <div className="bg-bg-secondary p-6 rounded-lg border border-border animate-in fade-in duration-300">
                    <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-purple-500" /> 2025 Progress
                    </h3>
                    <ProgressBar label="Weeks" value={progress.w_year} max={52} color="bg-blue-500" icon={Calendar} />
                    <ProgressBar label="Months" value={progress.m_year} max={12} color="bg-purple-500" icon={Calendar} />
                </div>

                {/* 3. Current Month Progress */}
                <div className="bg-bg-secondary p-6 rounded-lg border border-border animate-in fade-in duration-300">
                    <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-green-500" /> Current Month
                    </h3>
                    <ProgressBar label="Days" value={progress.d_month} max={maxInMonth.d} color="bg-green-500" icon={Calendar} />
                    <ProgressBar label="Hours" value={progress.h_month} max={maxInMonth.h} color="bg-gray-500" icon={Clock} />
                </div>
            </div>

            {/* 4. Explanation Section */}
            <div className="bg-bg-secondary p-6 rounded-lg border border-border/50">
                <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-text-secondary" /> How Daily Scrambles Work
                </h3>

                <div className="space-y-6">
                    <div>
                        <h4 className="font-medium text-text-primary mb-2 flex items-center gap-2">
                            <History className="w-4 h-4 text-accent" /> The Mining System
                        </h4>
                        <p className="text-sm text-text-secondary leading-relaxed">
                            Unlike traditional dailies that expire, our scrambles are added to a "Mining Pool".
                            If you miss a day or a week, you don't lose the chance to solve it.
                            Instead, your next daily attempt effectively "mines" the backlog, with a higher chance
                            of discovering recent scrambles.
                        </p>
                        <p className="text-sm text-text-secondary leading-relaxed mt-2 text-yellow-500/80">
                            Daily scrambles are currently only available for 3x3 puzzles.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="flex flex-col items-center text-center p-3 bg-bg-tertiary/30 rounded-lg">
                            <div className="w-10 h-10 rounded-full bg-gray-500/20 flex items-center justify-center text-gray-500 font-bold mb-2 text-lg">H</div>
                            <div className="text-xs font-bold text-text-primary">Hourly</div>
                            <div className="text-[10px] text-text-secondary">{lootProbabilities.h}% Chance</div>
                        </div>
                        <div className="flex flex-col items-center text-center p-3 bg-bg-tertiary/30 rounded-lg">
                            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 font-bold mb-2 text-lg">D</div>
                            <div className="text-xs font-bold text-text-primary">Daily</div>
                            <div className="text-[10px] text-text-secondary">{lootProbabilities.d}% Chance</div>
                        </div>
                        <div className="flex flex-col items-center text-center p-3 bg-bg-tertiary/30 rounded-lg">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 font-bold mb-2 text-lg">W</div>
                            <div className="text-xs font-bold text-text-primary">Weekly</div>
                            <div className="text-[10px] text-text-secondary">{lootProbabilities.w}% Chance</div>
                        </div>
                        <div className="flex flex-col items-center text-center p-3 bg-bg-tertiary/30 rounded-lg">
                            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-500 font-bold mb-2 text-lg">M</div>
                            <div className="text-xs font-bold text-text-primary">Monthly</div>
                            <div className="text-[10px] text-text-secondary">{lootProbabilities.m}% Chance</div>
                        </div>
                        <div className="flex flex-col items-center text-center p-3 bg-bg-tertiary/30 rounded-lg">
                            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-500 font-bold mb-2 text-lg">Y</div>
                            <div className="text-xs font-bold text-text-primary">Yearly</div>
                            <div className="text-[10px] text-text-secondary">{lootProbabilities.y}% Chance</div>
                        </div>
                    </div>

                    <div className="text-sm text-text-secondary bg-bg-tertiary/20 p-3 rounded border border-border/30">
                        <div className="flex items-center gap-2 font-medium text-text-primary mb-1">
                            <Info className="w-3 h-3" /> Note
                        </div>
                        Scramble drops are random based on the weights above. If the system picks a "Weekly" scramble, it will look at your history and give you a weekly scramble you haven't completed yet (preferring recent ones).
                    </div>
                </div>
            </div>
        </div>
    );
}
