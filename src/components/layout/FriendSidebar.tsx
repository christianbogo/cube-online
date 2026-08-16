import { useState, useEffect } from 'react';
import { Users, GripVertical, ChevronRight, ChevronDown } from 'lucide-react';

export interface FriendItem {
    id: string;
    name: string;
    color: string;
    status?: string;
    lastSeen?: string;
}

const DEFAULT_ONLINE: FriendItem[] = [
    { id: 'f1', name: 'speedcuber99', color: '#f43f5e', status: 'Solving 3x3' },
    { id: 'f2', name: 'feliks_fan', color: '#8b5cf6', status: 'Idle' },
    { id: 'f3', name: 'cube_wizard', color: '#10b981', status: 'In Menu' },
];

const DEFAULT_OFFLINE: FriendItem[] = [
    { id: 'f4', name: 'rubiks_master', color: '#f59e0b', lastSeen: '2h ago' },
    { id: 'f5', name: 'blindsolver', color: '#0ea5e9', lastSeen: '5h ago' },
    { id: 'f6', name: 'one_hand', color: '#ec4899', lastSeen: '1d ago' },
];

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

    // Friend list ordering state
    const [onlineFriends, setOnlineFriends] = useState<FriendItem[]>(() => {
        const stored = localStorage.getItem('cutter_friends_order_online');
        if (stored) {
            try { return JSON.parse(stored); } catch { /* ignore */ }
        }
        return DEFAULT_ONLINE;
    });

    const [offlineFriends, setOfflineFriends] = useState<FriendItem[]>(() => {
        const stored = localStorage.getItem('cutter_friends_order_offline');
        if (stored) {
            try { return JSON.parse(stored); } catch { /* ignore */ }
        }
        return DEFAULT_OFFLINE;
    });

    useEffect(() => {
        localStorage.setItem('cutter_friends_order_online', JSON.stringify(onlineFriends));
    }, [onlineFriends]);

    useEffect(() => {
        localStorage.setItem('cutter_friends_order_offline', JSON.stringify(offlineFriends));
    }, [offlineFriends]);

    // Section collapse / expansion states
    const [onlineExpanded, setOnlineExpanded] = useState(true);
    const [offlineExpanded, setOfflineExpanded] = useState(true);

    // Drag & drop state
    const [draggedItem, setDraggedItem] = useState<{ id: string; section: 'online' | 'offline' } | null>(null);
    const [dragOverItem, setDragOverItem] = useState<{ id: string; section: 'online' | 'offline' } | null>(null);

    // Width Constraints
    const MIN_WIDTH = 220;
    const MAX_WIDTH = 450;
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

    // Drag & Drop Handlers
    const handleDragStart = (id: string, section: 'online' | 'offline', e: React.DragEvent) => {
        setDraggedItem({ id, section });
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
    };

    const handleDragOver = (id: string, section: 'online' | 'offline', e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!dragOverItem || dragOverItem.id !== id || dragOverItem.section !== section) {
            setDragOverItem({ id, section });
        }
    };

    const handleDrop = (targetId: string, targetSection: 'online' | 'offline', e: React.DragEvent) => {
        e.preventDefault();
        if (!draggedItem) return;

        if (draggedItem.section === targetSection) {
            const list = targetSection === 'online' ? [...onlineFriends] : [...offlineFriends];
            const fromIndex = list.findIndex(item => item.id === draggedItem.id);
            const toIndex = list.findIndex(item => item.id === targetId);

            if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
                const [moved] = list.splice(fromIndex, 1);
                list.splice(toIndex, 0, moved);
                if (targetSection === 'online') {
                    setOnlineFriends(list);
                } else {
                    setOfflineFriends(list);
                }
            }
        }

        setDraggedItem(null);
        setDragOverItem(null);
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
        setDragOverItem(null);
    };

    return (
        <div
            className="bg-bg-secondary border-l border-border hidden lg:flex flex-col shrink-0 relative select-none transition-all duration-200"
            style={{ width: currentWidth }}
        >
            {/* Resize Handle */}
            {!isCollapsed && (
                <div
                    className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/50 z-20"
                    onMouseDown={() => setIsResizing(true)}
                    title="Drag to resize"
                />
            )}

            {isCollapsed ? (
                /* COLLAPSED VIEW - Clicking opens the right bar */
                <div
                    onClick={() => setIsCollapsed(false)}
                    className="flex flex-col items-center py-4 gap-4 min-w-0 overflow-hidden cursor-pointer hover:bg-bg-hover/50 h-full transition-colors"
                    title="Click to open Friends Sidebar"
                >
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsCollapsed(false);
                        }}
                        className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                        title="Open Friends"
                    >
                        <Users className="w-5 h-5 text-accent" />
                    </button>

                    <div className="w-8 h-[1px] bg-border/50 my-1" />

                    {/* Online Stack */}
                    <div className="flex flex-col gap-2.5">
                        {onlineFriends.map((friend) => (
                            <div
                                key={friend.id}
                                className="relative group cursor-pointer"
                                title={`${friend.name} (${friend.status || 'Online'})`}
                            >
                                <div
                                    className="w-8 h-8 rounded-lg shadow-sm ring-2 ring-bg-secondary transition-transform group-hover:scale-105"
                                    style={{ backgroundColor: friend.color }}
                                />
                                <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-green-500 border-2 border-bg-secondary rounded-full" />
                            </div>
                        ))}
                    </div>

                    <div className="w-6 h-[1px] bg-border/50 my-1" />

                    {/* Offline Stack */}
                    <div className="flex flex-col gap-2.5 opacity-50">
                        {offlineFriends.map((friend) => (
                            <div
                                key={friend.id}
                                className="relative group cursor-pointer grayscale hover:grayscale-0 transition-all"
                                title={`${friend.name} (Last seen ${friend.lastSeen})`}
                            >
                                <div
                                    className="w-8 h-8 rounded-lg shadow-sm ring-2 ring-bg-secondary"
                                    style={{ backgroundColor: friend.color }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                /* EXPANDED VIEW */
                <div className="flex flex-col p-4 w-full h-full overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-border/50 shrink-0">
                        <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
                            <Users className="w-4 h-4 text-accent" />
                            <span>Friends</span>
                        </div>
                        <button
                            onClick={() => setIsCollapsed(true)}
                            className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                            title="Collapse Sidebar"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="overflow-y-auto flex-1 custom-scrollbar pr-1 flex flex-col gap-5">
                        {/* Online Friends Section */}
                        <div>
                            <button
                                onClick={() => setOnlineExpanded(!onlineExpanded)}
                                className="w-full flex items-center justify-between text-xs font-bold text-text-secondary uppercase tracking-wider mb-2 hover:text-text-primary transition-colors py-1"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                    <span>Online ({onlineFriends.length})</span>
                                </div>
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${onlineExpanded ? '' : '-rotate-90'}`} />
                            </button>

                            {onlineExpanded && (
                                <div className="flex flex-col gap-1.5 min-h-[40px]">
                                    {onlineFriends.map((friend) => {
                                        const isDragging = draggedItem?.id === friend.id;
                                        const isTarget = dragOverItem?.id === friend.id;

                                        return (
                                            <div
                                                key={friend.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(friend.id, 'online', e)}
                                                onDragOver={(e) => handleDragOver(friend.id, 'online', e)}
                                                onDrop={(e) => handleDrop(friend.id, 'online', e)}
                                                onDragEnd={handleDragEnd}
                                                className={`flex items-center gap-2.5 p-2 rounded-lg transition-all cursor-grab active:cursor-grabbing group
                                                    ${isDragging ? 'opacity-40 scale-95' : 'hover:bg-bg-hover'}
                                                    ${isTarget ? 'border-t-2 border-accent pt-1' : 'border border-transparent hover:border-border/40'}
                                                `}
                                            >
                                                <div className="opacity-0 group-hover:opacity-60 transition-opacity text-text-secondary shrink-0">
                                                    <GripVertical className="w-3.5 h-3.5" />
                                                </div>
                                                <div className="relative shrink-0">
                                                    <div
                                                        className="w-7 h-7 rounded-md shadow-sm"
                                                        style={{ backgroundColor: friend.color }}
                                                    />
                                                    <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 border-2 border-bg-secondary rounded-full" />
                                                </div>
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className="text-sm font-medium text-text-primary truncate">{friend.name}</span>
                                                    <span className="text-[10px] text-text-secondary truncate opacity-80 group-hover:opacity-100">{friend.status}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Offline Friends Section */}
                        <div>
                            <button
                                onClick={() => setOfflineExpanded(!offlineExpanded)}
                                className="w-full flex items-center justify-between text-xs font-bold text-text-secondary uppercase tracking-wider mb-2 hover:text-text-primary transition-colors py-1"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-zinc-500" />
                                    <span>Offline ({offlineFriends.length})</span>
                                </div>
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${offlineExpanded ? '' : '-rotate-90'}`} />
                            </button>

                            {offlineExpanded && (
                                <div className="flex flex-col gap-1.5 min-h-[40px]">
                                    {offlineFriends.map((friend) => {
                                        const isDragging = draggedItem?.id === friend.id;
                                        const isTarget = dragOverItem?.id === friend.id;

                                        return (
                                            <div
                                                key={friend.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(friend.id, 'offline', e)}
                                                onDragOver={(e) => handleDragOver(friend.id, 'offline', e)}
                                                onDrop={(e) => handleDrop(friend.id, 'offline', e)}
                                                onDragEnd={handleDragEnd}
                                                className={`flex items-center gap-2.5 p-2 rounded-lg transition-all cursor-grab active:cursor-grabbing opacity-75 hover:opacity-100 group
                                                    ${isDragging ? 'opacity-40 scale-95' : 'hover:bg-bg-hover'}
                                                    ${isTarget ? 'border-t-2 border-accent pt-1' : 'border border-transparent hover:border-border/40'}
                                                `}
                                            >
                                                <div className="opacity-0 group-hover:opacity-60 transition-opacity text-text-secondary shrink-0">
                                                    <GripVertical className="w-3.5 h-3.5" />
                                                </div>
                                                <div className="relative shrink-0">
                                                    <div
                                                        className="w-7 h-7 rounded-md shadow-sm grayscale brightness-90"
                                                        style={{ backgroundColor: friend.color }}
                                                    />
                                                </div>
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className="text-sm font-medium text-text-primary truncate">{friend.name}</span>
                                                    <span className="text-[10px] text-text-secondary truncate">Last seen {friend.lastSeen}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
