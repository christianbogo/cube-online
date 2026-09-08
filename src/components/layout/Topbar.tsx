import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmationContext';
import { Logo } from '../ui/Logo';
import { UserAvatar, WcaBadge } from '../ui/UserAvatar';
import { hasLinkedWca } from '../../utils/wca';
import { SlidersHorizontal, Info } from 'lucide-react';
import TimerSettingsModal from '../timer/TimerSettingsModal';
import { NotificationBell } from '../notifications';

export default function Topbar() {
    const { user } = useAuth();
    const { confirm } = useConfirm();
    const navigate = useNavigate();
    const location = useLocation();
    const [isTimerSettingsOpen, setIsTimerSettingsOpen] = useState(false);

    const knownPrefixes = ['/', '/arena', '/logs', '/social', '/account', '/keybinds', '/goals', '/dev', '/privacy', '/info', '/records', '/data', '/stats', '/callback'];
    const isRoomPage = !knownPrefixes.some(p => location.pathname === p || (p !== '/' && location.pathname.startsWith(p + '/')));
    const isArenaOrRoom = location.pathname === '/arena' || isRoomPage;

    const handleArenaLeavingNavigation = async (targetPath: string, state?: any) => {
        if (isRoomPage) {
            const ok = await confirm('Are you sure you want to leave the Arena?', { confirmText: 'Leave', isDanger: true });
            if (!ok) return false;
        }
        navigate(targetPath, state ? { state } : undefined);
        return true;
    };

    return (
        <>
            <header className="h-topbar pt-safe bg-bg-secondary border-b border-border flex items-center justify-between px-4 shrink-0 select-none z-[70] transition-colors duration-200 relative">
                {/* Left Side: Logo/Brand */}
                <div className="flex items-center gap-3">
                    <Link
                        to="/"
                        onClick={async (e) => {
                            (e.currentTarget as HTMLElement).blur();
                            if (isRoomPage) {
                                e.preventDefault();
                                const ok = await confirm('Are you sure you want to leave the Arena?', { confirmText: 'Leave', isDanger: true });
                                if (!ok) return;
                                navigate('/');
                            }
                        }}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity outline-none focus:outline-none"
                    >
                        <Logo className="w-6 h-6" />
                        <span className="font-semibold text-lg tracking-tight text-text-primary">Cube Online</span>
                    </Link>
                </div>

                {/* Center: Timer Settings Link */}
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-auto">
                    <button
                        type="button"
                        onClick={(e) => {
                            (e.currentTarget as HTMLElement).blur();
                            setIsTimerSettingsOpen(true);
                        }}
                        className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer outline-none focus:outline-none py-1"
                        title="Timer Settings"
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>Timer Settings</span>
                    </button>
                </div>

            {/* Right Side: Auth / Profile */}
            <div className="flex items-center gap-0.5 sm:gap-1">
                <Link
                    to="/info"
                    onClick={async (e) => {
                        (e.currentTarget as HTMLElement).blur();
                        if (isRoomPage) {
                            e.preventDefault();
                            const ok = await confirm('Are you sure you want to leave the Arena?', { confirmText: 'Leave', isDanger: true });
                            if (!ok) return;
                            navigate('/info');
                        }
                    }}
                    className={`relative p-2 rounded-lg transition-colors outline-none focus:outline-none flex items-center justify-center ${
                        location.pathname === '/info'
                            ? 'bg-bg-tertiary text-text-primary'
                            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                    }`}
                    title="Documentation & Features"
                    aria-label="Documentation & Features"
                >
                    <Info className="w-5 h-5" />
                </Link>
                <NotificationBell />
                {user && !user.isAnonymous ? (
                    <Link
                        to="/account"
                        onClick={async (e) => {
                            (e.currentTarget as HTMLElement).blur();
                            if (isRoomPage) {
                                e.preventDefault();
                                const ok = await confirm('Are you sure you want to leave the Arena?', { confirmText: 'Leave', isDanger: true });
                                if (!ok) return;
                                navigate('/account');
                            }
                        }}
                        className="flex items-center gap-2 py-1 pl-2 pr-1 rounded-lg hover:bg-bg-hover transition-colors border border-transparent hover:border-border/50 outline-none focus:outline-none"
                    >
                        <div className="items-center gap-1.5 hidden sm:flex">
                            <span className="font-medium text-sm text-text-primary">
                                {user.username || 'CubingUser'}
                            </span>
                            {hasLinkedWca(user) && (
                                <span
                                    title={`Verified WCA Competitor (${user.wcaId || 'Linked'})`}
                                    className="inline-flex items-center align-middle shrink-0"
                                >
                                    <WcaBadge user={user} className="w-3.5 h-3.5 drop-shadow-2xs" />
                                </span>
                            )}
                        </div>
                        <UserAvatar
                            user={user}
                            className="w-8 h-8 rounded-lg shadow-sm flex items-center justify-center font-bold text-white text-xs"
                            roundedClassName="rounded-lg"
                        />
                    </Link>
                ) : (
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={async (e) => {
                                (e.currentTarget as HTMLElement).blur();
                                await handleArenaLeavingNavigation('/account', { mode: 'signin' });
                            }}
                            className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors px-2 py-1 cursor-pointer outline-none focus:outline-none"
                        >
                            Sign In
                        </button>
                        <button
                            onClick={async (e) => {
                                (e.currentTarget as HTMLElement).blur();
                                await handleArenaLeavingNavigation('/account', { mode: 'signup' });
                            }}
                            className="text-sm font-medium bg-text-primary text-bg-primary hover:opacity-90 transition-opacity px-3 py-1 rounded-md cursor-pointer outline-none focus:outline-none"
                        >
                            Sign Up
                        </button>
                    </div>
                )}
            </div>
        </header>

        <TimerSettingsModal
            isOpen={isTimerSettingsOpen}
            onClose={() => setIsTimerSettingsOpen(false)}
        />
    </>
    );
}
