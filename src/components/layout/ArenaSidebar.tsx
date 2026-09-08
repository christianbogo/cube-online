import { Swords, ChevronLeft, ChevronRight, LogOut, Settings } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/contexts/ConfirmationContext';
import { rtdb } from '@/lib/firebase';
import { ref, update, onValue, remove } from 'firebase/database';
import { useTournamentStore } from '@/store/tournamentStore';

export interface ArenaSidebarProps {
    collapsed: boolean;
    onToggleCollapse: () => void;
}

export default function ArenaSidebar({ collapsed, onToggleCollapse }: ArenaSidebarProps) {
    const { roomId } = useParams<{ roomId?: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { confirm } = useConfirm();

    const { settings, toggleAdmin } = useTournamentStore();
    
    const [roomName, setRoomName] = useState<string>('');
    const [roomColor, setRoomColor] = useState<string>('#64748b');
    const [hostUid, setHostUid] = useState<string | null>(null);

    useEffect(() => {
        if (!roomId) return;
        const roomRef = ref(rtdb, `rooms/${roomId}`);
        const unsub = onValue(roomRef, (snap) => {
            const data = snap.val();
            if (data) {
                setRoomName(data.name || '');
                setRoomColor(data.color || '#64748b');
                setHostUid(data.host || null);
            }
        });
        return () => unsub();
    }, [roomId]);

    const isHost = Boolean(user && hostUid && user.uid === hostUid);

    const leaveRoom = async () => {
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
                <div className="flex-1 flex flex-col items-center py-4 gap-4">
                    {roomId && <div className="w-5 h-5 rounded-lg shadow-xs shrink-0" style={{ backgroundColor: roomColor === '#18181b' ? 'var(--profile-black, #2d333b)' : roomColor }} />}
                    <Swords className="w-5 h-5 text-text-secondary opacity-50" />
                    {roomId && isHost && (
                        <button
                            type="button"
                            onClick={() => toggleAdmin(true)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary cursor-pointer"
                            title="Match Settings"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="p-2 border-t border-border flex flex-col gap-2 mt-auto">
                    {roomId && (
                        <button
                            key="room-exit-btn-collapsed"
                            onClick={isHost ? endRoom : leaveRoom}
                            className="w-full flex justify-center p-2 rounded-md hover:bg-bg-hover transition-[color,background-color] text-text-secondary hover:text-red-400 outline-none focus:outline-none cursor-pointer"
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
                        className="w-full flex items-center justify-center p-2 rounded-md hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary outline-none focus:outline-none cursor-pointer"
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

    return (
        <aside className="h-full bg-bg-secondary w-full flex flex-col select-none overflow-hidden shrink-0">
            <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto custom-scrollbar">
                {roomId ? (
                    <>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-5 h-5 rounded-lg shrink-0 shadow-xs" style={{ backgroundColor: roomColor === '#18181b' ? 'var(--profile-black, #2d333b)' : roomColor }} />
                            <h2 className="text-xl font-bold text-text-primary tracking-tight break-words">{roomName}</h2>
                        </div>

                        {isHost && (
                            <button
                                type="button"
                                onClick={() => toggleAdmin(true)}
                                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-bg-primary hover:bg-bg-hover text-text-primary transition-all cursor-pointer shadow-2xs group"
                            >
                                <span className="text-xs font-semibold group-hover:text-accent transition-colors">Match Settings</span>
                                <span className="text-[10px] text-text-secondary font-medium uppercase px-1.5 py-0.5 rounded bg-bg-secondary border border-border/60">Host</span>
                            </button>
                        )}

                        <div className="flex flex-col gap-1 pt-2">
                            <div className="text-sm text-text-primary font-medium">Mode: <span className="text-text-secondary font-normal">{settings.scoringMode === 'RANK_BASED' ? 'Ranked' : 'Differential'}</span></div>
                            <div className="text-sm text-text-primary font-medium">Sets to Win: <span className="text-text-secondary font-normal">{settings.targetSets}</span></div>
                            <div className="text-sm text-text-primary font-medium">Games to Win: <span className="text-text-secondary font-normal">{settings.targetGames}</span></div>
                        </div>
                    </>
                ) : (
                    <div className="text-sm text-text-secondary text-center mt-10">
                        Join a room to see match details
                    </div>
                )}
            </div>

            <div className="p-2 border-t border-border flex flex-col gap-2 mt-auto">
                {roomId && (
                    <button
                        key="room-exit-btn-expanded"
                        onClick={isHost ? endRoom : leaveRoom}
                        className="w-full h-[34px] flex items-center justify-center bg-bg-hover rounded-md p-1 border border-border/50 text-xs font-medium text-text-secondary hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-[color,background-color] cursor-pointer outline-none focus:outline-none"
                    >
                        {isHost ? 'End Room' : 'Leave Room'}
                    </button>
                )}

                <button
                    onClick={(e) => {
                        (e.currentTarget as HTMLElement).blur();
                        onToggleCollapse();
                    }}
                    className="w-full flex items-center justify-center p-2 rounded-md hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary outline-none focus:outline-none cursor-pointer"
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
