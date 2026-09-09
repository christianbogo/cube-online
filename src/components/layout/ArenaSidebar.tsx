import { Swords, ChevronLeft, ChevronRight, LogOut, Send, ThumbsUp, UserMinus, Ban, Trophy, Zap, Crown, Maximize2 } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/contexts/ConfirmationContext';
import { rtdb } from '@/lib/firebase';
import { ref, update, onValue, remove, push, set } from 'firebase/database';
import type { FeedItem } from '@/types/tournament';

export interface ArenaSidebarProps {
    collapsed: boolean;
    onToggleCollapse: () => void;
    onSetWidth?: (width: number) => void;
}

function LikeSquare({
    itemId,
    hasLiked,
    likesCount,
    onToggleLike,
    hide,
}: {
    itemId: string;
    hasLiked: boolean;
    likesCount: number;
    onToggleLike: (itemId: string, currentLiked: boolean) => void;
    hide?: boolean;
}) {
    const [hovered, setHovered] = useState(false);
    if (hide) return null;

    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onToggleLike(itemId, hasLiked);
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={`feed-likes shrink-0 flex items-center justify-center min-w-[18px] h-[18px] px-0.5 rounded-[3px] text-[10px] font-mono leading-none transition-colors cursor-pointer text-text-secondary hover:text-text-primary ${
                likesCount > 0
                    ? 'opacity-100 bg-bg-hover/80 hover:bg-bg-hover border border-border/40'
                    : 'opacity-0 group-hover:opacity-100 hover:bg-bg-hover hover:border hover:border-border/40'
            }`}
            title={hasLiked ? 'Unlike' : 'Like'}
        >
            {likesCount > 0 && !hovered ? (
                <span>{likesCount}</span>
            ) : (
                <ThumbsUp className={`w-2.5 h-2.5 ${hasLiked ? 'fill-current' : ''}`} />
            )}
        </button>
    );
}

export default function ArenaSidebar({ collapsed, onToggleCollapse, onSetWidth }: ArenaSidebarProps) {
    const { roomId } = useParams<{ roomId?: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { confirm } = useConfirm();

    const [roomName, setRoomName] = useState<string>('');
    const [roomColor, setRoomColor] = useState<string>('#64748b');
    const [hostUid, setHostUid] = useState<string | null>(null);
    const [roomPlayers, setRoomPlayers] = useState<Record<string, any>>({});
    const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
    const [chatInput, setChatInput] = useState<string>('');
    const [sidebarWidth, setSidebarWidth] = useState<number>(240);
    const [hasHiddenOrTruncated, setHasHiddenOrTruncated] = useState<boolean>(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const asideRef = useRef<HTMLElement>(null);
    const feedContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = asideRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            if (entries[0]) {
                setSidebarWidth(entries[0].contentRect.width);
            }
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [collapsed]);

    useEffect(() => {
        if (collapsed) {
            setHasHiddenOrTruncated(false);
            return;
        }

        // 1. If any of the responsive hiding thresholds are active, part of the feed is definitely hidden
        if (sidebarWidth < 235) {
            setHasHiddenOrTruncated(true);
            return;
        }

        // 2. Check if any text element in the feed rows is truncated / overflowing
        const container = feedContainerRef.current;
        if (!container) {
            setHasHiddenOrTruncated(false);
            return;
        }

        let truncated = false;
        const elementsToCheck = container.querySelectorAll('.feed-username, .feed-record-text, .feed-spectator-text, .feed-message');
        for (const el of elementsToCheck) {
            if (el.scrollWidth > el.clientWidth + 1) {
                truncated = true;
                break;
            }
        }

        if (sidebarWidth < 315 && feedItems.length > 0) {
            truncated = true;
        }

        setHasHiddenOrTruncated(truncated);
    }, [collapsed, sidebarWidth, feedItems]);

    const handleAutoGrow = () => {
        const container = feedContainerRef.current;
        let maxNeeded = 330;

        if (container) {
            const rows = container.querySelectorAll('.feed-row');
            rows.forEach((row) => {
                const content = row.querySelector('.feed-row-content');
                if (content) {
                    let rowWidth = 0;
                    Array.from(content.children).forEach((child) => {
                        const el = child as HTMLElement;
                        rowWidth += el.scrollWidth;
                    });
                    rowWidth += (content.children.length - 1) * 6;
                    if (rowWidth > 0) {
                        const totalRowNeeded = rowWidth + 74;
                        if (totalRowNeeded > maxNeeded) {
                            maxNeeded = totalRowNeeded;
                        }
                    }
                }
            });
        }

        const targetWidth = Math.min(460, Math.max(330, Math.ceil(maxNeeded)));
        if (onSetWidth) {
            onSetWidth(targetWidth);
        } else {
            window.dispatchEvent(new CustomEvent('arena-sidebar-set-width', { detail: { width: targetWidth } }));
        }
    };

    useEffect(() => {
        if (!roomId) return;
        const roomRef = ref(rtdb, `rooms/${roomId}`);
        const unsub = onValue(roomRef, (snap) => {
            const data = snap.val();
            if (data) {
                setRoomName(data.name || '');
                setRoomColor(data.color || '#64748b');
                setHostUid(data.host || null);
                setRoomPlayers(data.players || {});
            }
        });
        return () => unsub();
    }, [roomId]);

    // Real-time listener for the room feed stream
    useEffect(() => {
        if (!roomId) {
            setFeedItems([]);
            return;
        }
        const feedRef = ref(rtdb, `rooms/${roomId}/feed`);
        const unsub = onValue(feedRef, (snap) => {
            const data = snap.val();
            if (data) {
                const list: FeedItem[] = Object.entries(data).map(([key, val]: [string, any]) => ({
                    id: key,
                    ...val,
                }));
                // Sort descending: newest at the top directly under the chat bar
                list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                setFeedItems(list);
            } else {
                setFeedItems([]);
            }
        });
        return () => unsub();
    }, [roomId]);

    const isHost = Boolean(user && hostUid && user.uid === hostUid);

    const handleSendMessage = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = chatInput.trim();
        if (!trimmed || !roomId || !user) return;

        let senderRole: 'host' | 'player' | 'spectator' = 'spectator';
        if (user.uid === hostUid) {
            senderRole = 'host';
        } else {
            const p = roomPlayers[user.uid];
            if (p && (p.team === '1' || p.team === '2' || p.team === 'RED' || p.team === 'BLUE')) {
                senderRole = 'player';
            }
        }

        const feedRef = ref(rtdb, `rooms/${roomId}/feed`);
        push(feedRef, {
            type: 'CHAT',
            senderId: user.uid,
            senderName: user.username || user.email?.split('@')[0] || 'Guest',
            senderColor: user.color || '#cccccc',
            senderRole,
            message: trimmed,
            timestamp: Date.now(),
            likes: {},
        }).catch(console.error);

        setChatInput('');
    };

    const handleToggleLike = (itemId: string, alreadyLiked: boolean) => {
        if (!user || !roomId) return;
        const likeRef = ref(rtdb, `rooms/${roomId}/feed/${itemId}/likes/${user.uid}`);
        if (alreadyLiked) {
            remove(likeRef).catch(console.error);
        } else {
            set(likeRef, true).catch(console.error);
        }
    };

    const handleKickUser = async (spectatorUid: string, spectatorName?: string) => {
        if (!isHost || !roomId) return;
        const name = spectatorName || 'this spectator';
        const ok = await confirm(`Are you sure you want to kick ${name} from the room?`, {
            title: 'Kick Spectator',
            confirmText: 'Kick',
            isDanger: true,
        });
        if (!ok) return;

        await update(ref(rtdb, `rooms/${roomId}`), {
            [`players/${spectatorUid}`]: null,
            [`kicked/${spectatorUid}`]: Date.now(),
        }).catch(console.error);
    };

    const handleBanUser = async (spectatorUid: string, spectatorName?: string) => {
        if (!isHost || !roomId) return;
        const name = spectatorName || 'this spectator';
        const ok = await confirm(`Are you sure you want to permanently ban ${name} from this room?`, {
            title: 'Ban Spectator',
            confirmText: 'Ban',
            isDanger: true,
        });
        if (!ok) return;

        await update(ref(rtdb, `rooms/${roomId}`), {
            [`players/${spectatorUid}`]: null,
            [`banned/${spectatorUid}`]: true,
        }).catch(console.error);
    };

    const leaveRoom = async () => {
        if (isHost) {
            return endRoom();
        }
        const ok = await confirm('Are you sure you want to leave this room?', { title: 'Leave Room', confirmText: 'Leave Room', isDanger: true });
        if (!ok) return;
        if (user && roomId) {
            await update(ref(rtdb, `rooms/${roomId}/players`), { [user.uid]: null }).catch(() => {});
        }
        navigate('/arena');
    };

    const endRoom = async () => {
        const ok = await confirm('Are you sure you want to end this room? The room will be closed for everyone.', { title: 'End Room', confirmText: 'End Room', isDanger: true });
        if (!ok) return;
        if (roomId) {
            await remove(ref(rtdb, `rooms/${roomId}`)).catch(() => {});
        }
        navigate('/arena');
    };

    if (collapsed) {
        return (
            <aside className="h-full bg-bg-secondary w-[50px] flex flex-col select-none shrink-0">
                {/* Arena icon at the top instead of the room color square */}
                <div className="py-3 px-2 flex justify-center border-b border-border/80 shrink-0 w-full" title="Arena">
                    <Swords className="w-5 h-5 text-text-secondary" />
                </div>

                {/* Stack of feed icons beneath the arena icon */}
                <div className="flex-1 w-full overflow-y-auto overflow-x-hidden no-scrollbar flex flex-col items-center gap-2.5 py-3">
                    {feedItems.map((item) => {
                        const isHighlight = item.type === 'HIGHLIGHT_SET' || item.type === 'HIGHLIGHT_GAME' || item.type === 'HIGHLIGHT_MATCH';
                        const isMilestone = item.type === 'GAME_WON' || item.type === 'SET_WON' || item.type === 'MATCH_WON';

                        if (isHighlight || isMilestone) {
                            const isSet = item.type === 'HIGHLIGHT_SET' || item.type === 'SET_WON';
                            const title = isHighlight
                                ? `${item.playerName || 'Player'} - ${isSet ? 'Set Record' : 'Game Record'} (${item.formattedTime || (item.timeMs ? `${(item.timeMs / 1000).toFixed(2)}s` : '')})`
                                : item.message;
                            return (
                                <div
                                    key={`col-${item.id}`}
                                    className="w-5 h-5 flex items-center justify-center shrink-0 cursor-default"
                                    title={title}
                                >
                                    <Trophy className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                                </div>
                            );
                        }

                        // Chat messages
                        if (item.senderRole === 'host') {
                            return (
                                <div
                                    key={`col-${item.id}`}
                                    className="w-5 h-5 flex items-center justify-center shrink-0 cursor-default"
                                    title={`Host (${item.senderName || 'Host'}): ${item.message}`}
                                >
                                    <Crown className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                                </div>
                            );
                        }

                        return (
                            <div
                                key={`col-${item.id}`}
                                className="w-5 h-5 flex items-center justify-center shrink-0 cursor-default"
                                title={`${item.senderName || (item.senderRole === 'spectator' ? 'Spectator' : 'Player')}: ${item.message}`}
                            >
                                <div
                                    className="w-3 h-3 rounded-[3px] shrink-0 shadow-2xs"
                                    style={{
                                        backgroundColor: item.senderColor || (item.senderRole === 'spectator' ? 'var(--text-secondary, #8b949e)' : '#3b82f6')
                                    }}
                                />
                            </div>
                        );
                    })}
                </div>

                <div className="p-2 border-t border-border flex flex-col gap-2 mt-auto">
                    {roomId && (
                        <button
                            key="room-exit-btn-collapsed"
                            onClick={isHost ? endRoom : leaveRoom}
                            className="w-full flex justify-center p-2 rounded hover:bg-bg-hover transition-[color,background-color] text-text-secondary hover:text-red-400 outline-none focus:outline-none cursor-pointer"
                            title={isHost ? "End Room" : "Leave Room"}
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    )}

                    <button
                        onClick={(e) => {
                            (e.currentTarget as HTMLElement).blur();
                            onToggleCollapse();
                        }}
                        className="w-full flex items-center justify-center p-2 rounded hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary outline-none focus:outline-none cursor-pointer"
                        title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                    >
                        {collapsed ? (
                            <ChevronLeft className="w-5 h-5" />
                        ) : (
                            <ChevronRight className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </aside>
        );
    }

    const hideLikes = sidebarWidth < 235;
    const hideBadgeText = sidebarWidth < 200;
    const tightUsername = sidebarWidth < 175;
    const usernameMaxWidth = tightUsername ? '44px' : '85px';

    return (
        <aside ref={asideRef} className="@container h-full bg-bg-secondary w-full flex flex-col select-none overflow-hidden shrink-0">
            <style>{`
                @container (max-width: 235px) {
                    .feed-likes { display: none !important; }
                }
                @container (max-width: 200px) {
                    .feed-record-text, .feed-spectator-text { display: none !important; }
                }
                @container (max-width: 175px) {
                    .feed-username { max-width: 44px !important; }
                }
            `}</style>
            {/* Room Header without FEED label */}
            <div className="px-3 py-2 border-b border-border/80 flex items-center justify-between shrink-0 bg-bg-secondary min-h-[36px]">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-3.5 h-3.5 rounded-[3px] shrink-0 shadow-xs" style={{ backgroundColor: roomColor === '#18181b' ? 'var(--profile-black, #2d333b)' : roomColor }} />
                    <h2 className="text-xs font-bold text-text-primary tracking-tight truncate" title={roomName}>{roomName}</h2>
                </div>
                {hasHiddenOrTruncated && (
                    <button
                        type="button"
                        onClick={handleAutoGrow}
                        className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors shrink-0 ml-1.5 cursor-pointer flex items-center justify-center"
                        title="Grow sidebar to fit content"
                    >
                        <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Lowkey Chat Bar at the top of the feed - no line underneath */}
            {roomId && user && (
                <div className="px-2 pt-2 pb-1 bg-bg-secondary shrink-0">
                    <form onSubmit={handleSendMessage} className="relative flex items-center">
                        <input
                            ref={inputRef}
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => {
                                if ((e.code === 'Space' || e.key === ' ') && chatInput === '') {
                                    e.preventDefault();
                                    inputRef.current?.blur();
                                    window.dispatchEvent(new KeyboardEvent('keydown', {
                                        code: 'Space',
                                        key: ' ',
                                        bubbles: true,
                                        cancelable: true,
                                    }));
                                    return;
                                }
                                e.stopPropagation();
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            onKeyUp={(e) => {
                                if (e.code === 'Space' || e.key === ' ') {
                                    return;
                                }
                                e.stopPropagation();
                            }}
                            placeholder="Chat in room..."
                            className="w-full bg-bg-primary border border-border/70 rounded px-2.5 py-1 text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-border transition-colors pr-7"
                        />
                        <button
                            type="submit"
                            disabled={!chatInput.trim()}
                            className="absolute right-1.5 p-1 text-text-secondary hover:text-text-primary disabled:opacity-0 transition-opacity cursor-pointer disabled:cursor-default"
                            title="Send message"
                        >
                            <Send className="w-3 h-3" />
                        </button>
                    </form>
                </div>
            )}

            {/* Feed Stream - flattened single-row compact layout */}
            <div ref={feedContainerRef} className="flex-1 flex flex-col p-2 gap-1 overflow-y-auto custom-scrollbar min-h-0">
                {roomId ? (
                    feedItems.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                            <span className="text-xs font-medium text-text-secondary/60">No messages yet</span>
                        </div>
                    ) : (
                        feedItems.map((item) => {
                            const hasLiked = Boolean(user && item.likes?.[user.uid]);
                            const likesCount = item.likes ? Object.keys(item.likes).length : 0;
                            const isSpectator = item.senderRole === 'spectator';
                            const isHighlight = item.type === 'HIGHLIGHT_SET' || item.type === 'HIGHLIGHT_GAME' || item.type === 'HIGHLIGHT_MATCH';
                            const isMilestone = item.type === 'GAME_WON' || item.type === 'SET_WON' || item.type === 'MATCH_WON';

                            if (isHighlight) {
                                const isSet = item.type === 'HIGHLIGHT_SET';
                                return (
                                    <div
                                        key={item.id}
                                        className="feed-row group relative flex items-center justify-between gap-1.5 px-2 py-1 rounded border border-border/50 bg-bg-primary/50 hover:bg-bg-primary hover:border-border text-xs transition-colors min-h-[26px]"
                                    >
                                        <div className="feed-row-content flex items-center gap-1.5 min-w-0 flex-1">
                                            <div className="w-2.5 h-2.5 rounded-[3px] shrink-0 shadow-2xs" style={{ backgroundColor: item.playerColor || '#f59e0b' }} />
                                            <span
                                                className="feed-username font-semibold text-text-primary truncate shrink min-w-0"
                                                style={{ maxWidth: usernameMaxWidth }}
                                            >
                                                {item.playerName || 'Player'}
                                            </span>
                                            <span className="flex items-center gap-0.5 text-[11px] text-text-secondary shrink-0 font-medium">
                                                {isSet ? (
                                                    <Trophy className="w-2.5 h-2.5 text-text-secondary shrink-0" />
                                                ) : (
                                                    <Zap className="w-2.5 h-2.5 text-text-secondary shrink-0" />
                                                )}
                                                <span className={`feed-record-text ${hideBadgeText ? 'hidden' : ''}`}>
                                                    {isSet ? 'Set Record' : 'Game Record'}
                                                </span>
                                            </span>
                                            <span className="font-mono text-[11px] font-bold text-text-primary shrink-0 ml-auto mr-1">
                                                {item.formattedTime || (item.timeMs ? `${(item.timeMs / 1000).toFixed(2)}s` : '')}
                                            </span>
                                        </div>

                                        <LikeSquare
                                            itemId={item.id}
                                            hasLiked={hasLiked}
                                            likesCount={likesCount}
                                            onToggleLike={handleToggleLike}
                                            hide={hideLikes}
                                        />
                                    </div>
                                );
                            }

                            if (isMilestone) {
                                return (
                                    <div
                                        key={item.id}
                                        className="feed-row group relative flex items-center justify-between gap-1.5 px-2 py-1 rounded border border-border/50 bg-bg-primary/50 hover:bg-bg-primary hover:border-border text-xs transition-colors min-h-[26px]"
                                    >
                                        <div className="feed-row-content flex items-center gap-1.5 min-w-0 flex-1">
                                            <Trophy className="w-2.5 h-2.5 text-text-secondary shrink-0" />
                                            <span className="feed-message font-medium text-text-primary truncate shrink min-w-0">{item.message}</span>
                                        </div>

                                        <LikeSquare
                                            itemId={item.id}
                                            hasLiked={hasLiked}
                                            likesCount={likesCount}
                                            onToggleLike={handleToggleLike}
                                            hide={hideLikes}
                                        />
                                    </div>
                                );
                            }

                            // Chat Message: Spectator
                            if (isSpectator) {
                                return (
                                    <div
                                        key={item.id}
                                        className="feed-row group relative flex items-center justify-between gap-1.5 px-2 py-1 rounded border border-border/40 bg-bg-primary/30 text-xs text-text-secondary/70 transition-colors min-h-[26px] hover:border-border/70"
                                    >
                                        <div className="feed-row-content flex items-center gap-1.5 min-w-0 flex-1">
                                            <div className="w-2.5 h-2.5 rounded-[3px] shrink-0 bg-text-secondary/40" />
                                            <span
                                                className="feed-username font-medium text-text-secondary/80 truncate shrink min-w-0"
                                                style={{ maxWidth: usernameMaxWidth }}
                                            >
                                                {item.senderName || 'Spectator'}
                                            </span>
                                            <span className={`feed-spectator-text text-[9px] px-1 py-0.2 rounded bg-bg-secondary text-text-secondary/60 shrink-0 font-medium border border-border/40 ${hideBadgeText ? 'hidden' : ''}`}>
                                                Spectator
                                            </span>
                                            <span className="feed-message truncate shrink min-w-0 font-normal text-text-secondary/70 select-text ml-0.5">{item.message}</span>
                                        </div>

                                        {/* Kick/Ban overlay over chat row on hover */}
                                        {isHost && item.senderId && item.senderId !== user?.uid && (
                                            <div className="absolute right-1 inset-y-0 flex items-center gap-1 bg-bg-secondary/95 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 border border-border/60 shadow-xs">
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleKickUser(item.senderId!, item.senderName); }}
                                                    className="px-1 py-0.5 rounded text-[10px] font-medium bg-bg-hover hover:bg-amber-500/20 text-text-secondary hover:text-amber-400 border border-border/50 transition-colors flex items-center gap-1 cursor-pointer"
                                                    title="Kick spectator"
                                                >
                                                    <UserMinus className="w-2.5 h-2.5" />
                                                    <span>Kick</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleBanUser(item.senderId!, item.senderName); }}
                                                    className="px-1 py-0.5 rounded text-[10px] font-medium bg-bg-hover hover:bg-red-500/20 text-text-secondary hover:text-red-400 border border-border/50 transition-colors flex items-center gap-1 cursor-pointer"
                                                    title="Ban spectator"
                                                >
                                                    <Ban className="w-2.5 h-2.5" />
                                                    <span>Ban</span>
                                                </button>
                                            </div>
                                        )}

                                        <LikeSquare
                                            itemId={item.id}
                                            hasLiked={hasLiked}
                                            likesCount={likesCount}
                                            onToggleLike={handleToggleLike}
                                            hide={hideLikes}
                                        />
                                    </div>
                                );
                            }

                            // Chat Message: Host or Player Competitor
                            return (
                                <div
                                    key={item.id}
                                    className="feed-row group relative flex items-center justify-between gap-1.5 px-2 py-1 rounded border border-border/50 bg-bg-primary/50 hover:bg-bg-primary hover:border-border text-xs transition-colors min-h-[26px]"
                                >
                                    <div className="feed-row-content flex items-center gap-1.5 min-w-0 flex-1">
                                        <div className="w-2.5 h-2.5 rounded-[3px] shrink-0 shadow-2xs" style={{ backgroundColor: item.senderColor || '#3b82f6' }} />
                                        <span
                                            className="feed-username font-bold text-text-primary truncate shrink min-w-0"
                                            style={{ maxWidth: usernameMaxWidth }}
                                        >
                                            {item.senderName || 'Player'}
                                        </span>
                                        {item.senderRole === 'host' && (
                                            <span title="Host" className="shrink-0 flex items-center">
                                                <Crown className="w-2.5 h-2.5 text-text-secondary" />
                                            </span>
                                        )}
                                        <span className="feed-message truncate shrink min-w-0 font-normal text-text-primary select-text ml-0.5">{item.message}</span>
                                    </div>

                                    <LikeSquare
                                        itemId={item.id}
                                        hasLiked={hasLiked}
                                        likesCount={likesCount}
                                        onToggleLike={handleToggleLike}
                                        hide={hideLikes}
                                    />
                                </div>
                            );
                        })
                    )
                ) : (
                    <div className="text-sm text-text-secondary text-center mt-10">
                        Join a room to see the feed
                    </div>
                )}
            </div>

            {/* Bottom Controls: Exit & Collapse */}
            <div className="p-2 border-t border-border flex flex-col gap-2 mt-auto bg-bg-secondary shrink-0">
                {roomId && (
                    <button
                        key="room-exit-btn-expanded"
                        onClick={isHost ? endRoom : leaveRoom}
                        className="w-full h-[34px] flex items-center justify-center bg-bg-hover rounded p-1 border border-border/50 text-xs font-medium text-text-secondary hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-[color,background-color] cursor-pointer outline-none focus:outline-none"
                    >
                        {isHost ? 'End Room' : 'Leave Room'}
                    </button>
                )}

                <button
                    onClick={(e) => {
                        (e.currentTarget as HTMLElement).blur();
                        onToggleCollapse();
                    }}
                    className="w-full flex items-center justify-center p-2 rounded hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary outline-none focus:outline-none cursor-pointer"
                    title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {collapsed ? (
                        <ChevronLeft className="w-5 h-5" />
                    ) : (
                        <ChevronRight className="w-5 h-5" />
                    )}
                </button>
            </div>
        </aside>
    );
}
