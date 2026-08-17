import { useState, useEffect, useCallback } from 'react';
import { Sparkles, X, EyeOff } from 'lucide-react';
import type { TimerState } from '../../types';

export const TOOLTIPS_DISABLED_STORAGE_KEY = 'cube-keybind-tooltips-disabled';

export interface TooltipItem {
    id: string;
    badge: string;
    title: string;
    description: string;
}

export const KEYBIND_TOOLTIPS: TooltipItem[] = [
    {
        id: 'space-timer',
        badge: 'Space',
        title: 'Timer Control',
        description: 'Hold Space to prime, release to start. Tap Space or any key to stop.'
    },
    {
        id: 'nxn-puzzles',
        badge: '2 - 7',
        title: 'NxN Scrambles',
        description: 'Press keys 2 through 7 to instantly switch between 2x2 through 7x7 puzzles.'
    },
    {
        id: 'side-puzzles',
        badge: 'S • P • M • C • 1',
        title: 'Puzzle Hotkeys',
        description: 'Press S for Skewb, P for Pyra, M for Mega, C for Clock, or 1 for Sq-1.'
    },
    {
        id: 'post-solve-penalty',
        badge: 'D / F',
        title: 'Quick Penalties (5s)',
        description: 'Within 5s of finishing a solve, press D for DNF or F for +2 (Fault).'
    },
    {
        id: 'nav-hotkeys',
        badge: 'B • G • L • A • Esc',
        title: 'Quick Navigation',
        description: 'Press B for Binds, G for Goals, L for Logs, A for Account, or Esc for Home.'
    },
    {
        id: 'sidebar-toggle',
        badge: 'Tab / Shift',
        title: 'Toggle Sidebars',
        description: 'Press Tab to toggle the right solves bar, or Shift to toggle navigation.'
    },
    {
        id: 'best-session-toggle',
        badge: 'Hidden Feature',
        title: 'Best vs Session Stats',
        description: 'Click "Best" in the right sidebar header to toggle between All-Time Bests & Session stats.'
    },
    {
        id: 'logs-session-filter',
        badge: 'Hidden Feature',
        title: 'Filter Solve Logs',
        description: 'In the Logs page sidebar, click on any session or timeframe to isolate those solves.'
    }
];

export function resetKeybindTooltips() {
    localStorage.removeItem(TOOLTIPS_DISABLED_STORAGE_KEY);
    localStorage.setItem('cube-keybind-tooltips-index', '0');
    window.dispatchEvent(new Event('cube-tooltips-reset'));
}

export function isTooltipsDisabled(): boolean {
    return localStorage.getItem(TOOLTIPS_DISABLED_STORAGE_KEY) === 'true';
}

interface KeybindTooltipProps {
    timerState: TimerState;
    totalSolves: number;
}

export default function KeybindTooltip({ timerState, totalSolves }: KeybindTooltipProps) {
    const [currentTip, setCurrentTip] = useState<TooltipItem | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isDisabled, setIsDisabled] = useState(() => isTooltipsDisabled());

    // Listen for reset events from settings
    useEffect(() => {
        const handleReset = () => {
            setIsDisabled(false);
        };
        window.addEventListener('cube-tooltips-reset', handleReset);
        return () => window.removeEventListener('cube-tooltips-reset', handleReset);
    }, []);

    const showNextTooltip = useCallback(() => {
        if (isDisabled || isTooltipsDisabled()) return;

        const currentIndexStr = localStorage.getItem('cube-keybind-tooltips-index') || '0';
        let index = parseInt(currentIndexStr, 10);
        if (isNaN(index) || index >= KEYBIND_TOOLTIPS.length) {
            index = 0;
        }

        setCurrentTip(KEYBIND_TOOLTIPS[index]);
        setIsVisible(true);

        const nextIndex = (index + 1) % KEYBIND_TOOLTIPS.length;
        localStorage.setItem('cube-keybind-tooltips-index', nextIndex.toString());
    }, [isDisabled]);

    const dismissCurrent = useCallback(() => {
        setIsVisible(false);
        setTimeout(() => setCurrentTip(null), 300);
    }, []);

    const handleNeverShowAgain = useCallback(() => {
        localStorage.setItem(TOOLTIPS_DISABLED_STORAGE_KEY, 'true');
        setIsDisabled(true);
        setIsVisible(false);
        setTimeout(() => setCurrentTip(null), 300);
    }, []);

    // Tooltip display trigger loop (tastefully spaced)
    useEffect(() => {
        if (isDisabled) {
            setIsVisible(false);
            return;
        }

        // Only show when timer is IDLE or SOLVED
        if (timerState === 'RUNNING' || timerState === 'PRIMING') {
            setIsVisible(false);
            return;
        }

        // New accounts (< 15 solves) get tooltips a bit sooner (every 18s idle), veteran accounts every 45s
        const intervalDelay = totalSolves < 15 ? 18000 : 45000;
        const initialDelay = totalSolves < 5 ? 4000 : 12000;

        const initialTimer = setTimeout(() => {
            if (timerState === 'IDLE' || timerState === 'SOLVED') {
                showNextTooltip();
            }
        }, initialDelay);

        const interval = setInterval(() => {
            if (timerState === 'IDLE' || timerState === 'SOLVED') {
                showNextTooltip();
            }
        }, intervalDelay);

        return () => {
            clearTimeout(initialTimer);
            clearInterval(interval);
        };
    }, [timerState, totalSolves, isDisabled, showNextTooltip]);

    // Auto-dismiss current tooltip after 9 seconds of visibility
    useEffect(() => {
        if (!isVisible) return;
        const autoDismissTimer = setTimeout(() => {
            dismissCurrent();
        }, 9000);
        return () => clearTimeout(autoDismissTimer);
    }, [isVisible, dismissCurrent]);

    if (isDisabled || !currentTip || !isVisible) {
        return null;
    }

    return (
        <aside
            aria-label="Tip Notification"
            className="fixed bottom-12 right-6 z-40 max-w-sm w-full animate-in fade-in slide-in-from-bottom-3 duration-300 pointer-events-auto select-none"
        >
            <div className="bg-bg-secondary/95 backdrop-blur-md border border-border/80 shadow-2xl rounded-xl p-3.5 text-xs text-text-primary flex flex-col gap-2.5 transition-all">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
                            <Sparkles className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-text-primary truncate">
                            {currentTip.title}
                        </span>
                        <span className="bg-bg-tertiary border border-border/70 text-text-secondary px-1.5 py-0.5 rounded text-[10px] font-mono font-medium shrink-0">
                            {currentTip.badge}
                        </span>
                    </div>

                    <button
                        onClick={dismissCurrent}
                        className="text-text-secondary/70 hover:text-text-primary p-0.5 rounded transition-colors"
                        title="Dismiss tip"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>

                <p className="text-text-secondary text-[11px] leading-relaxed pl-8">
                    {currentTip.description}
                </p>

                <div className="flex items-center justify-between pt-1 border-t border-border/40 pl-8 text-[10px]">
                    <span className="text-text-secondary/60">Tip</span>
                    <button
                        onClick={handleNeverShowAgain}
                        className="text-text-secondary/60 hover:text-text-secondary transition-colors inline-flex items-center gap-1 cursor-pointer"
                        title="Don't show these tooltips anymore (can be reset in Settings)"
                    >
                        <EyeOff className="w-3 h-3" />
                        <span>Never show again</span>
                    </button>
                </div>
            </div>
        </aside>
    );
}
