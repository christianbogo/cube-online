import { Star, Ban } from 'lucide-react';
import { formatTime } from '../../utils/formatTime';
import type { TimerState, LiveUser, SimpleSolve } from '../../types';

export interface UserCardProps {
    user: LiveUser;
    isStarred: boolean;
    onStar: (id: string, e: React.MouseEvent) => void;
    onBlock: (id: string, e: React.MouseEvent) => void;
}

export const UserCard = ({ user, isStarred, onStar, onBlock }: UserCardProps) => {
    // Determine Border Color based on Status
    const getBorderColor = (status: TimerState) => {
        switch (status) {
            case 'RUNNING': return 'border-green-500';
            case 'INSPECTION': return 'border-orange-500';
            case 'SOLVED': return 'border-blue-500';
            case 'PRIMING': return 'border-red-500';
            default: return 'border-border';
        }
    };

    // Format Solves Display
    const solves = user.recentSolves || [];
    const recent = solves[0];
    const history = solves.slice(1, 4);

    const formatTimeStr = (s: SimpleSolve) => {
        if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') return 'DNF';
        let t = s.time;
        if (s.penalty === '+2') t += 2000;
        if (s.inspectionPenalty === '+2') t += 2000;
        let str = formatTime(t);
        if (s.penalty === '+2' || s.inspectionPenalty === '+2') str += '+';
        return str;
    };

    const isDaily = (s: SimpleSolve | undefined) => !!s?.daily;

    return (
        <div className={`flex-shrink-0 w-44 h-32 bg-surface-elevation-1 rounded-xl border-2 flex flex-col relative group hover:shadow-lg transition-all
            ${getBorderColor(user.status)}`}
        >
            {/* Header: Avatar + Name + Actions */}
            <div className="flex items-center justify-between p-2 pl-3 pb-1">
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: user.color }} />
                    <span className="font-semibold text-text-primary truncate text-xs">{user.username}</span>
                    {isStarred && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                </div>

                {/* Actions (Visible on Hover) */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => onStar(user.uid, e)}
                        className="text-text-secondary hover:text-yellow-500 p-0.5"
                        title={isStarred ? "Unstar" : "Star User"}
                    >
                        <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                    </button>
                    <button
                        onClick={(e) => onBlock(user.uid, e)}
                        className="text-text-secondary hover:text-red-500 p-0.5"
                        title="Block User"
                    >
                        <Ban className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Solves Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-2 pt-0 gap-1">
                {/* Main (Recent) Solve */}
                {recent ? (
                    <div className={`text-3xl font-mono font-medium tracking-tight
                        ${isDaily(recent) ? 'text-accent' : 'text-text-primary'}
                        ${recent.penalty === 'DNF' ? 'text-red-500' : ''}
                    `}>
                        {formatTimeStr(recent)}
                    </div>
                ) : (
                    <div className="text-2xl text-text-secondary/20 font-mono">--.--</div>
                )}

                {/* History (Small) */}
                <div className="flex gap-2 mt-1">
                    {[0, 1, 2].map(i => {
                        const s = history[i];
                        if (!s) return <div key={i} className="w-8 h-4 bg-black/10 rounded" />;
                        return (
                            <div key={i} className={`text-[10px] font-mono px-1 rounded
                                ${isDaily(s) ? 'text-accent bg-accent/10' : 'text-text-secondary bg-black/20'}
                                ${s.penalty === 'DNF' ? 'text-red-500' : ''}
                            `}>
                                {formatTimeStr(s)}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
