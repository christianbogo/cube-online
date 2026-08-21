import type { LeaderboardSlot } from '../../utils/socialCalculations';
import type { UserData } from '../../types';
import { ChevronRight } from 'lucide-react';

export interface SocialLeaderboardCardProps {
    title: string;
    description?: string;
    slots: LeaderboardSlot[];
    onSelectUser: (user: UserData) => void;
}

export function SocialLeaderboardCard({
    title,
    description,
    slots,
    onSelectUser
}: SocialLeaderboardCardProps) {
    const getRankBadge = (rank: number) => {
        switch (rank) {
            case 1:
                return (
                    <div className="w-5 h-5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-500 flex items-center justify-center font-bold text-[11px] shrink-0 shadow-xs">
                        1
                    </div>
                );
            case 2:
                return (
                    <div className="w-5 h-5 rounded-md bg-slate-400/15 border border-slate-400/30 text-slate-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                        2
                    </div>
                );
            case 3:
                return (
                    <div className="w-5 h-5 rounded-md bg-amber-700/15 border border-amber-700/30 text-amber-700 dark:text-amber-600 flex items-center justify-center font-bold text-[11px] shrink-0">
                        3
                    </div>
                );
            default:
                return (
                    <div className="w-5 h-5 rounded-md bg-bg-secondary border border-border/50 text-text-secondary/70 flex items-center justify-center font-mono text-[11px] shrink-0">
                        {rank}
                    </div>
                );
        }
    };

    return (
        <div className="flex flex-col gap-2 w-full select-none">
            {/* Header: Title only, without parenthesis */}
            <div className="flex items-baseline justify-between gap-2 px-0.5">
                <h3 className="font-bold text-xs text-text-primary truncate uppercase tracking-wider">
                    {title}
                </h3>
                {description && (
                    <span className="text-[10px] text-text-secondary truncate">
                        {description}
                    </span>
                )}
            </div>

            {/* 5 Slots */}
            <div className="flex flex-col gap-1 w-full">
                {slots.map(slot => {
                    if (slot.entry) {
                        const { user, scoreDisplay } = slot.entry;

                        return (
                            <div
                                key={user.uid}
                                onClick={() => onSelectUser(user)}
                                className="flex items-center justify-between p-2 rounded-xl border border-border/50 bg-surface-elevation-1 hover:bg-bg-hover hover:border-border transition-all cursor-pointer group select-none shadow-2xs"
                            >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    {getRankBadge(slot.rank)}

                                    {/* Simple User Card: Square Avatar */}
                                    <div
                                        className="w-6 h-6 rounded-md shrink-0 shadow-2xs transition-transform group-hover:scale-105"
                                        style={{ backgroundColor: user.color || '#3b82f6' }}
                                    />

                                    {/* Name + Main Stat directly beneath name */}
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-xs font-bold text-text-primary truncate group-hover:text-accent transition-colors">
                                            {user.username || 'CubingUser'}
                                        </span>
                                        <span className="text-[10px] text-text-secondary font-mono truncate">
                                            {scoreDisplay}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center shrink-0 ml-1.5">
                                    <ChevronRight className="w-3.5 h-3.5 text-text-secondary/40 group-hover:text-text-primary group-hover:translate-x-0.5 transition-all" />
                                </div>
                            </div>
                        );
                    }

                    // Empty Slot (Clean ghost placeholder)
                    return (
                        <div
                            key={`empty-${slot.rank}`}
                            className="flex items-center p-2 rounded-xl border border-dashed border-border/30 bg-bg-secondary/10 text-text-secondary/40 select-none h-[42px]"
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-5 h-5 rounded-md bg-transparent border border-dashed border-border/40 text-text-secondary/30 flex items-center justify-center font-mono text-[11px] shrink-0">
                                    {slot.rank}
                                </div>
                                <div className="w-6 h-6 rounded-md bg-bg-secondary/30 border border-dashed border-border/30 shrink-0" />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
