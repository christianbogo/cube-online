import { useState, useRef, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Topbar from './Topbar';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
import SessionsSidebar from './SessionsSidebar';
import { useSolves } from '../contexts/SolvesContext';
import { useConfirm } from '../contexts/ConfirmationContext';

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { isPrivateMode, togglePrivateMode } = useSolves();
    const { confirm: confirmAction } = useConfirm();

    // Persistence Helpers
    const getStoredWidth = (key: string, defaultWidth: number) => {
        const stored = localStorage.getItem(key);
        return stored ? parseInt(stored, 10) : defaultWidth;
    };

    const [leftWidth, setLeftWidth] = useState(() => getStoredWidth('sidebar_left_width', 240));
    const [lastOpenLeftWidth, setLastOpenLeftWidth] = useState(() => getStoredWidth('sidebar_left_last_width', 240));
    const [rightWidth, setRightWidth] = useState(() => getStoredWidth('sidebar_right_width', 240));
    const [lastOpenRightWidth, setLastOpenRightWidth] = useState(() => getStoredWidth('sidebar_right_last_width', 240));

    // Persistence Effects
    useEffect(() => localStorage.setItem('sidebar_left_width', leftWidth.toString()), [leftWidth]);
    useEffect(() => localStorage.setItem('sidebar_left_last_width', lastOpenLeftWidth.toString()), [lastOpenLeftWidth]);
    useEffect(() => localStorage.setItem('sidebar_right_width', rightWidth.toString()), [rightWidth]);
    useEffect(() => localStorage.setItem('sidebar_right_last_width', lastOpenRightWidth.toString()), [lastOpenRightWidth]);
    const [isResizingLeft, setIsResizingLeft] = useState(false);
    const [isResizingRight, setIsResizingRight] = useState(false);
    const [consoleInfo, setConsoleInfo] = useState<string | null>(null); // For footer
    const layoutRef = useRef<HTMLDivElement>(null);

    // Constants
    const COLLAPSED_WIDTH = 64;
    const MIN_EXPANDED_WIDTH = 180;
    const MAX_WIDTH = 500;
    const RIGHT_COLLAPSED_WIDTH = 50;

    const isLeftCollapsed = leftWidth < MIN_EXPANDED_WIDTH;
    const isRightCollapsed = rightWidth < MIN_EXPANDED_WIDTH;

    // Console interceptor
    useEffect(() => {
        const originalWarn = console.warn;
        console.warn = (...args) => {
            const msg = args.map(a => a.toString()).join(' ');
            if (msg.includes('cubing/scramble')) {
                setConsoleInfo(msg.slice(0, 100));
            }
            originalWarn.apply(console, args);
        };
        return () => {
            console.warn = originalWarn;
        };
    }, []);

    // Global ESC Shortcut
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                navigate('/');
            }
            if (e.key === '?') {
                navigate('/keybinds');
            }

            // Global Spacebar Focus Prevention for Buttons
            if (e.code === 'Space') {
                const target = e.target as HTMLElement;
                if (target.tagName === 'BUTTON') {
                    e.preventDefault();
                    target.blur();
                }
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [navigate]);

    const toggleLeftSidebar = useCallback(() => {
        if (isLeftCollapsed) {
            setLeftWidth(lastOpenLeftWidth < MIN_EXPANDED_WIDTH ? 240 : lastOpenLeftWidth);
        } else {
            setLastOpenLeftWidth(leftWidth);
            setLeftWidth(COLLAPSED_WIDTH);
        }
    }, [isLeftCollapsed, leftWidth, lastOpenLeftWidth]);

    const toggleRightSidebar = useCallback(() => {
        if (isRightCollapsed) {
            setRightWidth(lastOpenRightWidth < MIN_EXPANDED_WIDTH ? 240 : lastOpenRightWidth);
        } else {
            setLastOpenRightWidth(rightWidth);
            setRightWidth(RIGHT_COLLAPSED_WIDTH);
        }
    }, [isRightCollapsed, rightWidth, lastOpenRightWidth]);

    const startResizingLeft = useCallback(() => setIsResizingLeft(true), []);
    const startResizingRight = useCallback(() => setIsResizingRight(true), []);
    const stopResizing = useCallback(() => {
        setIsResizingLeft(false);
        setIsResizingRight(false);
    }, []);

    const resize = useCallback(
        (e: MouseEvent) => {
            if (!isResizingLeft && !isResizingRight) return;
            if (!layoutRef.current) return;

            const containerRect = layoutRef.current.getBoundingClientRect();

            if (isResizingLeft) {
                let newWidth = e.clientX - containerRect.left;

                if (newWidth < MIN_EXPANDED_WIDTH) {
                    if (newWidth < (MIN_EXPANDED_WIDTH + COLLAPSED_WIDTH) / 2) {
                        newWidth = COLLAPSED_WIDTH;
                    } else {
                        newWidth = MIN_EXPANDED_WIDTH;
                    }
                }
                if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH;
                setLeftWidth(newWidth);
                if (newWidth >= MIN_EXPANDED_WIDTH) {
                    setLastOpenLeftWidth(newWidth);
                }
            }

            if (isResizingRight) {
                let newWidth = containerRect.right - e.clientX;

                if (newWidth < MIN_EXPANDED_WIDTH) {
                    if (newWidth < (MIN_EXPANDED_WIDTH + RIGHT_COLLAPSED_WIDTH) / 2) {
                        newWidth = RIGHT_COLLAPSED_WIDTH;
                    } else {
                        newWidth = MIN_EXPANDED_WIDTH;
                    }
                }
                if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH;

                setRightWidth(newWidth);
                if (newWidth >= MIN_EXPANDED_WIDTH) {
                    setLastOpenRightWidth(newWidth);
                }
            }
        },
        [isResizingLeft, isResizingRight, setLastOpenLeftWidth, setLastOpenRightWidth]
    );

    useEffect(() => {
        if (isResizingLeft || isResizingRight) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [isResizingLeft, isResizingRight, resize, stopResizing]);

    // Global Shortcuts
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Ignore if input/textarea is focused
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) {
                return;
            }

            if (e.key === 'Escape') {
                navigate('/');
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                toggleRightSidebar();
            }
            if (e.key === 'Shift') {
                if (!e.repeat) {
                    toggleLeftSidebar();
                }
            }
            // Navigation Shortcuts
            const handleNav = async (path: string) => {
                if (isPrivateMode) {
                    if (await confirmAction('Leave Private Mode?')) {
                        togglePrivateMode();
                        navigate(path);
                    }
                } else {
                    navigate(path);
                }
            };

            if (e.key === 's') handleNav('/data');
            if (e.key === 'a') handleNav('/account');
            if (e.key === 'c') handleNav('/');
            if (e.key === 'd') handleNav('/daily');
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [navigate, toggleRightSidebar, toggleLeftSidebar, isPrivateMode, togglePrivateMode, confirmAction]);

    return (
        <div className="h-full flex flex-col bg-bg-primary text-text-primary overflow-hidden">
            <Topbar />

            <div
                ref={layoutRef}
                className="flex-1 flex overflow-hidden relative"
            >
                {/* Left Sidebar */}
                <div style={{ width: leftWidth }} className="flex-shrink-0 relative flex flex-col border-r border-border backdrop-blur-sm will-change-[width]">
                    <LeftSidebar collapsed={isLeftCollapsed} onToggleCollapse={toggleLeftSidebar} />
                    {/* Drag Handle */}
                    <div
                        className="absolute top-0 right-[-3px] w-1.5 h-full cursor-col-resize hover:bg-accent/50 z-10 transition-colors delay-75"
                        onMouseDown={startResizingLeft}
                    />
                </div>

                {/* Main Content */}
                <main className="flex-1 flex flex-col relative bg-bg-primary min-w-0">
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar w-full">
                        <Outlet />
                    </div>

                    {/* Footer */}
                    <footer className="p-2 text-xs text-text-secondary border-t border-border/20 flex justify-between items-center h-8">
                        <div className="flex gap-2 items-center">
                            <span>Online • v0.1.0</span>
                            <SyncIndicator />
                            {isPrivateMode && (
                                <button
                                    onClick={async () => {
                                        if (await confirmAction('Leave Private Mode?')) {
                                            togglePrivateMode();
                                        }
                                    }}
                                    className="ml-2 bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors uppercase tracking-wider font-bold text-[9px]"
                                >
                                    Exit Private Mode
                                </button>
                            )}
                        </div>
                        {consoleInfo && (
                            <div className="text-[10px] text-yellow-500/70 truncate max-w-xs font-mono ml-auto" title={consoleInfo}>
                                ⚠️ {consoleInfo}
                            </div>
                        )}
                    </footer>
                </main>

                {/* Right Sidebar - Hidden on Account Page */}
                {location.pathname !== '/account' && (
                    <div style={{ width: rightWidth }} className="flex-shrink-0 relative flex flex-col backdrop-blur-sm will-change-[width]">
                        <div
                            className="absolute top-0 left-[-3px] w-1.5 h-full cursor-col-resize hover:bg-accent/50 z-10 transition-colors delay-75"
                            onMouseDown={startResizingRight}
                        />
                        {location.pathname === '/data' ? (
                            <SessionsSidebar collapsed={isRightCollapsed} onToggleCollapse={toggleRightSidebar} />
                        ) : (
                            <RightSidebar collapsed={isRightCollapsed} onToggleCollapse={toggleRightSidebar} />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function SyncIndicator() {
    const { syncStatus } = useSolves();

    if (syncStatus === 'idle') return null;

    return (
        <span className={`transition-opacity duration-500 ${syncStatus === 'syncing' ? 'opacity-100' : 'opacity-50'} text-[10px] uppercase tracking-wider font-semibold text-text-secondary/50 flex items-center gap-1`}>
            {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'synced' ? 'Synced' : 'Sync Error'}
        </span>
    );
}

// SessionToast moved to Cube page as per request
