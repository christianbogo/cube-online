import { formatTime } from '../../utils/formatTime';
import type { TimerState, LiveUser, SimpleSolve } from '../../types';
import { Minimize2 } from 'lucide-react';

export interface UserCardProps {
    user: LiveUser;
    isStarred?: boolean;
    onStar?: (id: string, e: React.MouseEvent) => void;
    onBlock?: (id: string, e: React.MouseEvent) => void;
    onHide?: (id: string, e: React.MouseEvent) => void;
}

export const UserCard = ({ user, onHide }: UserCardProps) => {
    // Determine Border Color based on Status
    const getBorderColor = (status: TimerState) => {
        switch (status) {
            case 'RUNNING': return 'border-green-500';
            case 'INSPECTION': return 'border-orange-500';
            case 'PRIMING': return 'border-red-500';
            default: return 'border-border';
        }
    };

    // Format Solves Display
    const solves = user.recentSolves || [];
    const recent = solves[0];
    const history = solves.slice(1, 3);

    const formatTimeStr = (s: SimpleSolve) => {
        if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') return 'DNF';
        let t = s.time;
        if (s.penalty === '+2') t += 2000;
        if (s.inspectionPenalty === '+2') t += 2000;
        let str = formatTime(t);
        if (s.penalty === '+2' || s.inspectionPenalty === '+2') str += '+';
        return str;
    };

    return (
        <div className={`flex-shrink-0 w-44 h-32 bg-surface-elevation-1 rounded-xl border-2 flex flex-col relative group hover:shadow-lg transition-all outline-none focus:outline-none
            ${getBorderColor(user.status)}`}
        >
            {/* Header: Rounded Square Avatar + Name + Subtle Hide Button */}
            <div className="flex items-center justify-between p-2 pl-3 pb-1">
                <div className="flex items-center gap-2 overflow-hidden min-w-0 flex-1">
                    <div
                        className="w-3 h-3 rounded-md flex-shrink-0 shadow-xs"
                        style={{ backgroundColor: user.color }}
                    />
                    <span className="font-semibold text-text-primary truncate text-xs">{user.username}</span>
                </div>
                {onHide && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onHide(user.uid, e);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 -mr-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover cursor-pointer"
                        title={`Minimize ${user.username} to chip`}
                        aria-label={`Minimize ${user.username}`}
                    >
                        <Minimize2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Solves Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-2 pt-0 gap-1">
                {/* Main (Recent) Solve */}
                {recent ? (
                    <div className={`text-3xl font-mono font-medium tracking-tight
                        ${recent.penalty === 'DNF' ? 'text-red-500' : 'text-text-primary'}
                    `}>
                        {formatTimeStr(recent)}
                    </div>
                ) : (
                    <div className="text-2xl text-text-secondary/20 font-mono">--.--</div>
                )}

                {/* History (2 solves after most recent, no background color) */}
                <div className="flex gap-2 mt-1">
                    {[0, 1].map(i => {
                        const s = history[i];
                        if (!s) return <div key={i} className="text-[10px] font-mono text-text-secondary/25 px-1">--.--</div>;
                        return (
                            <div key={i} className={`text-[10px] font-mono px-1
                                ${s.penalty === 'DNF' ? 'text-red-500' : 'text-text-secondary'}
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
