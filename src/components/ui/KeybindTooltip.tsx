import { useState, useEffect, useCallback } from 'react';
import { useIsMobile } from '../../utils/useIsMobile';
import { useLocation } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationsContext';
import type { TimerState } from '../../types';

export const TOOLTIPS_DISABLED_STORAGE_KEY = 'cube-keybind-tooltips-disabled';
export const TOOLTIPS_EVENT = 'cube-tooltips-updated';

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
        id: 'pass-scramble',
        badge: 'P',
        title: 'Pass Scramble',
        description: 'Press P on the keyboard to pass the current scramble and get a fresh one.'
    },
    {
        id: 'side-puzzles',
        badge: 'F • K • Y • M • C • 1',
        title: 'Puzzle Hotkeys',
        description: 'Press F for FTO, K for Skewb, Y for Pyra, M for Mega, C for Clock, or 1 for Sq-1.'
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

export function setTooltipsDisabled(disabled: boolean) {
    if (disabled) {
        localStorage.setItem(TOOLTIPS_DISABLED_STORAGE_KEY, 'true');
    } else {
        localStorage.removeItem(TOOLTIPS_DISABLED_STORAGE_KEY);
    }
    window.dispatchEvent(new Event(TOOLTIPS_EVENT));
}

export function resetKeybindTooltips() {
    localStorage.removeItem(TOOLTIPS_DISABLED_STORAGE_KEY);
    localStorage.setItem('cube-keybind-tooltips-index', '0');
    window.dispatchEvent(new Event(TOOLTIPS_EVENT));
}

export function isTooltipsDisabled(): boolean {
    return localStorage.getItem(TOOLTIPS_DISABLED_STORAGE_KEY) === 'true';
}

interface KeybindTooltipProps {
    timerState: TimerState;
    totalSolves: number;
}

export default function KeybindTooltip({ timerState, totalSolves }: KeybindTooltipProps) {
    const location = useLocation();
    const isMobile = useIsMobile();
    const { upsertNotification } = useNotifications();
    const [isDisabled, setIsDisabled] = useState(() => isTooltipsDisabled());

    // Listen for reset/update events from settings
    useEffect(() => {
        const handleUpdate = () => {
            setIsDisabled(isTooltipsDisabled());
        };
        window.addEventListener(TOOLTIPS_EVENT, handleUpdate);
        window.addEventListener('cube-tooltips-reset', handleUpdate);
        return () => {
            window.removeEventListener(TOOLTIPS_EVENT, handleUpdate);
            window.removeEventListener('cube-tooltips-reset', handleUpdate);
        };
    }, []);

    const showNextTooltip = useCallback(() => {
        if (isDisabled || isTooltipsDisabled() || location.pathname !== '/' || isMobile) return;

        const currentIndexStr = localStorage.getItem('cube-keybind-tooltips-index') || '0';
        let index = parseInt(currentIndexStr, 10);
        if (isNaN(index) || index >= KEYBIND_TOOLTIPS.length) {
            index = 0;
        }

        const tip = KEYBIND_TOOLTIPS[index];
        upsertNotification({
            id: `tip-${tip.id}`,
            type: 'system',
            title: `Tip: ${tip.title}`,
            description: tip.description,
            metadata: { badge: tip.badge }
        });

        const nextIndex = (index + 1) % KEYBIND_TOOLTIPS.length;
        localStorage.setItem('cube-keybind-tooltips-index', nextIndex.toString());
    }, [isDisabled, location.pathname, isMobile, upsertNotification]);

    // Tooltip display trigger loop (spaced out widely)
    useEffect(() => {
        if (isDisabled || location.pathname !== '/') {
            return;
        }

        // Only show when timer is IDLE or SOLVED
        if (timerState === 'RUNNING' || timerState === 'PRIMING') {
            return;
        }

        // Spaced out: new accounts every 45s idle, veteran accounts every 120s (2 min)
        const intervalDelay = totalSolves < 15 ? 45000 : 120000;
        const initialDelay = totalSolves < 5 ? 35000 : 60000;

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
    }, [timerState, totalSolves, isDisabled, location.pathname, showNextTooltip]);

    return null;
}
