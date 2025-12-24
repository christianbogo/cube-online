import { useState, useRef, useEffect, useCallback } from 'react';
import Topbar from './Topbar';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';

export default function Layout() {
    const [leftWidth, setLeftWidth] = useState(240);
    const [lastOpenLeftWidth, setLastOpenLeftWidth] = useState(240);
    const [rightWidth, setRightWidth] = useState(240);
    const [isResizingLeft, setIsResizingLeft] = useState(false);
    const [isResizingRight, setIsResizingRight] = useState(false);
    const layoutRef = useRef<HTMLDivElement>(null);

    // Constants
    const COLLAPSED_WIDTH = 64;
    const MIN_EXPANDED_WIDTH = 180;
    const MAX_WIDTH = 500;

    const isLeftCollapsed = leftWidth < MIN_EXPANDED_WIDTH;

    const toggleLeftSidebar = useCallback(() => {
        if (isLeftCollapsed) {
            setLeftWidth(lastOpenLeftWidth < MIN_EXPANDED_WIDTH ? 240 : lastOpenLeftWidth);
        } else {
            setLastOpenLeftWidth(leftWidth);
            setLeftWidth(COLLAPSED_WIDTH);
        }
    }, [isLeftCollapsed, leftWidth, lastOpenLeftWidth]);

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

                // Snap to collapsed or clamp
                if (newWidth < MIN_EXPANDED_WIDTH) {
                    // Allow dragging to collapse smoothly or snap?
                    // User said "grown and shrunk on drag". 
                    // Let's allow shrinking until a threshold where it snaps to COLLAPSED_WIDTH
                    if (newWidth < (MIN_EXPANDED_WIDTH + COLLAPSED_WIDTH) / 2) {
                        newWidth = COLLAPSED_WIDTH;
                    } else {
                        newWidth = MIN_EXPANDED_WIDTH;
                    }
                }
                if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH;

                // Make sure we don't overlap right bar too much (optional check)
                setLeftWidth(newWidth);
                if (newWidth >= MIN_EXPANDED_WIDTH) {
                    setLastOpenLeftWidth(newWidth);
                }
            }

            if (isResizingRight) {
                let newWidth = containerRect.right - e.clientX;

                if (newWidth < 100) newWidth = 0; // Snap to closed if desired, or min width
                if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH;
                if (newWidth > 0 && newWidth < 150) newWidth = 150; // Min usable width

                setRightWidth(newWidth);
            }
        },
        [isResizingLeft, isResizingRight, setLastOpenLeftWidth]
    );

    useEffect(() => {
        if (isResizingLeft || isResizingRight) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
            // prevent selection while dragging
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

    return (
        <div className="h-full flex flex-col bg-bg-primary text-text-primary overflow-hidden">
            <Topbar />

            <div
                ref={layoutRef}
                className="flex-1 flex overflow-hidden relative"
            >
                {/* Left Sidebar */}
                <div style={{ width: leftWidth }} className="flex-shrink-0 relative flex flex-col border-r border-border backdrop-blur-sm transition-[width] duration-300 ease-in-out will-change-[width]">
                    <LeftSidebar collapsed={isLeftCollapsed} onToggleCollapse={toggleLeftSidebar} />
                    {/* Drag Handle */}
                    <div
                        className="absolute top-0 right-[-3px] w-1.5 h-full cursor-col-resize hover:bg-accent/50 z-10 transition-colors delay-75"
                        onMouseDown={startResizingLeft}
                    />
                </div>

                {/* Main Content */}
                <main className="flex-1 flex flex-col relative bg-bg-primary min-w-0">
                    <div className="flex-1 p-6 flex flex-col items-center justify-center text-text-secondary">
                        {/* Main page content placeholder */}
                        <div className="text-center">
                            <h2 className="text-xl mb-2 text-text-primary">Ready to Solve</h2>
                            <p className="text-sm">Press Space to start timer (placeholder)</p>
                        </div>
                    </div>

                    {/* Footer */}
                    <footer className="p-2 text-xs text-text-secondary border-t border-border/20 flex justify-between">
                        <div className="flex gap-2">
                            <span>Online • v0.1.0</span>
                        </div>
                        {/* Can add more info */}
                    </footer>
                </main>

                {/* Right Sidebar */}
                <div style={{ width: rightWidth }} className="flex-shrink-0 relative flex flex-col border-l border-border backdrop-blur-sm">
                    <div
                        className="absolute top-0 left-[-3px] w-1.5 h-full cursor-col-resize hover:bg-accent/50 z-10 transition-colors delay-75"
                        onMouseDown={startResizingRight}
                    />
                    <RightSidebar />
                </div>
            </div>
        </div>
    );
}
