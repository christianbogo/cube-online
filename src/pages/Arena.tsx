import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Swords, X, Check, Loader2, Volume2, VolumeX, Settings, Bot, ChevronRight, Trash, Pencil } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/contexts/ConfirmationContext';
import { rtdb } from '@/lib/firebase';
import { ref, onValue, set, push, update, remove, onDisconnect } from 'firebase/database';
import { ArenaMatchProvider } from '@/arena/context/ArenaMatchContext';
import type { LiveUser } from '@/types';

import { useTimerStore } from '@/store/timerStore';
import { useTournamentStore } from '@/store/tournamentStore';
import { useKeyboardController } from '@/hooks/useKeyboardController';
import { useFinishSoundController } from '@/hooks/useFinishSoundController';
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


function AddBotCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative group rounded-xl border border-dashed border-border/80 hover:border-accent/60 bg-bg-primary/50 hover:bg-bg-hover px-3 py-2 flex items-center gap-2.5 transition-all w-full max-w-[280px] shrink-0 cursor-pointer text-left focus:outline-none"
    >
      <div className="w-6 h-6 rounded-full border border-dashed border-border/80 group-hover:border-accent/80 flex items-center justify-center shrink-0 transition-colors">
        <Plus className="w-3.5 h-3.5 text-text-secondary group-hover:text-accent transition-colors" />
      </div>
      <span className="text-sm font-bold text-text-secondary group-hover:text-accent transition-colors">
        Add bot
      </span>
    </button>
  );
}

function PlayerRow({
  p,
  isHost,
  onDelete,
  onUpdateBot,
}: {
  p: Player;
  isHost: boolean;
  onDelete?: (id: string) => void;
  onUpdateBot?: (id: string, newName: string, avgMs: number, stdDevMs: number) => void;
}) {
  const isBot = p.role === 'BOT';
  const [isHeld, setIsHeld] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const parts = p.name.includes('-') ? p.name.split('-') : [];
  const defaultAvgStr = parts[0] || (p.botConfig ? (p.botConfig.averageTimeMs / 1000).toFixed(2) : '15.00');
  const defaultStdStr = parts[1] || (p.botConfig ? (p.botConfig.stdDevMs / 1000).toString() : '1.0');

  const [avgInput, setAvgInput] = useState(defaultAvgStr);
  const [stdInput, setStdInput] = useState(defaultStdStr);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (p.name.includes('-')) {
      const [a, s] = p.name.split('-');
      setAvgInput(a);
      setStdInput(s);
    }
  }, [p.name]);

  useEffect(() => {
    if (isBot) return; // Bots never ready up
    const unsub = useTimerStore.subscribe((state) => {
      setIsHeld(!!state.players[p.id]?.isHeld);
    });
    const state = useTimerStore.getState();
    setIsHeld(!!state.players[p.id]?.isHeld);
    return unsub;
  }, [p.id, isBot]);

  const handleSave = () => {
    const cleanAvg = avgInput.trim();
    const cleanStd = stdInput.trim();
    const avgNum = Number(cleanAvg);
    const stdNum = Number(cleanStd);

    // Double check: supported finite positive numbers
    const isAvgValid = cleanAvg !== '' && !isNaN(avgNum) && isFinite(avgNum) && avgNum > 0;
    const isStdValid = cleanStd !== '' && !isNaN(stdNum) && isFinite(stdNum) && stdNum >= 0;

    if (!isAvgValid || !isStdValid) {
      setError(true);
      return;
    }

    setError(false);
    const newName = `${cleanAvg}-${cleanStd}`;
    const avgMs = Math.round(avgNum * 1000);
    const stdMs = Math.round(stdNum * 1000);

    onUpdateBot?.(p.id, newName, avgMs, stdMs);
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (p.name.includes('-')) {
      const [a, s] = p.name.split('-');
      setAvgInput(a);
      setStdInput(s);
    } else {
      setAvgInput(defaultAvgStr);
      setStdInput(defaultStdStr);
    }
    setError(false);
    setIsEditing(false);
  };

  return (
    <div
      draggable={isHost && !isBot && !isEditing}
      onDragStart={isHost && !isBot ? (e) => {
        e.dataTransfer.setData('text/plain', p.id);
      } : undefined}
      onClick={isHost && isBot && !isEditing ? () => setIsEditing(true) : undefined}
      className={`relative group rounded-xl border px-3 py-2 flex items-center gap-2.5 transition-colors w-full max-w-[280px] shrink-0 ${
        !isBot && isHeld
          ? 'bg-zinc-200 dark:bg-zinc-700 border-border'
          : 'bg-bg-primary border-border/80'
      } ${isHost && !isBot ? 'cursor-grab active:cursor-grabbing hover:border-accent/50' : ''} ${
        isHost && isBot && !isEditing ? 'cursor-pointer hover:border-accent/40' : ''
      }`}
    >
      {isBot ? (
        <div
          className="w-6 h-6 rounded-full shadow-sm shrink-0"
          style={{ backgroundColor: p.color === '#18181b' ? 'var(--profile-black, #2d333b)' : (p.color || '#64748b') }}
        />
      ) : (
        <div className="w-6 h-6 rounded-lg shadow-sm shrink-0" style={{ backgroundColor: p.color }} />
      )}

      {isEditing ? (
        <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={avgInput}
            onChange={(e) => { setAvgInput(e.target.value); setError(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
            placeholder="Avg"
            title="Average solve time (seconds)"
            className={`w-14 px-1.5 py-0.5 text-xs font-mono font-bold bg-bg-secondary border rounded text-text-primary focus:outline-none focus:ring-1 focus:ring-accent ${
              error ? 'border-red-500' : 'border-border'
            }`}
            autoFocus
          />
          <span className="text-text-secondary text-xs font-bold shrink-0">-</span>
          <input
            type="text"
            value={stdInput}
            onChange={(e) => { setStdInput(e.target.value); setError(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
            placeholder="Std"
            title="Standard deviation (seconds)"
            className={`w-12 px-1.5 py-0.5 text-xs font-mono font-bold bg-bg-secondary border rounded text-text-primary focus:outline-none focus:ring-1 focus:ring-accent ${
              error ? 'border-red-500' : 'border-border'
            }`}
          />
          <button
            type="button"
            onClick={handleSave}
            className="p-1 rounded hover:bg-emerald-500/20 text-emerald-500 transition-colors cursor-pointer shrink-0 ml-auto"
            title="Save Bot"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="p-1 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer shrink-0"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <>
          <span
            onClick={isHost && isBot ? (e) => { e.stopPropagation(); setIsEditing(true); } : undefined}
            className={`text-sm font-bold text-text-primary truncate flex-1 min-w-0 ${
              isHost && isBot ? 'cursor-pointer hover:text-accent transition-colors' : ''
            }`}
          >
            {p.name}
          </span>
          {isHost && isBot && (
            <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="p-1 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                title="Edit Bot"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(p.id);
                }}
                className="p-1 rounded hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors cursor-pointer"
                title="Delete Bot"
              >
                <Trash className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </>
      )}
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

function HostKeyboardControllerMount({ roomId }: { roomId?: string }) {
  useKeyboardController({ roomId });
  return null;
}

function HostMatchSync({ roomId }: { roomId: string }) {
  const { pushState } = useFirebaseHost(roomId);
  useEffect(() => {
    (window as any).__forcePushState = pushState;
    return () => { delete (window as any).__forcePushState; };
  }, [pushState]);
  return null;
}

function GuestMatchSync({ roomId, slotId }: { roomId: string; slotId: string }) {
  const { setHeld, pushSolve, pushPenalty } = useFirebaseGuest(roomId, slotId);

  useEffect(() => {
    (window as any).__guestPushPenalty = pushPenalty;
    return () => { delete (window as any).__guestPushPenalty; };
  }, [pushPenalty]);

  // Clean up held state on disconnect / unmount
  useEffect(() => {
    const heldSlotRef = ref(rtdb, `rooms/${roomId}/held/${slotId}`);
    onDisconnect(heldSlotRef).remove();
    return () => {
      remove(heldSlotRef).catch(console.error);
    };
  }, [roomId, slotId]);

  // Guest keyboard controller — spacebar to ready / solve
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (e.repeat) return;

      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        if ((target as HTMLInputElement).value === '') {
          target.blur();
        } else {
          return;
        }
      }

      e.preventDefault();

      const { raceState, players, raceStartTime } = useTimerStore.getState();
      const player = players[slotId];

      if (raceState === 'RACING') {
        if (player && player.isRunning && !player.isFinished) {
          const rawTimeMs = raceStartTime ? Math.max(10, Date.now() - raceStartTime) : 0;
          // Optimistic local stop so the guest's own timer freezes immediately
          useTimerStore.getState().stopPlayer(slotId, Date.now());
          pushSolve(rawTimeMs, 'NONE', 0);
        }
      } else if (raceState === 'IDLE' || raceState === 'WAITING_FOR_ALL' || raceState === 'FINISHED') {
        setHeld(true);
      }
    };

    const onUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;

      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      e.preventDefault();
      setHeld(false);
    };

    const onBlur = () => {
      setHeld(false);
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [slotId, setHeld, pushSolve]);

  return null;
}

function SyncDebuggerOverlay({ isHost }: { isHost: boolean }) {
  const [lastUpdate, setLastUpdate] = useState(0);
  const ts = useTournamentStore();
  
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[200] bg-black/80 text-green-400 font-mono text-xs p-2 rounded border border-green-500/30 whitespace-pre flex flex-col gap-1 pointer-events-auto opacity-100 shadow-xl">
      <div>Sync Role: {isHost ? 'HOST' : 'GUEST'}</div>
      <div>Points to Win (Local Store): {ts.settings.rankPointsFloor}</div>
      <div>Match ID: {ts.matchId}</div>
      <div>Scoring Mode: {ts.settings.scoringMode}</div>
      {isHost && (
        <button 
          onClick={(e) => { 
            e.preventDefault(); 
            console.log('[Host] Force sync clicked!'); 
            if (typeof (window as any).__forcePushState === 'function') {
              (window as any).__forcePushState();
            } else {
              console.log('[Host] __forcePushState not found on window');
            }
          }}
          className="mt-1 bg-green-500/20 hover:bg-green-500/40 text-green-200 px-2 py-1 rounded border border-green-500/50 cursor-pointer"
        >
          Force Sync Push
        </button>
      )}
    </div>
  );
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
    teamGamePoints, teamGameWins, teamSetWins, currentSetIndex, currentGameIndex, currentRoundIndex, lastMatchPlaces, sets, applyPenalty
  } = useTournamentStore();

  const localPlayerId = user?.uid || (isHost ? tournamentPlayers.find(p => p.role === 'HOST')?.id : undefined);
  useFinishSoundController(localPlayerId);

  const timerPlayers = useTimerStore((s) => s.players);
  const raceState = useTimerStore((s) => s.raceState);

  const handlePenalty = (playerId: string, penalty: string) => {
    const currentGame = sets?.[currentSetIndex]?.games?.[currentGameIndex];
    if (!currentGame) return;
    
    // Find the latest round that actually has solves (which corresponds to lastMatchPlaces), 
    // or fallback to the most recent round.
    const targetRoundId = currentGame.rounds.slice().reverse().find(r => Object.keys(r.solves || {}).length > 0)?.id 
      || currentGame.rounds[currentGame.rounds.length - 1]?.id;

    if (isHost) {
      applyPenalty(currentGame.id, playerId, penalty as any, targetRoundId);
    } else {
      if ((window as any).__guestPushPenalty) {
        (window as any).__guestPushPenalty(currentGame.id, penalty, targetRoundId);
      }
    }
  };

  const displayPlaces = useMemo(() => {
    if (lastMatchPlaces && lastMatchPlaces.length > 0) {
      return lastMatchPlaces;
    }
    const hasCurrentFinish = Object.values(timerPlayers).some((tp) => tp.finishRank != null);
    
    const timerEntries = Object.values(timerPlayers).filter(
      (tp) => hasCurrentFinish ? tp.finishRank != null : tp.lastFinishRank != null
    );
    if (timerEntries.length === 0) return [];

    const activePlayersCount = tournamentPlayers.filter(p => p.team === 'RED' || p.team === 'BLUE').length;
    const mapped = timerEntries.map((tp) => {
      const p = tournamentPlayers.find((x) => x.id === tp.playerId);
      const rank = (hasCurrentFinish ? tp.finishRank : tp.lastFinishRank) ?? 999;
      const timeMs = (hasCurrentFinish ? tp.finishTimeMs : tp.lastFinishTimeMs) ?? 0;
      const penalty = (hasCurrentFinish ? tp.penalty : tp.lastPenalty) ?? 'NONE';
      const isDNF = penalty === 'DNF';
      const score = (tp as any).score ?? (
        isDNF
          ? 0
          : Math.max(1, activePlayersCount - (rank - 1))
      );
      return {
        playerId: tp.playerId,
        name: p?.name || 'Player',
        color: p?.color || '#cccccc',
        team: p?.team,
        rank,
        timeMs,
        penalty,
        isDNF,
        score,
        falseStartDeltaMs: hasCurrentFinish ? tp.falseStartDeltaMs : tp.lastFalseStartDeltaMs,
      };
    });
    return mapped.sort((a, b) => a.rank - b.rank);
  }, [lastMatchPlaces, timerPlayers, tournamentPlayers, settings]);




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
        const now = Date.now();
        Object.entries(data).forEach(([id, val]: [string, any]) => {
          const players = val.players ? Object.keys(val.players) : [];
          const ageMs = now - (val.createdAt || 0);
          const heartbeatAgeMs = val.hostHeartbeat ? (now - val.hostHeartbeat) : null;
          // A room is stale/zombie if:
          // 1. It has 0 players
          // 2. The designated host is not in players
          // 3. Room is older than 20s with no host heartbeat
          // 4. Host heartbeat is older than 25s
          const isStale = (ageMs > 20000 && heartbeatAgeMs === null) || (heartbeatAgeMs !== null && heartbeatAgeMs > 25000);
          const isMissingHost = Boolean(val.host && !val.players?.[val.host] && ageMs > 10000);

          if (players.length === 0 || isMissingHost || isStale) {
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

  // Periodic check to remove stale rooms in the lobby even if no RTDB write events occur
  useEffect(() => {
    if (roomId) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setRooms((prevRooms) => {
        let changed = false;
        const filtered = prevRooms.filter((room) => {
          const ageMs = now - (room.createdAt || 0);
          const heartbeatAgeMs = room.hostHeartbeat ? (now - room.hostHeartbeat) : null;
          const isStale = (ageMs > 20000 && heartbeatAgeMs === null) || (heartbeatAgeMs !== null && heartbeatAgeMs > 25000);
          if (isStale) {
            changed = true;
            remove(ref(rtdb, `rooms/${room.id}`)).catch(() => {});
            return false;
          }
          return true;
        });
        return changed ? filtered : prevRooms;
      });
    }, 5000);
    return () => clearInterval(interval);
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

        // Check if current user is banned
        if (user && data.banned?.[user.uid]) {
          remove(ref(rtdb, `rooms/${roomId}/players/${user.uid}`)).catch(() => {});
          if (!hasRedirectedRef.current) {
            hasRedirectedRef.current = true;
            navigate('/arena', { replace: true, state: { notice: 'You are banned from this room.' } });
          }
          return;
        }

        // Check if current user was kicked
        if (user && data.kicked?.[user.uid]) {
          remove(ref(rtdb, `rooms/${roomId}/players/${user.uid}`)).catch(() => {});
          if (!hasRedirectedRef.current) {
            hasRedirectedRef.current = true;
            navigate('/arena', { replace: true, state: { notice: 'You were kicked from the room by the host.' } });
          }
          return;
        }

        // If spectator visits a room whose host is already dead/stale, clean it up
        const isSelfHost = user && roomMeta.host === user.uid;
        const ageMs = Date.now() - (roomMeta.createdAt || 0);
        const heartbeatAgeMs = data.hostHeartbeat ? (Date.now() - data.hostHeartbeat) : null;
        const isStale = !isSelfHost && ((ageMs > 20000 && heartbeatAgeMs === null) || (heartbeatAgeMs !== null && heartbeatAgeMs > 25000));

        if (isStale) {
          remove(roomRef).catch(() => {});
          if (!hasRedirectedRef.current) {
            hasRedirectedRef.current = true;
            navigate('/arena', { replace: true, state: { notice: 'The host ended the room.' } });
          }
          return;
        }

        setRoomData(roomMeta);
        roomEverLoadedRef.current = true;
        // Auto-join only once per room visit if not banned
        if (user && !user.isAnonymous && !data.banned?.[user.uid] && !hasJoinedRef.current && (!roomMeta.players || !roomMeta.players[user.uid])) {
          hasJoinedRef.current = true;
          const role = roomMeta.host === user.uid ? 'host' : 'spectator';
          update(ref(rtdb, `rooms/${roomId}/players/${user.uid}`), {
            role,
            team: 'none',
            username: user.username || user.email?.split('@')[0] || 'Unknown',
            color: user.color || '#cccccc'
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

    const roomRef = ref(rtdb, `rooms/${roomId}`);
    const playerRef = ref(rtdb, `rooms/${roomId}/players/${user.uid}`);

    if (isHost) {
      onDisconnect(playerRef).cancel().catch(() => {});
      onDisconnect(roomRef).remove();
    } else {
      onDisconnect(playerRef).remove();
    }

    return () => {
      // Clean up ONLY when navigating away from this room within the SPA
      const currentPath = window.location.pathname;
      const isNavigatingAway = !currentPath.includes(roomId);

      if (isNavigatingAway) {
        if (isHost) {
          remove(roomRef).catch(() => {});
        } else if (user?.uid) {
          update(ref(rtdb, `rooms/${roomId}/players`), { [user.uid]: null }).catch(() => {});
        }
      }
    };
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

  const lastSyncedPlayersRef = useRef('__init__');
  useEffect(() => {
    if (!roomData?.players) return;
    if (!isHost) return; // Only host manages tournamentPlayers sync from roomData; guests receive via fullState
    
    const humanPlayersToSync: Player[] = Object.entries(roomData.players)
      .filter(([, p]: [string, any]) => p.team === '1' || p.team === '2')
      .map(([id, p]: [string, any]) => {
        const u = liveUsers[id];
        const isSelf = id === user?.uid;
        const playerColor = p.color || u?.color || '#cccccc';
        return {
          id,
          name: u?.username || (roomData.players as any)?.[id]?.username || (isSelf ? 'You' : id.substring(0, 5)),
          role: (isSelf && isHost ? 'HOST' : 'PLAYER') as PlayerRole,
          key: isSelf ? ' ' : '',
          color: playerColor,
          accentColor: playerColor,
          active: true,
          team: (p.team === '1' ? 'RED' : 'BLUE') as TeamId,
        };
      });

    const botMap: Record<string, Player> = {};
    if (roomData.bots) {
      Object.entries(roomData.bots).forEach(([id, b]: [string, any]) => {
        const botColor = b.color || AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)].hex;
        botMap[id] = {
          id,
          name: b.name || '15.00-1.0',
          role: 'BOT',
          key: '',
          color: botColor,
          accentColor: botColor,
          active: true,
          team: (b.team === '1' || b.team === 'RED' ? 'RED' : 'BLUE') as TeamId,
          botConfig: {
            averageTimeMs: b.averageTimeMs || 15000,
            stdDevMs: b.stdDevMs || 1000,
            maturity: 'INTERMEDIATE',
          },
        };
      });
    }

    const currentBots = useTournamentStore.getState().players.filter(p => p.role === 'BOT');
    currentBots.forEach(b => {
      if (!botMap[b.id]) {
        botMap[b.id] = b;
      }
    });

    const allBots = Object.values(botMap);
    const syncKey = [...humanPlayersToSync, ...allBots].map(p => `${p.id}:${p.team}:${p.role}:${p.name}:${p.color}`).join('|');
    if (syncKey === lastSyncedPlayersRef.current) return;
    lastSyncedPlayersRef.current = syncKey;

    useTournamentStore.setState(s => {
      s.players = [...humanPlayersToSync, ...allBots];
    });
  }, [roomData?.players, roomData?.bots, isHost, liveUsers, user?.uid]);

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
        hostHeartbeat: Date.now(),
        gamemode: 'Standard',
        players: {
          [user.uid]: { 
            role: 'host', 
            team: 'none',
            username: user.username || user.email?.split('@')[0] || 'Unknown',
            color: user.color || '#cccccc'
          }
        },
      });
      useTournamentStore.getState().resetTournament();
      useTournamentStore.getState().updateSettings({ tournamentMode: 'TEAMS' });
      useTournamentStore.setState(s => {
        s.players = [];
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

  const handleAddBot = (team: 'RED' | 'BLUE') => {
    if (!isHost || !roomId) return;
    const botId = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const defaultAvg = '15.00';
    const defaultStd = '1.0';
    const defaultName = `${defaultAvg}-${defaultStd}`;
    const avgMs = 15000;
    const stdDevMs = 1000;
    const randomColor = AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)].hex;

    set(ref(rtdb, `rooms/${roomId}/bots/${botId}`), {
      id: botId,
      name: defaultName,
      team,
      color: randomColor,
      averageTimeMs: avgMs,
      stdDevMs,
    }).catch(console.error);

    addPlayer(defaultName, team, 'BOT', {
      averageTimeMs: avgMs,
      stdDevMs,
      maturity: 'INTERMEDIATE',
    }, botId, randomColor);
  };

  const handleDeleteBot = (botId: string) => {
    if (!isHost || !roomId) return;
    remove(ref(rtdb, `rooms/${roomId}/bots/${botId}`)).catch(console.error);
    removePlayer(botId);
  };

  const handleUpdateBot = (botId: string, newName: string, averageTimeMs: number, stdDevMs: number) => {
    if (!isHost || !roomId) return;
    update(ref(rtdb, `rooms/${roomId}/bots/${botId}`), {
      name: newName,
      averageTimeMs,
      stdDevMs,
    }).catch(console.error);

    useTournamentStore.setState(s => {
      const p = s.players.find(x => x.id === botId);
      if (p) {
        p.name = newName;
        if (!p.botConfig) {
          p.botConfig = { averageTimeMs, stdDevMs, maturity: 'INTERMEDIATE' };
        } else {
          p.botConfig.averageTimeMs = averageTimeMs;
          p.botConfig.stdDevMs = stdDevMs;
        }
      }
    });
  };

  const removePlayerFromMatch = (playerId: string) => {
    if (!isHost || !roomId) return;
    const isBot = tournamentPlayers.find(p => p.id === playerId)?.role === 'BOT';
    if (isBot) {
      handleDeleteBot(playerId);
    } else {
      assignTeam(playerId, 'none');
    }
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
                className="w-full sm:w-[260px] flex items-center gap-3.5 p-3.5 bg-bg-secondary hover:bg-bg-hover border border-border/80 hover:border-accent/60 rounded-xl cursor-pointer transition-all duration-200 shadow-2xs hover:shadow-md group text-left shrink-0 relative"
              >
                <div
                  className="w-12 h-12 rounded-xl shadow-xs shrink-0 transition-transform group-hover:scale-105"
                  style={{ backgroundColor: room.color === '#18181b' ? 'var(--profile-black, #2d333b)' : room.color || '#64748b' }}
                />
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h2 className="text-base font-bold text-text-primary truncate group-hover:text-accent transition-colors">{room.name}</h2>
                  <p className="text-text-secondary text-xs mt-0.5 truncate">{totalCount} {totalCount === 1 ? 'user' : 'users'}</p>
                </div>
                {user && room.host === user.uid && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(ref(rtdb, `rooms/${room.id}`)).catch(() => {});
                    }}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-all cursor-pointer shrink-0"
                    title="Delete Room"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                )}
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
      {isHost && roomId && <HostKeyboardControllerMount roomId={roomId} />}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="grid grid-cols-7 w-full items-center mb-1 py-1 px-4 sm:px-8 relative shrink-0 font-mono font-bold text-xl sm:text-2xl">
          <div className="flex items-center justify-center text-red-400">
            <div className="relative group flex items-center justify-center cursor-default min-w-[24px]">
              {isHost && <button onClick={() => updateSettings({ targetSets: Math.max(1, settings.targetSets - 1) })} className="absolute -left-6 opacity-0 group-hover:opacity-100 text-sm bg-bg-hover rounded px-1.5 hover:text-white transition-opacity cursor-pointer z-10">-</button>}
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
              {isHost && <button onClick={() => updateSettings({ targetSets: settings.targetSets + 1 })} className="absolute -right-6 opacity-0 group-hover:opacity-100 text-sm bg-bg-hover rounded px-1.5 hover:text-white transition-opacity cursor-pointer z-10">+</button>}
            </div>
          </div>
          
          <div className="flex items-center justify-center text-red-400">
            <div className="relative group flex items-center justify-center cursor-default min-w-[24px]">
              {isHost && <button onClick={() => updateSettings({ targetGames: Math.max(1, settings.targetGames - 1) })} className="absolute -left-6 opacity-0 group-hover:opacity-100 text-sm bg-bg-hover rounded px-1.5 hover:text-white transition-opacity cursor-pointer z-10">-</button>}
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
              {isHost && <button onClick={() => updateSettings({ targetGames: settings.targetGames + 1 })} className="absolute -right-6 opacity-0 group-hover:opacity-100 text-sm bg-bg-hover rounded px-1.5 hover:text-white transition-opacity cursor-pointer z-10">+</button>}
            </div>
          </div>
          
          <div className="flex items-center justify-center text-red-400">
            <EditableScore 
              value={team1Points} 
              isHost={isHost} 
              onIncrement={() => useTournamentStore.setState(s => { s.teamGamePoints.RED += 1; })}
              onDecrement={() => useTournamentStore.setState(s => { s.teamGamePoints.RED = Math.max(0, s.teamGamePoints.RED - 1); })}
            />
          </div>
          
          <div className="flex items-center justify-center text-text-secondary select-none" title="Points to Win">
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
          
          <div className="flex items-center justify-center text-blue-400">
            <EditableScore 
              value={team2Points} 
              isHost={isHost} 
              onIncrement={() => useTournamentStore.setState(s => { s.teamGamePoints.BLUE += 1; })}
              onDecrement={() => useTournamentStore.setState(s => { s.teamGamePoints.BLUE = Math.max(0, s.teamGamePoints.BLUE - 1); })}
            />
          </div>
          
          <div className="flex items-center justify-center text-blue-400">
            <div className="relative group flex items-center justify-center cursor-default min-w-[24px]">
              {isHost && <button onClick={() => updateSettings({ targetGames: Math.max(1, settings.targetGames - 1) })} className="absolute -left-6 opacity-0 group-hover:opacity-100 text-sm bg-bg-hover rounded px-1.5 hover:text-white transition-opacity cursor-pointer z-10">-</button>}
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
              {isHost && <button onClick={() => updateSettings({ targetGames: settings.targetGames + 1 })} className="absolute -right-6 opacity-0 group-hover:opacity-100 text-sm bg-bg-hover rounded px-1.5 hover:text-white transition-opacity cursor-pointer z-10">+</button>}
            </div>
          </div>
          
          <div className="flex items-center justify-center text-blue-400">
            <div className="relative group flex items-center justify-center cursor-default min-w-[24px]">
              {isHost && <button onClick={() => updateSettings({ targetSets: Math.max(1, settings.targetSets - 1) })} className="absolute -left-6 opacity-0 group-hover:opacity-100 text-sm bg-bg-hover rounded px-1.5 hover:text-white transition-opacity cursor-pointer z-10">-</button>}
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
              {isHost && <button onClick={() => updateSettings({ targetSets: settings.targetSets + 1 })} className="absolute -right-6 opacity-0 group-hover:opacity-100 text-sm bg-bg-hover rounded px-1.5 hover:text-white transition-opacity cursor-pointer z-10">+</button>}
            </div>
          </div>
        </div>

        
        <div className="font-mono text-lg sm:text-xl md:text-2xl font-bold text-center tracking-wide text-text-primary mb-2 shrink-0 px-2">{currentScramble}</div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 flex-1 min-h-0 w-full mb-2">
          {/* Red Team */}
          <div 
            className="group/team flex-1 p-2 flex flex-col min-h-0 rounded-xl border-2 border-transparent transition-colors"
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
            <div className="flex flex-col items-center gap-1.5 overflow-y-auto flex-1 custom-scrollbar w-full">
              {team1Players.length === 0 && (
                <div className="py-4 text-sm font-medium text-text-secondary/50 italic">No players</div>
              )}
              {team1Players.map(p => (
                <PlayerRow
                  key={p.id}
                  p={p}
                  isHost={isHost}
                  onDelete={handleDeleteBot}
                  onUpdateBot={handleUpdateBot}
                />
              ))}
              {isHost && (
                <div className="w-full flex justify-center opacity-0 pointer-events-none group-hover/team:opacity-100 group-hover/team:pointer-events-auto transition-opacity duration-150 shrink-0">
                  <AddBotCard onClick={() => handleAddBot('RED')} />
                </div>
              )}
            </div>
          </div>

          {/* Center Div: Last Match Places or Solve state */}
          <div className="w-full sm:w-64 bg-bg-secondary p-3 rounded-xl border border-border/80 flex flex-col min-h-0 shadow-2xs">
            {(() => {
              const myPlayer = user?.uid ? timerPlayers[user.uid] : null;
              const isRacing = raceState === 'RACING';
              const hideResultsForMe = isRacing && myPlayer && !myPlayer.isFinished;

              if (hideResultsForMe) {
                return (
                  <div className="flex-1 flex items-center justify-center p-4">
                    <span className="text-4xl md:text-5xl font-black text-text-primary tracking-tight">Solve</span>
                  </div>
                );
              }

              if (displayPlaces.length === 0) {
                return (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <span className="text-xs font-medium text-text-secondary/60">No match results yet</span>
                    <span className="text-[10px] text-text-secondary/40 mt-1">Places will appear here after the match</span>
                  </div>
                );
              }

              return (
                <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 custom-scrollbar pr-0.5">
                {displayPlaces.map((result) => {
                  const fsPenaltyMs = (result.falseStartDeltaMs || 0) * settings.falseStartMultiplier;
                  const formattedTime = result.isDNF
                    ? 'DNF'
                    : formatTime(result.timeMs, { penalty: result.penalty }) + (result.penalty === 'PLUS_2' ? ' (+2)' : '');

                  const activePlayersCount = tournamentPlayers.filter(p => p.team === 'RED' || p.team === 'BLUE').length;
                  const pointsEarned = result.score ?? (result.isDNF ? 0 : Math.max(1, activePlayersCount - (result.rank - 1)));
                  const isRed = result.team === 'RED' || (result.team as any) === '1';
                  const isBlue = result.team === 'BLUE' || (result.team as any) === '2';
                  const teamBgClass = isRed ? 'bg-red-500 text-white' : isBlue ? 'bg-blue-500 text-white' : 'bg-bg-tertiary text-text-secondary';
                  const isMe = result.playerId === user?.uid;
                  const isResultBot = tournamentPlayers.find(x => x.id === result.playerId)?.role === 'BOT';

                  return (
                    <div
                      key={result.playerId}
                      className={`group relative flex items-center justify-between px-2.5 py-2 rounded-xl transition-all border bg-bg-primary border-border/70 text-text-primary ${isMe ? 'hover:border-border' : ''}`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div
                          className={`w-5 h-5 rounded-md shadow-xs shrink-0 flex items-center justify-center font-mono font-bold text-xs ${teamBgClass}`}
                          title={`${pointsEarned} ${pointsEarned === 1 ? 'point' : 'points'}`}
                        >
                          {pointsEarned}
                        </div>
                        {isResultBot ? (
                          <div
                            className="w-5 h-5 rounded-full shadow-xs shrink-0"
                            style={{ backgroundColor: result.color === '#18181b' ? 'var(--profile-black, #2d333b)' : (result.color || '#64748b') }}
                          />
                        ) : (
                          <div
                            className="w-5 h-5 rounded-md shadow-xs shrink-0"
                            style={{ backgroundColor: result.color === '#18181b' ? 'var(--profile-black, #2d333b)' : result.color }}
                          />
                        )}
                        
                        {/* Name (hidden on hover if it's the current user) */}
                        <span className={`text-xs font-bold text-text-primary truncate ${isMe ? 'group-hover:hidden' : ''}`}>
                          {result.name}
                        </span>

                        {/* Action Buttons (visible only on hover if it's the current user) */}
                        {isMe && (
                          <div className="hidden group-hover:flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                handlePenalty(result.playerId, result.penalty === 'PLUS_2' ? 'NONE' : 'PLUS_2');
                              }}
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                                result.penalty === 'PLUS_2' 
                                  ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/30' 
                                  : 'bg-bg-secondary border-border/80 text-text-secondary hover:text-text-primary hover:border-text-secondary'
                              }`}
                            >
                              +2
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                handlePenalty(result.playerId, result.penalty === 'DNF' ? 'NONE' : 'DNF');
                              }}
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                                result.penalty === 'DNF' 
                                  ? 'bg-red-500/20 border-red-500/50 text-red-500 hover:bg-red-500/30' 
                                  : 'bg-bg-secondary border-border/80 text-text-secondary hover:text-text-primary hover:border-text-secondary'
                              }`}
                            >
                              DNF
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="font-mono text-xs font-bold shrink-0 ml-2 flex items-center gap-1">
                        {!result.isDNF && fsPenaltyMs > 0 && (
                          <span className="text-[10px] text-red-400">+{formatTime(fsPenaltyMs)}</span>
                        )}
                        <span className={result.isDNF ? 'text-red-400' : 'text-text-primary'}>
                          {formattedTime}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

          {/* Blue Team */}
          <div 
            className="group/team flex-1 p-2 flex flex-col min-h-0 rounded-xl border-2 border-transparent transition-colors"
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
            <div className="flex flex-col items-center gap-1.5 overflow-y-auto flex-1 custom-scrollbar w-full">
              {team2Players.length === 0 && (
                <div className="py-4 text-sm font-medium text-text-secondary/50 italic">No players</div>
              )}
              {team2Players.map(p => (
                <PlayerRow
                  key={p.id}
                  p={p}
                  isHost={isHost}
                  onDelete={handleDeleteBot}
                  onUpdateBot={handleUpdateBot}
                />
              ))}
              {isHost && (
                <div className="w-full flex justify-center opacity-0 pointer-events-none group-hover/team:opacity-100 group-hover/team:pointer-events-auto transition-opacity duration-150 shrink-0">
                  <AddBotCard onClick={() => handleAddBot('BLUE')} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div 
          className="flex flex-wrap items-center justify-center gap-2 mt-2 min-h-[32px] rounded-xl border-2 border-transparent transition-colors w-full"
          onDragOver={isHost ? (e) => { e.preventDefault(); e.currentTarget.classList.add('border-accent/50', 'bg-accent/5'); } : undefined}
          onDragLeave={isHost ? (e) => { e.currentTarget.classList.remove('border-accent/50', 'bg-accent/5'); } : undefined}
          onDrop={isHost ? (e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('border-accent/50', 'bg-accent/5');
            const playerId = e.dataTransfer.getData('text/plain');
            if (playerId) {
               const isBot = tournamentPlayers.find(p => p.id === playerId)?.role === 'BOT';
               if (isBot) {
                 handleDeleteBot(playerId);
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
