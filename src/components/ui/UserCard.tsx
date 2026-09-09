import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatTime } from '../../utils/formatTime';
import type { TimerState, LiveUser, SimpleSolve } from '../../types';
import { UserAvatar, WcaBadge } from './UserAvatar';
import { hasLinkedWca } from '../../utils/wca';
import { Minimize2 } from 'lucide-react';

export interface UserCardProps {
    user: LiveUser;
    isStarred?: boolean;
    onStar?: (id: string, e: React.MouseEvent) => void;
    onBlock?: (id: string, e: React.MouseEvent) => void;
    onHide?: (id: string, e: React.MouseEvent) => void;
    draggable?: boolean;
    onDragStart?: (e: React.DragEvent) => void;
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
}

export const UserCard = ({ user, onHide, draggable, onDragStart, className = '', onClick }: UserCardProps) => {
    const navigate = useNavigate();
    const isDraggingRef = useRef(false);

    const handleCardClick = (e: React.MouseEvent) => {
        if (isDraggingRef.current) {
            isDraggingRef.current = false;
            return;
        }
        (e.currentTarget as HTMLElement).blur();
        if (onClick) {
            onClick(e);
        } else if (user?.uid) {
            navigate(`/social/${user.shortId || user.uid}`);
        } else {
            navigate('/social');
        }
    };

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
        <div
            draggable={draggable}
            onDragStart={(e) => {
                isDraggingRef.current = true;
                onDragStart?.(e);
            }}
            onDragEnd={() => {
                setTimeout(() => {
                    isDraggingRef.current = false;
                }, 100);
            }}
            onClick={handleCardClick}
            title={`View ${user.username}'s profile`}
            className={`flex-shrink-0 w-36 sm:w-40 h-24 sm:h-28 bg-surface-elevation-1 rounded-xl border flex flex-col relative group hover:shadow-lg hover:z-10 transition-all outline-none focus:outline-none cursor-pointer ${className}
            ${getBorderColor(user.status)}`}
        >
            {/* Header: Avatar + Name + Subtle Hide Button */}
            <div className="relative flex items-center px-2.5 pt-2 pb-0 min-w-0">
                <div className={`flex items-center gap-1.5 overflow-hidden min-w-0 flex-1 ${onHide ? 'group-hover:pr-5 transition-all' : ''}`}>
                    <UserAvatar
                        user={user}
                        className="w-4 h-4 sm:w-4.5 sm:h-4.5 flex-shrink-0 rounded-xs shadow-xs"
                        roundedClassName="rounded-xs"
                    />
                    <span className="font-semibold text-text-primary truncate text-xs sm:text-[13px]">{user.username}</span>
                    {hasLinkedWca(user) && (
                        <span
                            title={`Verified WCA Competitor (${user.wcaId || 'Linked'})`}
                            className="inline-flex items-center align-middle shrink-0"
                        >
                            <WcaBadge user={user} className="w-3.5 h-3.5 drop-shadow-2xs" />
                        </span>
                    )}
                </div>
                {onHide && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onHide(user.uid, e);
                        }}
                        className="absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover cursor-pointer"
                        title={`Minimize ${user.username} to chip`}
                        aria-label={`Minimize ${user.username}`}
                    >
                        <Minimize2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Solves Area */}
            <div className="flex-1 flex flex-col items-center justify-center px-1 pb-2 pt-0.5 gap-0.5 sm:gap-1">
                {/* Main (Recent) Solve */}
                {recent ? (
                    <div className={`${formatTimeStr(recent).length > 5 ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'} font-mono font-medium tracking-tight leading-tight
                        ${recent.penalty === 'DNF' ? 'text-red-500' : 'text-text-primary'}
                    `}>
                        {formatTimeStr(recent)}
                    </div>
                ) : (
                    <div className="text-xl sm:text-2xl text-text-secondary/20 font-mono">--.--</div>
                )}

                {/* History (2 solves after most recent, no background color) */}
                <div className="flex gap-2 leading-none">
                    {[0, 1].map(i => {
                        const s = history[i];
                        if (!s) return <div key={i} className="text-[11px] sm:text-xs font-mono text-text-secondary/25 px-0.5">--.--</div>;
                        return (
                            <div key={i} className={`text-[11px] sm:text-xs font-mono px-0.5
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
