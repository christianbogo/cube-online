import { useState, useRef, useEffect, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Topbar from './Topbar';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';

export default function Layout() {
    const navigate = useNavigate();
    const [leftWidth, setLeftWidth] = useState(240);
    const [lastOpenLeftWidth, setLastOpenLeftWidth] = useState(240);
    const [rightWidth, setRightWidth] = useState(240);
    const [lastOpenRightWidth, setLastOpenRightWidth] = useState(240); // New state
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
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [navigate, toggleRightSidebar, toggleLeftSidebar]);

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
                        <div className="flex gap-2">
                            <span>Online • v0.1.0</span>
                        </div>
                        {consoleInfo && (
                            <div className="text-[10px] text-yellow-500/70 truncate max-w-xs font-mono ml-auto" title={consoleInfo}>
                                ⚠️ {consoleInfo}
                            </div>
                        )}
                    </footer>
                </main>

                {/* Right Sidebar */}
                <div style={{ width: rightWidth }} className="flex-shrink-0 relative flex flex-col border-l border-border backdrop-blur-sm will-change-[width]">
                    <div
                        className="absolute top-0 left-[-3px] w-1.5 h-full cursor-col-resize hover:bg-accent/50 z-10 transition-colors delay-75"
                        onMouseDown={startResizingRight}
                    />
                    <RightSidebar collapsed={isRightCollapsed} onToggleCollapse={toggleRightSidebar} />
                </div>
            </div>
        </div>
    );
}
