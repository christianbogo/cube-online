import { useState, useRef, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Topbar from './Topbar';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
import DataSidebar from './DataSidebar';
import { useSolves } from '../contexts/SolvesContext';

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { isPrivateMode, togglePrivateMode, syncStatus } = useSolves();
    // const { confirm: confirmAction } = useConfirm(); // Unused in this version

    // Persistence Helpers
    const getStoredWidth = (key: string, defaultWidth: number) => {
        const stored = localStorage.getItem(key);
        return stored ? parseInt(stored, 10) : defaultWidth;
    };

    const [leftWidth, setLeftWidth] = useState(() => getStoredWidth('sidebar_left_width', 240));
    const [lastOpenLeftWidth, setLastOpenLeftWidth] = useState(() => getStoredWidth('sidebar_left_last_width', 240));
    const [rightWidth, setRightWidth] = useState(() => getStoredWidth('sidebar_right_width', 240));
    const [lastOpenRightWidth, setLastOpenRightWidth] = useState(() => getStoredWidth('sidebar_right_last_width', 240));

    // Data Sidebar State
    const [dataWidth, setDataWidth] = useState(() => getStoredWidth('sidebar_data_width', 300));
    const [isResizingData, setIsResizingData] = useState(false);

    // Toggle States
    const [dataCollapsed, setDataCollapsed] = useState(false);

    // Persistence Effects
    useEffect(() => localStorage.setItem('sidebar_left_width', leftWidth.toString()), [leftWidth]);
    useEffect(() => localStorage.setItem('sidebar_left_last_width', lastOpenLeftWidth.toString()), [lastOpenLeftWidth]);
    useEffect(() => localStorage.setItem('sidebar_right_width', rightWidth.toString()), [rightWidth]);
    useEffect(() => localStorage.setItem('sidebar_right_last_width', lastOpenRightWidth.toString()), [lastOpenRightWidth]);
    useEffect(() => localStorage.setItem('sidebar_data_width', dataWidth.toString()), [dataWidth]);
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

    // Global Keyboard Shortcuts
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Safety: Ignore keybinds if user is typing in an input
            const target = e.target as HTMLElement;
            if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return;

            if (e.key === 'Shift' && !e.repeat) {
                toggleLeftSidebar();
                return;
            }

            if (e.key === 'Tab') {
                if (location.pathname === '/account') return;
                e.preventDefault();
                if (!e.shiftKey) toggleRightSidebar();
                else toggleLeftSidebar();
                return;
            }

            if (e.key === 'Escape') navigate('/');
            if (e.key === '?') navigate('/keybinds');

            if (e.code === 'Space') {
                if (target.tagName === 'BUTTON') {
                    e.preventDefault();
                    target.blur();
                }
            }

            // Shortcuts
            if (e.key === 's') { if (!isPrivateMode) navigate('/data'); else if (confirm('Leave Private Mode?')) { togglePrivateMode(); navigate('/data'); } }
            if (e.key === 'a') { if (!isPrivateMode) navigate('/account'); else if (confirm('Leave Private Mode?')) { togglePrivateMode(); navigate('/account'); } }
            if (e.key === 'c') { if (!isPrivateMode) navigate('/'); else if (confirm('Leave Private Mode?')) { togglePrivateMode(); navigate('/'); } }
            if (e.key === 'd') { if (!isPrivateMode) navigate('/daily'); else if (confirm('Leave Private Mode?')) { togglePrivateMode(); navigate('/daily'); } }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [navigate, toggleLeftSidebar, toggleRightSidebar, location.pathname, isPrivateMode, togglePrivateMode]); // Removed confirmAction dep as it's not used in simple implementation or causing issues

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
            <Topbar />
            <div ref={layoutRef} className="flex-1 flex overflow-hidden relative">
                {/* Left Sidebar */}
                <div style={{ width: leftWidth }} className="flex-shrink-0 relative flex flex-col border-r border-border backdrop-blur-sm will-change-[width] z-30">
                    <LeftSidebar collapsed={isLeftCollapsed} onToggleCollapse={toggleLeftSidebar} />
                    <div className="absolute top-0 right-[-3px] w-1.5 h-full cursor-col-resize z-10 group flex justify-center" onMouseDown={startResizingLeft}>
                        <div className="w-[2px] h-full bg-transparent group-hover:bg-accent/50 transition-colors delay-75" />
                    </div>
                </div>

                {/* Data Sidebar */}
                {location.pathname.startsWith('/data') && (
                    <div style={{ width: dataWidth }} className="flex-shrink-0 relative flex flex-col border-r border-border backdrop-blur-sm bg-bg-secondary will-change-[width] z-20">
                        <DataSidebar onToggleCollapse={() => setDataCollapsed(!dataCollapsed)} collapsed={dataCollapsed} />
                        <div className="absolute top-0 right-[-5px] w-2.5 h-full cursor-col-resize z-50 group flex justify-center" onMouseDown={startResizingData}>
                            <div className="w-[2px] h-full bg-transparent group-hover:bg-accent/50 transition-colors delay-75" />
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <main className="flex-1 flex flex-col relative bg-bg-primary min-w-0 overflow-hidden">
                    <div className={`flex-1 w-full ${(location.pathname.startsWith('/data') || location.pathname === '/account') ? 'overflow-hidden p-0 flex flex-col' : 'p-6 overflow-y-auto custom-scrollbar'}`}>
                        <Outlet />
                    </div>
                    {(!location.pathname.startsWith('/data') && location.pathname !== '/account') && (
                        <footer className="p-2 text-xs text-text-secondary border-t border-border/20 flex justify-between items-center h-8 shrink-0">
                            <div className="flex gap-2 items-center">
                                <span>Online • v0.1.0</span>
                                <SyncIndicator status={syncStatus} />
                                {isPrivateMode && (
                                    <button onClick={() => { if (confirm('Leave private mode?')) togglePrivateMode(); }} className="ml-2 bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded border border-yellow-500/20 uppercase font-bold text-[9px]">
                                        Exit Private Mode
                                    </button>
                                )}
                            </div>
                            {consoleInfo && <div className="text-[10px] text-yellow-500/70 truncate max-w-xs font-mono ml-auto" title={consoleInfo}>⚠️ {consoleInfo}</div>}
                        </footer>
                    )}
                </main>

                {/* Right Sidebar */}
                {location.pathname !== '/account' && location.pathname !== '/data' && (
                    <div style={{ width: rightWidth }} className="flex-shrink-0 relative flex flex-col backdrop-blur-sm will-change-[width] border-l border-border z-20">
                        <div className="absolute top-0 left-[-5px] w-2.5 h-full cursor-col-resize z-50 group flex justify-center" onMouseDown={startResizingRight}>
                            <div className="w-[2px] h-full bg-transparent group-hover:bg-accent/50 transition-colors delay-75" />
                        </div>
                        <RightSidebar collapsed={isRightCollapsed} onToggleCollapse={toggleRightSidebar} />
                    </div>
                )}
            </div>
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

// SessionToast moved to Cube page as per request
