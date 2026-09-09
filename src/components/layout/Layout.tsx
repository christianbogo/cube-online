import { useState, useRef, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../../lib/firebase';
import Topbar from './Topbar';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
import ArenaSidebar from './ArenaSidebar';
import LogsSidebar from './LogsSidebar';
import { useSolves } from '../../contexts/SolvesContext';
import { useAuth } from '../../contexts/AuthContext';
import { useIsMobile } from '../../utils/useIsMobile';
import BottomNav from './BottomNav';

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { syncStatus } = useSolves();
    const { user } = useAuth();
    const isSignInPage = location.pathname === '/account' && !user;
    const isMobile = useIsMobile();
    const isMobileCubePage = isMobile && location.pathname === '/';

    // Online presence and network status
    const [onlineCubersCount, setOnlineCubersCount] = useState<number>(0);
    const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        const presenceRef = ref(rtdb, 'presence');
        const TEN_MINUTES_MS = 10 * 60 * 1000;

        const unsubscribe = onValue(presenceRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const now = Date.now();
                const activeCount = Object.values(data).filter(
                    (u: any) => u && (now - (u.timestamp || 0)) <= TEN_MINUTES_MS
                ).length;
                setOnlineCubersCount(activeCount);
            } else {
                setOnlineCubersCount(0);
            }
        });
        return () => unsubscribe();
    }, []);

    // Persistence Helpers
    const getStoredWidth = (key: string, defaultWidth: number) => {
        const stored = localStorage.getItem(key);
        return stored ? parseInt(stored, 10) : defaultWidth;
    };

    const [leftWidth, setLeftWidth] = useState(() => getStoredWidth('sidebar_left_width', 240));
    const [lastOpenLeftWidth, setLastOpenLeftWidth] = useState(() => getStoredWidth('sidebar_left_last_width', 240));
    const [rightWidth, setRightWidth] = useState(() => getStoredWidth('sidebar_right_width', 240));
    const [lastOpenRightWidth, setLastOpenRightWidth] = useState(() => getStoredWidth('sidebar_right_last_width', 240));

    // Data / Logs Sidebar State
    const [dataWidth, setDataWidth] = useState(() => getStoredWidth('sidebar_data_width', 300));
    const [isResizingData, setIsResizingData] = useState(false);

    // Toggle States
    const [dataCollapsed, setDataCollapsed] = useState(false);

    const knownPrefixes = ['/', '/arena', '/logs', '/social', '/account', '/keybinds', '/goals', '/dev', '/privacy', '/info', '/records', '/data', '/stats', '/callback'];
    const isRoomPage = !knownPrefixes.some(p => location.pathname === p || (p !== '/' && location.pathname.startsWith(p + '/')));

    // Persistence Effects
    useEffect(() => localStorage.setItem('sidebar_left_width', leftWidth.toString()), [leftWidth]);
    useEffect(() => localStorage.setItem('sidebar_left_last_width', lastOpenLeftWidth.toString()), [lastOpenLeftWidth]);
    useEffect(() => localStorage.setItem('sidebar_right_width', rightWidth.toString()), [rightWidth]);
    useEffect(() => localStorage.setItem('sidebar_right_last_width', lastOpenRightWidth.toString()), [lastOpenRightWidth]);
    useEffect(() => localStorage.setItem('sidebar_data_width', dataWidth.toString()), [dataWidth]);

    useEffect(() => {
        const handleCustomWidth = (e: Event) => {
            const customEvent = e as CustomEvent<{ width: number }>;
            if (customEvent.detail && typeof customEvent.detail.width === 'number') {
                setRightWidth(customEvent.detail.width);
                setLastOpenRightWidth(customEvent.detail.width);
            }
        };
        window.addEventListener('arena-sidebar-set-width', handleCustomWidth);
        return () => window.removeEventListener('arena-sidebar-set-width', handleCustomWidth);
    }, []);
    const [isResizingLeft, setIsResizingLeft] = useState(false);
    const [isResizingRight, setIsResizingRight] = useState(false);
    const [consoleInfo, setConsoleInfo] = useState<string | null>(null);
    const layoutRef = useRef<HTMLDivElement>(null);

    // Resizing Constants
    const MIN_EXPANDED_WIDTH = 180;
    const COLLAPSED_WIDTH = 50;
    const RIGHT_COLLAPSED_WIDTH = 50;
    const MAX_WIDTH = 480;

    const isLeftCollapsed = leftWidth <= COLLAPSED_WIDTH;
    const isRightCollapsed = rightWidth <= RIGHT_COLLAPSED_WIDTH;

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

    // Sidebar Toggles
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

    // Global Keyboard Shortcuts and Selection Prevention
    useEffect(() => {
        const handleGlobalPointerUp = (e: MouseEvent | PointerEvent) => {
            const target = e.target as HTMLElement | null;
            if (target) {
                if (target.closest('select, input, textarea, option, [contenteditable="true"]')) {
                    return;
                }
                const interactive = target.closest('a, button, [role="button"]');
                if (interactive && interactive instanceof HTMLElement) {
                    setTimeout(() => {
                        interactive.blur();
                    }, 0);
                }
            }
        };

        window.addEventListener('pointerup', handleGlobalPointerUp);

        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (isSignInPage) return;

            const target = e.target as HTMLElement | null;
            const isTextInput = (el: HTMLElement | null) => el && (
                (el.tagName === 'INPUT' && !['button', 'checkbox', 'radio', 'submit', 'reset'].includes((el as HTMLInputElement).type)) ||
                el.tagName === 'TEXTAREA' ||
                el.isContentEditable
            );

            if (isTextInput(target) || isTextInput(document.activeElement as HTMLElement)) {
                return;
            }

            if (e.code === 'Space' || e.key === ' ') {
                e.preventDefault();
                if (document.activeElement && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
                    document.activeElement.blur();
                }
                if (target && target !== document.body) {
                    target.blur();
                }
            }

            if (e.key === 'Shift' && !e.repeat) {
                toggleLeftSidebar();
                return;
            }

            if (e.key === 'Tab') {
                if (location.pathname === '/account' || location.pathname === '/privacy' || location.pathname === '/info') return;
                e.preventDefault();
                if (!e.shiftKey) toggleRightSidebar();
                else toggleLeftSidebar();
                return;
            }

            if (isRoomPage) {
                return;
            }

            if (e.key === 'Escape') navigate('/');

            // Keybinds Navigation Hotkeys
            if (e.key === 'b' || e.key === 'B' || e.key === '?') {
                navigate('/keybinds');
            }
            if (e.key === 'g' || e.key === 'G') {
                if (!user) return;
                navigate('/goals');
            }
            if (e.key === 'l' || e.key === 'L') {
                if (!user) return;
                navigate('/logs');
            }
            if (e.key === 's' || e.key === 'S') {
                navigate('/social');
            }
            if (e.key === 'a' || e.key === 'A') {
                navigate('/account');
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
        return () => {
            window.removeEventListener('pointerup', handleGlobalPointerUp);
            window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
        };
    }, [navigate, toggleLeftSidebar, toggleRightSidebar, location.pathname, isSignInPage, user, isRoomPage]);

    const startResizingLeft = useCallback(() => setIsResizingLeft(true), []);
    const startResizingRight = useCallback(() => setIsResizingRight(true), []);
    const startResizingData = useCallback(() => setIsResizingData(true), []);
    const stopResizing = useCallback(() => {
        setIsResizingLeft(false);
        setIsResizingRight(false);
        setIsResizingData(false);
    }, []);

    const resize = useCallback(
        (e: MouseEvent) => {
            if (!isResizingLeft && !isResizingRight && !isResizingData) return;
            if (!layoutRef.current) return;

            const containerRect = layoutRef.current.getBoundingClientRect();

            if (isResizingLeft) {
                let newWidth = e.clientX - containerRect.left;
                if (newWidth < MIN_EXPANDED_WIDTH) {
                    if (newWidth < (MIN_EXPANDED_WIDTH + COLLAPSED_WIDTH) / 2) newWidth = COLLAPSED_WIDTH;
                    else newWidth = MIN_EXPANDED_WIDTH;
                }
                if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH;
                setLeftWidth(newWidth);
                if (newWidth >= MIN_EXPANDED_WIDTH) setLastOpenLeftWidth(newWidth);
            }

            if (isResizingRight) {
                let newWidth = containerRect.right - e.clientX;
                if (newWidth < MIN_EXPANDED_WIDTH) {
                    if (newWidth < (MIN_EXPANDED_WIDTH + RIGHT_COLLAPSED_WIDTH) / 2) newWidth = RIGHT_COLLAPSED_WIDTH;
                    else newWidth = MIN_EXPANDED_WIDTH;
                }
                if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH;
                setRightWidth(newWidth);
                if (newWidth >= MIN_EXPANDED_WIDTH) setLastOpenRightWidth(newWidth);
            }

            if (isResizingData) {
                const offset = layoutRef.current.getBoundingClientRect().left + leftWidth;
                let newWidth = e.clientX - offset;
                if (newWidth < 200) newWidth = 200;
                if (newWidth > 500) newWidth = 500;
                setDataWidth(newWidth);
                document.body.style.cursor = 'col-resize';
            }
        },
        [isResizingLeft, isResizingRight, isResizingData, leftWidth]
    );

    useEffect(() => {
        if (isResizingLeft || isResizingRight || isResizingData) {
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
    }, [isResizingLeft, isResizingRight, isResizingData, resize, stopResizing]);

    return (
        <div className="h-screen w-screen bg-bg-primary text-text-primary flex flex-col overflow-hidden font-sans">
            {!isMobileCubePage && <Topbar />}
            <div ref={layoutRef} className={`flex-1 flex flex-col md:flex-row overflow-hidden relative ${isMobileCubePage ? 'pb-0' : 'pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0'}`}>
                {/* Left Sidebar */}
                {!isSignInPage && (
                    <div style={{ width: leftWidth }} className="hidden md:flex flex-shrink-0 relative flex-col border-r border-border backdrop-blur-sm will-change-[width] z-30">
                        <LeftSidebar collapsed={isLeftCollapsed} onToggleCollapse={toggleLeftSidebar} />
                        <div className="absolute top-0 right-[-3px] w-1.5 h-full cursor-col-resize z-10 group flex justify-center" onMouseDown={startResizingLeft}>
                            <div className="w-[2px] h-full bg-transparent group-hover:bg-accent/50 transition-colors delay-75" />
                        </div>
                    </div>
                )}

                {/* Logs Sidebar */}
                {location.pathname.startsWith('/logs') && (
                    <div style={{ width: isMobile ? '100%' : dataWidth, height: isMobile ? 'auto' : '100%' }} className="flex-shrink-0 relative flex flex-col border-b md:border-b-0 md:border-r border-border backdrop-blur-sm bg-bg-secondary will-change-[width] z-20 transition-all">
                        <LogsSidebar onToggleCollapse={() => setDataCollapsed(!dataCollapsed)} collapsed={dataCollapsed} />
                        {!isMobile && (
                            <div className="absolute top-0 right-[-5px] w-2.5 h-full cursor-col-resize z-50 group flex justify-center" onMouseDown={startResizingData}>
                                <div className="w-[2px] h-full bg-transparent group-hover:bg-accent/50 transition-colors delay-75" />
                            </div>
                        )}
                    </div>
                )}

                {/* Main Content */}
                <main className="flex-1 flex flex-col relative bg-bg-primary min-w-0 overflow-hidden">
                    <div className={`flex-1 w-full ${(location.pathname.startsWith('/logs') || location.pathname === '/account' || location.pathname === '/' || location.pathname.startsWith('/arena') || isRoomPage) ? (location.pathname === '/' ? (isMobile ? 'overflow-hidden p-0 flex flex-col h-full' : 'overflow-hidden pt-1.5 px-2 pb-1.5 flex flex-col') : 'overflow-hidden p-0 flex flex-col') : 'p-2 sm:p-3 overflow-y-auto custom-scrollbar'}`}>
                        <Outlet />
                    </div>
                    {(!location.pathname.startsWith('/logs') && location.pathname !== '/account' && !isMobileCubePage) && (
                        <footer className="p-2 text-xs text-text-secondary border-t border-border/20 flex justify-between items-center h-8 shrink-0">
                            <div className="flex gap-2 items-center">
                                <span>{isOnline ? 'Online' : 'Offline'} • v0.4.0</span>
                                <SyncIndicator status={syncStatus} />
                            </div>
                            <div className="flex items-center gap-3">
                                {consoleInfo && <div className="text-[10px] text-yellow-500/70 truncate max-w-xs font-mono" title={consoleInfo}>{consoleInfo}</div>}
                                <div className="flex items-center gap-1.5 font-mono text-[11px] text-text-secondary">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                                    <span>{onlineCubersCount} cuber{onlineCubersCount === 1 ? '' : 's'} online</span>
                                </div>
                            </div>
                        </footer>
                    )}
                </main>

                {/* Right Sidebar */}
                {!['/account', '/logs', '/keybinds', '/dev', '/privacy', '/info'].some(p => location.pathname.startsWith(p)) && (
                    <div
                        style={{ width: rightWidth }}
                        className={`hidden md:flex flex-shrink-0 relative flex-col backdrop-blur-sm will-change-[width] border-l border-border z-20 ${isResizingRight ? '' : 'transition-[width] duration-200 ease-out'}`}
                    >
                        <div className="absolute top-0 left-[-5px] w-2.5 h-full cursor-col-resize z-50 group flex justify-center" onMouseDown={startResizingRight}>
                            <div className="w-[2px] h-full bg-transparent group-hover:bg-accent/50 transition-colors delay-75" />
                        </div>
                        {isRoomPage ? (
                            <ArenaSidebar
                                collapsed={isRightCollapsed}
                                onToggleCollapse={toggleRightSidebar}
                                onSetWidth={(w) => {
                                    setRightWidth(w);
                                    setLastOpenRightWidth(w);
                                }}
                            />
                        ) : (
                            <RightSidebar collapsed={isRightCollapsed} onToggleCollapse={toggleRightSidebar} />
                        )}
                    </div>
                )}
            </div>
            {!isMobileCubePage && <BottomNav />}
        </div>
    );
}

function SyncIndicator({ status }: { status: string }) {
    if (status === 'idle') return null;
    return (
        <span className={`transition-opacity duration-500 ${status === 'syncing' ? 'opacity-100' : 'opacity-50'} text-[10px] uppercase tracking-wider font-semibold text-text-secondary/50 flex items-center gap-1`}>
            {status === 'syncing' ? 'Syncing...' : status === 'synced' ? 'Synced' : 'Sync Error'}
        </span>
    );
}
