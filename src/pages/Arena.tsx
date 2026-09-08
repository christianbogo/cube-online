import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Swords, X, Check, Loader2, Volume2, VolumeX, Settings, Bot, ChevronRight, Trash } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/contexts/ConfirmationContext';
import { rtdb } from '@/lib/firebase';
import { ref, onValue, set, push, update, remove, onDisconnect } from 'firebase/database';
import { ArenaMatchProvider } from '@/arena/context/ArenaMatchContext';
import type { LiveUser } from '@/types';

import { useTimerStore } from '@/store/timerStore';
import { useTournamentStore } from '@/store/tournamentStore';
import { useKeyboardController } from '@/hooks/useKeyboardController';
import { useFirebaseHost, useFirebaseGuest } from '@/hooks/useFirebaseMatch';
import { formatTime } from '@/utils/formatters';
import { ScoringMode } from '@/types/tournament';
import type { TeamId, Player, PlayerRole } from '@/types/tournament';

const AVAILABLE_COLORS = [
  { name: 'Red', hex: '#ef4444' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Lime', hex: '#84cc16' },
  { name: 'Green', hex: '#10b981' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Fuchsia', hex: '#d946ef' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Slate', hex: '#64748b' },
  { name: 'Dark', hex: '#18181b' },
];

const TOP_100_BABY_NAMES = [
  'Liam', 'Olivia', 'Noah', 'Emma', 'Oliver', 'Charlotte', 'James', 'Amelia',
  'Elijah', 'Sophia', 'William', 'Isabella', 'Henry', 'Ava', 'Lucas', 'Mia',
  'Benjamin', 'Evelyn', 'Theodore', 'Harper', 'Mateo', 'Luna', 'Levi', 'Camila',
  'Sebastian', 'Gianna', 'Daniel', 'Elizabeth', 'Jack', 'Eleanor', 'Michael', 'Ella',
  'Alexander', 'Emily', 'Owen', 'Sofia', 'Asher', 'Avery', 'Samuel', 'Mila',
  'Ethan', 'Aria', 'Leo', 'Chloe', 'Jackson', 'Layla', 'Mason', 'Penelope',
  'Ezra', 'Riley', 'John', 'Zoey', 'Hudson', 'Nora', 'Luca', 'Lily'
];

function DragRaceOverlay() {
  const { raceState, countdownStage } = useTimerStore();

  const isRedActive = raceState === 'LOCKED_IN' || raceState === 'DRAG_COUNTDOWN';
  const isYellow1 = raceState === 'DRAG_COUNTDOWN' && countdownStage >= 1;
  const isYellow2 = raceState === 'DRAG_COUNTDOWN' && countdownStage >= 2;
  const isYellow3 = raceState === 'DRAG_COUNTDOWN' && countdownStage >= 3;
  const isGreenActive = raceState === 'RACING';
  
  if (!isRedActive) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 animate-in fade-in">
      <div className="flex items-center gap-4 sm:gap-6 bg-bg-secondary/50 p-8 rounded-3xl backdrop-blur-md shadow-2xl">
        <div className="flex flex-col items-center gap-1.5">
          <div className={`w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full border-4 transition-all duration-150 flex items-center justify-center ${isRedActive ? 'bg-red-500 border-red-200 shadow-[0_0_40px_rgba(239,68,68,0.8)] scale-110' : 'bg-red-950/50 border-red-950/60'}`}>
            <div className={`w-4 h-4 rounded-full ${isRedActive ? 'bg-white shadow-sm' : 'bg-red-900/30'}`} />
          </div>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className={`w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full border-4 transition-all duration-150 flex items-center justify-center ${isYellow1 ? 'bg-amber-400 border-amber-200 shadow-[0_0_40px_rgba(251,191,36,0.8)] scale-110' : 'bg-amber-950/50 border-amber-950/60'}`}>
            <div className={`w-4 h-4 rounded-full ${isYellow1 ? 'bg-white shadow-sm' : 'bg-amber-900/30'}`} />
          </div>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className={`w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full border-4 transition-all duration-150 flex items-center justify-center ${isYellow2 ? 'bg-amber-400 border-amber-200 shadow-[0_0_40px_rgba(251,191,36,0.8)] scale-110' : 'bg-amber-950/50 border-amber-950/60'}`}>
            <div className={`w-4 h-4 rounded-full ${isYellow2 ? 'bg-white shadow-sm' : 'bg-amber-900/30'}`} />
          </div>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className={`w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full border-4 transition-all duration-150 flex items-center justify-center ${isYellow3 ? 'bg-amber-400 border-amber-200 shadow-[0_0_40px_rgba(251,191,36,0.8)] scale-110' : 'bg-amber-950/50 border-amber-950/60'}`}>
            <div className={`w-4 h-4 rounded-full ${isYellow3 ? 'bg-white shadow-sm' : 'bg-amber-900/30'}`} />
          </div>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className={`w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full border-4 transition-all duration-150 flex items-center justify-center ${isGreenActive ? 'bg-emerald-400 border-emerald-100 shadow-[0_0_60px_rgba(52,211,153,0.9)] scale-125 animate-pulse' : 'bg-emerald-950/50 border-emerald-950/60'}`}>
            <div className={`w-5 h-5 rounded-full ${isGreenActive ? 'bg-white shadow-sm' : 'bg-emerald-900/30'}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveTimer({ playerId }: { playerId: string }) {
  const [displayTime, setDisplayTime] = useState('0.00');
  const [isHeld, setIsHeld] = useState(false);
  
  useEffect(() => {
    let frame: number;
    const updateTime = () => {
      const state = useTimerStore.getState();
      const p = state.players[playerId];
      if (!p) return;
      
      if (p.isFinished) {
        setDisplayTime(formatTime(p.finishTimeMs || p.rawTimeMs || 0));
        return;
      }
      if (p.isRunning && state.raceStartTime) {
        const elapsed = Date.now() - state.raceStartTime;
        setDisplayTime(formatTime(elapsed));
        frame = requestAnimationFrame(updateTime);
        return;
      }
      setDisplayTime('0.00');
    };
    
    frame = requestAnimationFrame(updateTime);
    
    const unsub = useTimerStore.subscribe((state, prevState) => {
      const p = state.players[playerId];
      const prevP = prevState.players[playerId];
      
      setIsHeld(!!p?.isHeld);

      if (p?.isRunning && !prevP?.isRunning) {
        frame = requestAnimationFrame(updateTime);
      } else if (p?.isFinished && !prevP?.isFinished) {
        cancelAnimationFrame(frame);
        setDisplayTime(formatTime(p.finishTimeMs || p.rawTimeMs || 0));
      } else if (!p?.isRunning && !p?.isFinished) {
        setDisplayTime('0.00');
      }
    });
    
    setIsHeld(!!useTimerStore.getState().players[playerId]?.isHeld);
    
    return () => {
      cancelAnimationFrame(frame);
      unsub();
    };
  }, [playerId]);

  if (isHeld) {
    return <div className="font-mono text-xl font-bold tracking-wider text-green-400">READY</div>;
  }
  return <div className="font-mono text-xl font-bold tracking-wider">{displayTime}</div>;
}

function PlayerRow({ p, isHost }: { p: Player, isHost: boolean }) {
  const [isHeld, setIsHeld] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);

  useEffect(() => {
    const unsub = useTimerStore.subscribe((state) => {
      setIsHeld(!!state.players[p.id]?.isHeld);
      setIsWaiting(state.raceState === 'WAITING_FOR_ALL');
    });
    const state = useTimerStore.getState();
    setIsHeld(!!state.players[p.id]?.isHeld);
    setIsWaiting(state.raceState === 'WAITING_FOR_ALL');
    return unsub;
  }, [p.id]);

  const fading = isWaiting && !isHeld;
  const glowing = isHeld;

  return (
    <div 
      draggable={isHost}
      onDragStart={isHost ? (e) => {
        e.dataTransfer.setData('text/plain', p.id);
      } : undefined}
      className={`relative group bg-bg-primary rounded-xl border p-2 flex justify-between items-center transition-all w-full max-w-[280px] shrink-0 ${fading ? 'opacity-50' : ''} ${glowing ? 'border-green-400 shadow-[0_0_10px_rgba(74,222,128,0.3)]' : 'border-border/80'} ${isHost ? 'cursor-grab active:cursor-grabbing hover:border-accent/50' : ''}`}
    >
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg shadow-sm shrink-0" style={{ backgroundColor: p.color }} />
        <span className="text-sm font-bold text-text-primary">{p.name}</span>
      </div>
      <LiveTimer playerId={p.id} />
    </div>
  );
}

function EditableScore({ value, isHost, onIncrement, onDecrement }: { value: number, isHost: boolean, onIncrement?: () => void, onDecrement?: () => void }) {
  return (
    <div className="relative group flex items-center justify-center cursor-default min-w-[24px]">
      {isHost && <button onClick={onDecrement} className="absolute -left-6 opacity-0 group-hover:opacity-100 text-sm bg-bg-hover rounded px-1.5 hover:text-white transition-opacity cursor-pointer">-</button>}
      <span>{value}</span>
      {isHost && <button onClick={onIncrement} className="absolute -right-6 opacity-0 group-hover:opacity-100 text-sm bg-bg-hover rounded px-1.5 hover:text-white transition-opacity cursor-pointer">+</button>}
    </div>
  );
}

function ShapeIndicator({ total, filled, isHost, onClick, type, team }: { total: number, filled: number, isHost: boolean, onClick?: (index: number) => void, type: 'circle' | 'diamond', team: 'RED' | 'BLUE' }) {
  const shapes = [];
  for (let i = 0; i < total; i++) {
    const isFilled = i < filled;
    const baseColorClass = team === 'RED' ? 'bg-red-400' : 'bg-blue-400';
    const borderColorClass = team === 'RED' ? 'border-red-400' : 'border-blue-400';
    
    let shapeClass = '';
    if (type === 'circle') {
      shapeClass = `w-3 h-3 rounded-full border-2 ${isFilled ? baseColorClass : `bg-transparent ${borderColorClass}`}`;
    } else {
      shapeClass = `w-3 h-3 rotate-45 border-2 ${isFilled ? baseColorClass : `bg-transparent ${borderColorClass}`}`;
    }

    shapes.push(
      <div 
        key={i} 
        className={`${shapeClass} ${isHost ? 'cursor-pointer' : ''} transition-colors`}
        onClick={() => { if (isHost && onClick) onClick(i); }}
      />
    );
  }
  return <div className="flex items-center gap-1.5">{shapes}</div>;
}

function HostKeyboardControllerMount() {
  useKeyboardController();
  return null;
}

function HostMatchSync({ roomId }: { roomId: string }) {
  useFirebaseHost(roomId);
  return null;
}

function GuestMatchSync({ roomId, slotId }: { roomId: string; slotId: string }) {
  useFirebaseGuest(roomId, slotId);
  return null;
}

function ArenaInner() {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const { roomId } = useParams<{ roomId?: string }>();
  const navigate = useNavigate();
  
  const [rooms, setRooms] = useState<any[]>([]);
  const [roomData, setRoomData] = useState<any>(null);
  const [liveUsers, setLiveUsers] = useState<Record<string, LiveUser>>({});
  const roomEverLoadedRef = useRef(false);

  const isHost = roomData?.host === user?.uid;

  const {
    matchStatus, startMatch, currentScramble, settings, updateSettings, players: tournamentPlayers, addPlayer, removePlayer, updatePlayerBotConfig,
    teamGamePoints, teamGameWins, teamSetWins, currentSetIndex, currentGameIndex, currentRoundIndex, lastMatchPlaces,
    isAdminOpen, toggleAdmin
  } = useTournamentStore();

  const timerPlayers = useTimerStore((s) => s.players);

  const displayPlaces = useMemo(() => {
    if (lastMatchPlaces && lastMatchPlaces.length > 0) {
      return lastMatchPlaces;
    }
    const timerEntries = Object.values(timerPlayers).filter(
      (tp) => tp.finishRank != null || tp.lastFinishRank != null
    );
    if (timerEntries.length === 0) return [];

    const hasCurrentFinish = timerEntries.some((tp) => tp.finishRank != null);
    const mapped = timerEntries.map((tp) => {
      const p = tournamentPlayers.find((x) => x.id === tp.playerId);
      const rank = (hasCurrentFinish ? tp.finishRank : tp.lastFinishRank) ?? 999;
      const timeMs = (hasCurrentFinish ? tp.finishTimeMs : tp.lastFinishTimeMs) ?? 0;
      const penalty = (hasCurrentFinish ? tp.penalty : tp.lastPenalty) ?? 'NONE';
      return {
        playerId: tp.playerId,
        name: p?.name || 'Player',
        color: p?.color || '#cccccc',
        team: p?.team,
        rank,
        timeMs,
        penalty,
        isDNF: penalty === 'DNF',
      };
    });
    return mapped.sort((a, b) => a.rank - b.rank);
  }, [lastMatchPlaces, timerPlayers, tournamentPlayers]);




  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [nameOptions, setNameOptions] = useState<string[]>([]);
  const [selectedRoomName, setSelectedRoomName] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVAILABLE_COLORS[10].hex);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const generate5Names = () => {
    const shuffled = [...TOP_100_BABY_NAMES].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 5);
  };

  const openCreateModal = () => {
    const names = generate5Names();
    setNameOptions(names);
    setSelectedRoomName(names[0]);
    setSelectedColor(user?.color || AVAILABLE_COLORS[10].hex);
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  useEffect(() => {
    if (roomId) return;
    const roomsRef = ref(rtdb, 'rooms');
    const unsubscribe = onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const activeRooms: any[] = [];
        Object.entries(data).forEach(([id, val]: [string, any]) => {
          const players = val.players ? Object.keys(val.players) : [];
          if (players.length === 0 || (val.host && !val.players?.[val.host])) {
            remove(ref(rtdb, `rooms/${id}`)).catch(() => {});
          } else {
            activeRooms.push({ id, ...val });
          }
        });
        setRooms(activeRooms);
      } else {
        setRooms([]);
      }
    });
    return () => unsubscribe();
  }, [roomId]);

  const hasJoinedRef = useRef(false);

  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    if (!roomId) {
      setRoomData(null);
      roomEverLoadedRef.current = false;
      hasJoinedRef.current = false;
      hasRedirectedRef.current = false;
      return;
    }
    hasRedirectedRef.current = false;
    const roomRef = ref(rtdb, `rooms/${roomId}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const { fullState: _fs, held: _h, solves: _s, hostHeartbeat: _hb, guests: _g, ...roomMeta } = data;
        setRoomData(roomMeta);
        roomEverLoadedRef.current = true;
        // Auto-join only once per room visit
        if (user && !user.isAnonymous && !hasJoinedRef.current && (!roomMeta.players || !roomMeta.players[user.uid])) {
          hasJoinedRef.current = true;
          const role = roomMeta.host === user.uid ? 'host' : 'spectator';
          update(ref(rtdb, `rooms/${roomId}/players/${user.uid}`), {
            role,
            team: 'none',
            username: user.username || user.email?.split('@')[0] || 'Unknown'
          }).catch(console.error);
        } else if (user && roomMeta.players?.[user.uid]) {
          hasJoinedRef.current = true;
        }
      } else {
        setRoomData(null);
        // Room doesn't exist or was deleted — redirect to arena (only once)
        if (!hasRedirectedRef.current) {
          hasRedirectedRef.current = true;
          const notice = roomEverLoadedRef.current ? 'The host ended the room.' : 'This room does not exist.';
          navigate('/arena', { replace: true, state: { notice } });
        }
      }
    });
    return () => unsubscribe();
  }, [roomId, user?.uid, navigate]);

  useEffect(() => {
    if (!roomId || !user) return;
    if (isHost) {
      const roomRef = ref(rtdb, `rooms/${roomId}`);
      onDisconnect(roomRef).remove();
      return () => { onDisconnect(roomRef).cancel(); };
    } else {
      const playerRef = ref(rtdb, `rooms/${roomId}/players/${user.uid}`);
      onDisconnect(playerRef).remove();
      return () => { onDisconnect(playerRef).cancel(); };
    }
  }, [roomId, user?.uid, isHost]);

  useEffect(() => {
    if (!roomId) return;
    const presenceRef = ref(rtdb, 'presence');
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const map: Record<string, LiveUser> = {};
        Object.entries(data).forEach(([uid, uData]: [string, any]) => {
          map[uid] = {
            uid,
            username: uData.username || 'Unknown',
            color: uData.color || '#cccccc',
            status: uData.status || 'IDLE',
            recentSolves: uData.recentSolves || [],
            timestamp: uData.timestamp || Date.now()
          };
        });
        setLiveUsers(map);
      }
    });
    return () => unsubscribe();
  }, [roomId]);

  const lastSyncedPlayersRef = useRef('');
  useEffect(() => {
    if (!roomData?.players) return;
    
    const playersToSync: Player[] = Object.entries(roomData.players)
      .filter(([, p]: [string, any]) => p.team === '1' || p.team === '2')
      .map(([id, p]: [string, any]) => {
        const u = liveUsers[id];
        const isSelf = id === user?.uid;
        return {
          id,
          name: u?.username || roomData.players?.[id]?.username || (isSelf ? 'You' : id.substring(0, 5)),
          role: (isSelf && isHost ? 'HOST' : isSelf ? 'PLAYER' : 'PLAYER') as PlayerRole,
          key: isSelf ? ' ' : '',
          color: u?.color || '#cccccc',
          accentColor: u?.color || '#cccccc',
          active: true,
          team: (p.team === '1' ? 'RED' : 'BLUE') as TeamId,
        };
      });

    const syncKey = playersToSync.map(p => `${p.id}:${p.team}:${p.role}`).join('|');
    if (syncKey === lastSyncedPlayersRef.current) return;
    lastSyncedPlayersRef.current = syncKey;

    useTournamentStore.setState(s => {
      // Host keeps bots, guests should not have any local bots
      const bots = isHost ? s.players.filter(p => p.role === 'BOT') : [];
      s.players = [...playersToSync, ...bots];
    });
  }, [roomData?.players, isHost, liveUsers, user?.uid]);

  const handleCreateRoom = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) {
      setCreateError('You must be signed in to create a room.');
      return;
    }
    const trimmed = selectedRoomName.trim();
    if (!trimmed) {
      setCreateError('Please choose a room name.');
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      const roomsRef = ref(rtdb, 'rooms');
      const newRoomRef = push(roomsRef);
      const newRoomId = newRoomRef.key!;
      await set(newRoomRef, {
        name: trimmed,
        color: selectedColor,
        host: user.uid,
        createdAt: Date.now(),
        gamemode: 'Standard',
        players: {
          [user.uid]: { 
            role: 'host', 
            team: 'none',
            username: user.username || user.email?.split('@')[0] || 'Unknown' 
          }
        },
      });
      useTournamentStore.getState().resetTournament();
      useTournamentStore.getState().updateSettings({ tournamentMode: 'TEAMS' });
      useTournamentStore.setState(s => {
        s.players = s.players.filter(p => p.role !== 'BOT');
      });
      await useTournamentStore.getState().startMatch();
      setIsCreateModalOpen(false);
      navigate(`/${newRoomId}`);
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create room. Please verify permissions.');
    } finally {
      setIsCreating(false);
    }
  };




  const assignTeam = (playerId: string, team: '1' | '2' | 'none') => {
    if (!isHost || !roomId) return;
    update(ref(rtdb, `rooms/${roomId}/players/${playerId}`), { team });
  };

  const removePlayerFromMatch = (playerId: string) => {
    if (!isHost || !roomId) return;
    const isBot = tournamentPlayers.find(p => p.id === playerId)?.role === 'BOT';
    if (isBot) {
      removePlayer(playerId);
    } else {
      assignTeam(playerId, 'none');
    }
  };


  const botCounterRef = useRef(0);

  const addBot = () => {
    if (!isHost) return;
    botCounterRef.current += 1;
    const paddedCount = botCounterRef.current.toString().padStart(2, '0');
    addPlayer(`Bot ${paddedCount}`, 'BLUE', 'BOT', { averageTimeMs: 20000, stdDevMs: 1000, maturity: 'INTERMEDIATE' });
  };

  if (!roomId || !roomData) {
    const locationState = (window.history.state?.usr as any);
    const notice = locationState?.notice as string | undefined;

    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto custom-scrollbar">
        {notice && (
          <div className="mb-4 px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-sm font-medium">
            {notice}
          </div>
        )}
        <div className="max-w-3xl w-full flex flex-wrap justify-center items-center gap-3.5 sm:gap-4 my-auto py-6">
          {rooms.map((room) => {
            const playersList = Object.values(room.players || {}) as any[];
            const totalCount = playersList.length;
            return (
              <div
                key={room.id}
                onClick={() => navigate(`/${room.id}`)}
                className="w-full sm:w-[260px] flex items-center gap-3.5 p-3.5 bg-bg-secondary hover:bg-bg-hover border border-border/80 hover:border-accent/60 rounded-xl cursor-pointer transition-all duration-200 shadow-2xs hover:shadow-md group text-left shrink-0"
              >
                <div
                  className="w-12 h-12 rounded-xl shadow-xs shrink-0 transition-transform group-hover:scale-105"
                  style={{ backgroundColor: room.color === '#18181b' ? 'var(--profile-black, #2d333b)' : room.color || '#64748b' }}
                />
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h2 className="text-base font-bold text-text-primary truncate group-hover:text-accent transition-colors">{room.name}</h2>
                  <p className="text-text-secondary text-xs mt-0.5 truncate">{totalCount} {totalCount === 1 ? 'user' : 'users'}</p>
                </div>
              </div>
            );
          })}
          {user && !user.isAnonymous && (
            <button
              type="button"
              onClick={openCreateModal}
              className="w-full sm:w-[260px] flex items-center gap-3.5 p-3.5 border-2 border-dashed border-border/80 hover:border-accent hover:bg-accent/5 rounded-xl cursor-pointer transition-all duration-200 group text-left focus:outline-none bg-bg-secondary/40 shrink-0"
            >
              <div className="w-12 h-12 rounded-xl border-2 border-dashed border-border group-hover:border-accent bg-bg-secondary group-hover:bg-accent/10 flex items-center justify-center shrink-0 transition-all group-hover:scale-105">
                <Plus className="w-5 h-5 text-text-secondary group-hover:text-accent transition-colors" />
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h2 className="text-base font-bold text-text-primary group-hover:text-accent transition-colors">Create Room</h2>
                <p className="text-text-secondary text-xs mt-0.5">Start a new match</p>
              </div>
            </button>
          )}
        </div>

        {isCreateModalOpen && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="bg-bg-secondary border border-border/80 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-5 animate-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-bold text-text-primary">Create Room</h2>
                </div>
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="p-1 text-text-secondary hover:text-text-primary rounded-lg hover:bg-bg-hover transition-colors cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateRoom} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Pick a Room Name</label>
                  <div className="flex flex-col gap-1.5">
                    {nameOptions.map((name) => {
                      const isSelected = selectedRoomName === name;
                      return (
                        <button key={name} type="button" onClick={() => setSelectedRoomName(name)} className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all text-left cursor-pointer ${isSelected ? 'bg-accent/10 border-accent text-accent shadow-2xs' : 'bg-bg-primary border-border/80 text-text-primary hover:bg-bg-hover hover:border-border'}`}>
                          <span className="truncate">{name}</span>
                          {isSelected ? <Check className="w-4 h-4 text-accent shrink-0 stroke-[2.5]" /> : <div className="w-4 h-4 rounded-full border border-border/80 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Room Color</label>
                  <div className="grid grid-cols-6 gap-2.5">
                    {AVAILABLE_COLORS.map((item) => {
                      const isSelected = selectedColor.toLowerCase() === item.hex.toLowerCase();
                      return (
                        <button key={item.hex} type="button" onClick={() => setSelectedColor(item.hex)} title={item.name} className={`aspect-square w-full rounded-xl border-2 transition-all flex items-center justify-center cursor-pointer ${isSelected ? 'border-text-primary scale-105 shadow-sm ring-2 ring-accent/30' : 'border-transparent hover:scale-105'}`} style={{ backgroundColor: item.hex === '#18181b' ? 'var(--profile-black, #2d333b)' : item.hex }}>
                          {isSelected && <Check className="w-4 h-4 text-white stroke-[3] drop-shadow" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {createError && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{createError}</div>}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-xl transition-colors cursor-pointer">Cancel</button>
                  <button type="submit" disabled={isCreating || !selectedRoomName.trim()} className="px-5 py-2 text-xs font-semibold text-white bg-accent hover:bg-accent/90 disabled:opacity-50 rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-sm">
                    {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isCreating ? 'Creating...' : 'Create Room'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  const team1Players = tournamentPlayers.filter(p => p.team === 'RED');
  const team2Players = tournamentPlayers.filter(p => p.team === 'BLUE');

  const rawPlayers = Object.entries(roomData.players || {});
  const spectators = rawPlayers
    .filter(([_, p]: any) => p.team === 'none')
    .sort(([idA], [idB]) => {
      const uA = liveUsers[idA];
      const uB = liveUsers[idB];
      if (uA && !uB) return -1;
      if (!uA && uB) return 1;
      return 0;
    });

  const team1Points = teamGamePoints.RED || 0;
  const team2Points = teamGamePoints.BLUE || 0;
  
  const team1Games = teamGameWins.RED || 0;
  const team2Games = teamGameWins.BLUE || 0;
  
  const team1Sets = teamSetWins.RED || 0;
  const team2Sets = teamSetWins.BLUE || 0;

  return (
    <div className="w-full h-full flex flex-col sm:flex-row gap-2 sm:gap-3 p-2 sm:p-4 overflow-hidden relative">
      <DragRaceOverlay />
      {isHost && roomId && <HostMatchSync roomId={roomId} />}
      {!isHost && roomId && user && <GuestMatchSync roomId={roomId} slotId={user.uid} />}
      {isHost && <HostKeyboardControllerMount />}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex justify-between items-center mb-2 bg-bg-secondary p-2 sm:p-3 rounded-xl border border-border/80 relative shrink-0 shadow-2xs">
           <div className="flex-1 flex justify-center items-center gap-8 sm:gap-14">
             <div className="flex items-center gap-4 sm:gap-6 font-mono font-bold text-xl sm:text-2xl text-red-400">
               <ShapeIndicator 
                 total={settings.targetSets} 
                 filled={team1Sets} 
                 isHost={isHost} 
                 type="diamond" 
                 team="RED" 
                 onClick={() => isHost && useTournamentStore.setState(s => { 
                   s.teamSetWins.RED = s.teamSetWins.RED === settings.targetSets ? 0 : s.teamSetWins.RED + 1; 
                 })} 
               />
               <ShapeIndicator 
                 total={settings.targetGames} 
                 filled={team1Games} 
                 isHost={isHost} 
                 type="circle" 
                 team="RED" 
                 onClick={() => isHost && useTournamentStore.setState(s => { 
                   const newVal = s.teamGameWins.RED === settings.targetGames ? 0 : s.teamGameWins.RED + 1;
                   s.teamGameWins.RED = newVal;
                   if (newVal > 0) { s.teamGamePoints.RED = 0; s.teamGamePoints.BLUE = 0; }
                 })} 
               />
               <EditableScore 
                 value={team1Points} 
                 isHost={isHost} 
                 onIncrement={() => useTournamentStore.setState(s => { s.teamGamePoints.RED += 1; })}
                 onDecrement={() => useTournamentStore.setState(s => { s.teamGamePoints.RED = Math.max(0, s.teamGamePoints.RED - 1); })}
               />
             </div>
             
             <div className="font-mono font-bold text-xl sm:text-2xl text-text-secondary select-none flex items-center justify-center" title="Points to Win">
               {isHost ? (
                 <EditableScore 
                   value={settings.rankPointsFloor ?? 15} 
                   isHost={isHost} 
                   onIncrement={() => updateSettings({ rankPointsFloor: (settings.rankPointsFloor ?? 15) + 1 })}
                   onDecrement={() => updateSettings({ rankPointsFloor: Math.max(1, (settings.rankPointsFloor ?? 15) - 1) })}
                 />
               ) : (
                 <span>{settings.rankPointsFloor ?? 15}</span>
               )}
             </div>
             
             <div className="flex items-center gap-4 sm:gap-6 font-mono font-bold text-xl sm:text-2xl text-blue-400">
               <EditableScore 
                 value={team2Points} 
                 isHost={isHost} 
                 onIncrement={() => useTournamentStore.setState(s => { s.teamGamePoints.BLUE += 1; })}
                 onDecrement={() => useTournamentStore.setState(s => { s.teamGamePoints.BLUE = Math.max(0, s.teamGamePoints.BLUE - 1); })}
               />
               <ShapeIndicator 
                 total={settings.targetGames} 
                 filled={team2Games} 
                 isHost={isHost} 
                 type="circle" 
                 team="BLUE" 
                 onClick={() => isHost && useTournamentStore.setState(s => { 
                   const newVal = s.teamGameWins.BLUE === settings.targetGames ? 0 : s.teamGameWins.BLUE + 1;
                   s.teamGameWins.BLUE = newVal;
                   if (newVal > 0) { s.teamGamePoints.RED = 0; s.teamGamePoints.BLUE = 0; }
                 })} 
               />
               <ShapeIndicator 
                 total={settings.targetSets} 
                 filled={team2Sets} 
                 isHost={isHost} 
                 type="diamond" 
                 team="BLUE" 
                 onClick={() => isHost && useTournamentStore.setState(s => { 
                   s.teamSetWins.BLUE = s.teamSetWins.BLUE === settings.targetSets ? 0 : s.teamSetWins.BLUE + 1; 
                 })} 
               />
             </div>
           </div>
        </div>

        
        <div className="font-mono text-sm sm:text-base font-bold text-center tracking-wide text-text-primary mb-2 shrink-0">{currentScramble}</div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 flex-1 min-h-0 w-full mb-2">
          {/* Red Team */}
          <div 
            className="flex-1 p-2 flex flex-col min-h-0 rounded-xl border-2 border-transparent transition-colors"
            onDragOver={isHost ? (e) => { e.preventDefault(); e.currentTarget.classList.add('border-red-400/50', 'bg-red-500/5'); } : undefined}
            onDragLeave={isHost ? (e) => { e.currentTarget.classList.remove('border-red-400/50', 'bg-red-500/5'); } : undefined}
            onDrop={isHost ? (e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('border-red-400/50', 'bg-red-500/5');
              const playerId = e.dataTransfer.getData('text/plain');
              if (playerId) {
                const p = tournamentPlayers.find(p => p.id === playerId);
                if (p?.role === 'BOT') return; // Bots can't change teams
                assignTeam(playerId, '1');
              }
            } : undefined}
          >
            {team1Players.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-sm font-medium text-text-secondary/50 italic">No players</div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 overflow-y-auto flex-1 custom-scrollbar w-full">
                {team1Players.map(p => <PlayerRow key={p.id} p={p} isHost={isHost} />)}
              </div>
            )}
          </div>

          {/* Center Div: Last Match Places */}
          <div className="w-full sm:w-72 md:w-80 bg-bg-secondary p-3 rounded-xl border border-border/80 flex flex-col min-h-0 shadow-2xs shrink-0">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60 shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Last Match Places</span>
              {displayPlaces.length > 0 && (
                <span className="text-[10px] font-mono font-medium text-text-secondary/70">
                  {displayPlaces.length} {displayPlaces.length === 1 ? 'player' : 'players'}
                </span>
              )}
            </div>

            {displayPlaces.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <span className="text-xs font-medium text-text-secondary/60">No match results yet</span>
                <span className="text-[10px] text-text-secondary/40 mt-1">Places will appear here after the match</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 custom-scrollbar pr-0.5">
                {displayPlaces.map((result) => {
                  const isFirst = result.rank === 1;
                  const isSecond = result.rank === 2;
                  const isThird = result.rank === 3;
                  const formattedTime = result.isDNF
                    ? 'DNF'
                    : formatTime(result.timeMs, { penalty: result.penalty }) + (result.penalty === 'PLUS_2' ? ' (+2)' : '');

                  return (
                    <div
                      key={result.playerId}
                      className={`flex items-center justify-between px-2.5 py-2 rounded-xl transition-all border ${
                        isFirst
                          ? 'bg-amber-500/10 border-amber-500/30 text-text-primary shadow-2xs'
                          : isSecond
                          ? 'bg-slate-500/10 border-slate-400/20 text-text-primary'
                          : isThird
                          ? 'bg-amber-700/10 border-amber-700/20 text-text-primary'
                          : 'bg-bg-primary border-border/70 text-text-primary'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 text-center font-mono font-bold text-xs shrink-0 ${
                          isFirst ? 'text-amber-400' : isSecond ? 'text-slate-300' : isThird ? 'text-amber-600' : 'text-text-secondary'
                        }`}>
                          #{result.rank}
                        </span>
                        <div
                          className="w-5 h-5 rounded-md shadow-xs shrink-0"
                          style={{ backgroundColor: result.color }}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-text-primary truncate">{result.name}</span>
                          {result.team && (
                            <span className={`text-[10px] font-semibold leading-none ${result.team === 'RED' ? 'text-red-400' : 'text-blue-400'}`}>
                              {result.team === 'RED' ? 'Red' : 'Blue'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="font-mono text-xs font-bold shrink-0 ml-2">
                        <span className={result.isDNF ? 'text-red-400' : isFirst ? 'text-amber-400' : 'text-text-primary'}>
                          {formattedTime}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Blue Team */}
          <div 
            className="flex-1 p-2 flex flex-col min-h-0 rounded-xl border-2 border-transparent transition-colors"
            onDragOver={isHost ? (e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400/50', 'bg-blue-500/5'); } : undefined}
            onDragLeave={isHost ? (e) => { e.currentTarget.classList.remove('border-blue-400/50', 'bg-blue-500/5'); } : undefined}
            onDrop={isHost ? (e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('border-blue-400/50', 'bg-blue-500/5');
              const playerId = e.dataTransfer.getData('text/plain');
              if (playerId) {
                const p = tournamentPlayers.find(p => p.id === playerId);
                if (p?.role === 'BOT') return; // Bots can't change teams
                assignTeam(playerId, '2');
              }
            } : undefined}
          >
            {team2Players.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-sm font-medium text-text-secondary/50 italic">No players</div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 overflow-y-auto flex-1 custom-scrollbar w-full">
                {team2Players.map(p => <PlayerRow key={p.id} p={p} isHost={isHost} />)}
              </div>
            )}
          </div>
        </div>

        <div 
          className="flex flex-wrap items-center gap-2 mt-2 min-h-[32px] rounded-xl border-2 border-transparent transition-colors"
          onDragOver={isHost ? (e) => { e.preventDefault(); e.currentTarget.classList.add('border-accent/50', 'bg-accent/5'); } : undefined}
          onDragLeave={isHost ? (e) => { e.currentTarget.classList.remove('border-accent/50', 'bg-accent/5'); } : undefined}
          onDrop={isHost ? (e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('border-accent/50', 'bg-accent/5');
            const playerId = e.dataTransfer.getData('text/plain');
            if (playerId) {
               const isBot = tournamentPlayers.find(p => p.id === playerId)?.role === 'BOT';
               if (isBot) {
                 removePlayer(playerId);
               } else {
                 assignTeam(playerId, 'none');
               }
            }
          } : undefined}
        >
          {spectators.map(([id]: any) => {
            const u = liveUsers[id];
            const username = u?.username || roomData.players?.[id]?.username || (id === user?.uid ? 'You' : 'Guest');
            const displayU = { username, color: u?.color || '#cccccc' };
            return (
              <div 
                key={id} 
                draggable={isHost}
                onDragStart={isHost ? (e) => {
                  e.dataTransfer.setData('text/plain', id);
                } : undefined}
                className={`flex items-center gap-2 bg-bg-primary border border-border/80 rounded-lg pl-2 pr-3 py-1.5 shrink-0 ${isHost ? 'cursor-grab active:cursor-grabbing hover:border-accent/50' : ''}`}
              >
                <div className="w-5 h-5 rounded-md shadow-xs shrink-0" style={{ backgroundColor: displayU.color }} />
                <span className="text-sm font-medium text-text-primary">{displayU.username}</span>
              </div>
            );
          })}
        </div>
      </div>

      {isHost && isAdminOpen && createPortal(
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) toggleAdmin(false);
          }}
        >
          <div className="bg-bg-secondary border border-border/80 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-border/80 shrink-0">
              <h2 className="text-base font-bold text-text-primary">Match Settings</h2>
              <button 
                type="button" 
                onClick={() => toggleAdmin(false)} 
                className="p-1 text-text-secondary hover:text-text-primary rounded-lg hover:bg-bg-hover transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-text-secondary uppercase">Scoring Mode</label>
                <select 
                  value={settings.scoringMode} 
                  onChange={e => updateSettings({ scoringMode: e.target.value as 'RANK_BASED' | 'DIFFERENTIAL' })}
                  className="bg-bg-primary border border-border/80 rounded-lg p-1.5 text-xs text-text-primary outline-none focus:border-accent/50"
                >
                  <option value={ScoringMode.RANK_BASED}>Rank Based</option>
                  <option value={ScoringMode.DIFFERENTIAL}>Differential Time</option>
                </select>
              </div>
              
              {settings.scoringMode === ScoringMode.RANK_BASED && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-text-secondary uppercase truncate">1st Place Bonus</label>
                    <input type="number" min={0} value={settings.firstPlaceBonus ?? 0} onChange={e => updateSettings({ firstPlaceBonus: parseInt(e.target.value) || 0 })} className="bg-bg-primary border border-border/80 rounded-lg p-1.5 text-xs text-text-primary outline-none focus:border-accent/50" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-text-secondary uppercase truncate">Points to Win</label>
                    <input type="number" min={1} value={settings.rankPointsFloor ?? 1} onChange={e => updateSettings({ rankPointsFloor: parseInt(e.target.value) || 1 })} className="bg-bg-primary border border-border/80 rounded-lg p-1.5 text-xs text-text-primary outline-none focus:border-accent/50" />
                  </div>
                </div>
              )}
              
              {settings.scoringMode === ScoringMode.DIFFERENTIAL && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-text-secondary uppercase truncate">Gap to Win</label>
                    <input type="number" min={1} value={settings.differentialGapThreshold ?? 500} onChange={e => updateSettings({ differentialGapThreshold: parseInt(e.target.value) || 500 })} className="bg-bg-primary border border-border/80 rounded-lg p-1.5 text-xs text-text-primary outline-none focus:border-accent/50" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-text-secondary uppercase truncate">DNF Score</label>
                    <input type="number" min={0} value={settings.differentialDNFScore ?? 300} onChange={e => updateSettings({ differentialDNFScore: parseInt(e.target.value) || 300 })} className="bg-bg-primary border border-border/80 rounded-lg p-1.5 text-xs text-text-primary outline-none focus:border-accent/50" />
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-text-secondary uppercase truncate">Target Sets</label>
                  <input type="number" min={1} value={settings.targetSets} onChange={e => updateSettings({ targetSets: parseInt(e.target.value) || 1 })} className="bg-bg-primary border border-border/80 rounded-lg p-1.5 text-xs text-text-primary outline-none focus:border-accent/50" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-text-secondary uppercase truncate">Target Games</label>
                  <input type="number" min={1} value={settings.targetGames} onChange={e => updateSettings({ targetGames: parseInt(e.target.value) || 1 })} className="bg-bg-primary border border-border/80 rounded-lg p-1.5 text-xs text-text-primary outline-none focus:border-accent/50" />
                </div>
              </div>

              <div className="flex flex-col gap-1 mt-2">
                <label className="text-xs font-semibold text-text-secondary uppercase">Sound Effects</label>
                <button 
                  onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })} 
                  className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${settings.soundEnabled ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-bg-primary border-border/80 text-text-secondary hover:text-text-primary'}`}
                >
                  <span className="text-sm font-medium">{settings.soundEnabled ? 'Enabled' : 'Muted'}</span>
                  {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="border-t border-border/80 pt-3 flex flex-col gap-3">
              <button onClick={addBot} className="w-full py-2.5 rounded-xl border border-dashed border-border/80 hover:border-accent hover:text-accent hover:bg-accent/5 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer text-text-primary">
                <Bot className="w-4 h-4" /> Add Bot
              </button>
              
              <div className="flex flex-col gap-2">
                {tournamentPlayers.filter(p => p.role === 'BOT').map(bot => (
                  <div key={bot.id} className="flex flex-col bg-bg-primary p-2.5 rounded-xl border border-border/80 gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-text-primary">{bot.name}</span>
                        <span className="text-[10px] text-text-secondary uppercase">{bot.team === 'RED' ? 'Red Team' : 'Blue Team'}</span>
                      </div>
                      <button onClick={() => removePlayer(bot.id)} className="p-1 text-text-secondary hover:text-red-500 rounded hover:bg-red-500/10 cursor-pointer">
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-text-secondary uppercase">Avg (s)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          min="0"
                          value={((bot.botConfig?.averageTimeMs ?? 5000) / 1000).toFixed(1)}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) updatePlayerBotConfig(bot.id, { averageTimeMs: Math.round(val * 1000) });
                          }}
                          className="bg-bg-secondary border border-border/80 rounded-md p-1.5 text-xs text-text-primary outline-none focus:border-accent/50"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-text-secondary uppercase">StdDev (s)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          min="0"
                          value={((bot.botConfig?.stdDevMs ?? 500) / 1000).toFixed(1)}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) updatePlayerBotConfig(bot.id, { stdDevMs: Math.round(val * 1000) });
                          }}
                          className="bg-bg-secondary border border-border/80 rounded-md p-1.5 text-xs text-text-primary outline-none focus:border-accent/50"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function Arena() {
  return (
    <ArenaMatchProvider>
      <ArenaInner />
    </ArenaMatchProvider>
  );
}
