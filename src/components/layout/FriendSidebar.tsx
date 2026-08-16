import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';

export function FriendSidebar() {
    // State persistence
    const [width, setWidth] = useState(() => {
        const stored = localStorage.getItem('account_sidebar_width');
        return stored ? parseInt(stored, 10) : 280;
    });

    const [isCollapsed, setIsCollapsed] = useState(() => {
        const stored = localStorage.getItem('account_sidebar_collapsed');
        return stored === 'true';
    });

    const [isResizing, setIsResizing] = useState(false);

    useEffect(() => localStorage.setItem('account_sidebar_width', width.toString()), [width]);
    useEffect(() => localStorage.setItem('account_sidebar_collapsed', isCollapsed.toString()), [isCollapsed]);

    // Tab Toggle
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Tab' && !e.repeat && !e.shiftKey) {
                e.preventDefault();
                setIsCollapsed(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Width Constraints
    const MIN_WIDTH = 200;
    const MAX_WIDTH = 400;
    const COLLAPSED_WIDTH = 64;

    // Resize Logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
                setWidth(newWidth);
                setIsCollapsed(false);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    const currentWidth = isCollapsed ? COLLAPSED_WIDTH : width;

    // Dummy Data
    const onlineFriends = [
        { name: 'speedcuber99', color: '#f43f5e', status: 'Solving 3x3' },
        { name: 'feliks_fan', color: '#8b5cf6', status: 'Idle' },
        { name: 'cube_wizard', color: '#10b981', status: 'In Menu' },
    ];
    const offlineFriends = [
        { name: 'rubiks_master', color: '#f59e0b', lastSeen: '2h ago' },
        { name: 'blindsolver', color: '#0ea5e9', lastSeen: '5h ago' },
        { name: 'one_hand', color: '#ec4899', lastSeen: '1d ago' },
    ];

    return (
        <div
            className="bg-bg-secondary border-l border-border hidden lg:flex flex-col shrink-0 relative"
            style={{ width: currentWidth }}
        >
            {/* Resize Handle */}
            {!isCollapsed && (
                <div
                    className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/50 z-20"
                    onMouseDown={() => setIsResizing(true)}
                />
            )}

            {isCollapsed ? (
                /* COLLAPSED VIEW */
                <div className="flex flex-col items-center py-6 gap-4 min-w-0 overflow-hidden">
                    <div className="text-text-secondary" title="Friends">
                        <Users className="w-5 h-5" />
                    </div>

                    <div className="w-8 h-[1px] bg-border/50 my-2" />

                    <div className="flex flex-col gap-3">
                        {onlineFriends.map((friend, i) => (
                            <div key={i} className="relative group cursor-pointer" title={`${friend.name} (${friend.status})`}>
                                <div className="w-8 h-8 rounded-lg shadow-sm ring-2 ring-bg-secondary" style={{ backgroundColor: friend.color }} />
                                <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-green-500 border-2 border-bg-secondary rounded-full" />
                            </div>
                        ))}
                    </div>

                    <div className="w-6 h-[1px] bg-border/50 my-2" />

                    <div className="flex flex-col gap-3 opacity-50">
                        {offlineFriends.map((friend, i) => (
                            <div key={i} className="relative group cursor-pointer grayscale" title={`${friend.name} (Last seen ${friend.lastSeen})`}>
                                <div className="w-8 h-8 rounded-lg shadow-sm ring-2 ring-bg-secondary" style={{ backgroundColor: friend.color }} />
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                /* EXPANDED VIEW */
                <div className="flex flex-col p-4 w-full h-full overflow-hidden">
                    <div className="flex items-center gap-2 mb-6 text-text-secondary uppercase text-xs font-bold tracking-wider shrink-0">
                        <Users className="w-4 h-4" /> Friends
                    </div>

                    <div className="overflow-y-auto flex-1 custom-scrollbar pr-2">
                        <div className="mb-6">
                            <h4 className="text-xs font-semibold text-text-secondary mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                                Online ({onlineFriends.length})
                            </h4>
                            <div className="flex flex-col gap-2">
                                {onlineFriends.map((friend, i) => (
                                    <div key={i} className="flex items-center gap-3 p-2 hover:bg-bg-hover rounded-md transition-colors cursor-pointer group">
                                        <div className="relative shrink-0">
                                            <div className="w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: friend.color }} />
                                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-bg-secondary rounded-full" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm font-medium text-text-primary truncate">{friend.name}</span>
                                            <span className="text-[10px] text-text-secondary truncate opacity-80 group-hover:opacity-100">{friend.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-semibold text-text-secondary mb-3">Offline</h4>
                            <div className="flex flex-col gap-2">
                                {offlineFriends.map((friend, i) => (
                                    <div key={i} className="flex items-center gap-3 p-2 hover:bg-bg-hover rounded-md transition-colors cursor-pointer opacity-70 hover:opacity-100">
                                        <div className="relative shrink-0">
                                            <div className="w-8 h-8 rounded-lg shadow-sm grayscale brightness-75" style={{ backgroundColor: friend.color }} />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm font-medium text-text-primary truncate">{friend.name}</span>
                                            <span className="text-[10px] text-text-secondary truncate">Last seen {friend.lastSeen}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
