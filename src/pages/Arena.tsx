import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { rtdb } from '../lib/firebase';
import { ref, onValue, set, push, update, get } from 'firebase/database';
import { UserCard } from '../components/ui/UserCard';
import { ArenaMatchProvider, useArenaMatch } from '../arena/context/ArenaMatchContext';
import type { LiveUser } from '../types';

const BABY_NAMES = ['Liam', 'Olivia', 'Noah', 'Emma', 'Oliver', 'Ava', 'Elijah', 'Charlotte', 'William', 'Sophia'];
const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

function ArenaInner() {
  const { user } = useAuth();
  const { settings, updateSettings, calculateRoundScores } = useArenaMatch();
  
  const [rooms, setRooms] = useState<any[]>([]);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<any>(null);
  const [following, setFollowing] = useState<string[]>([]);
  const [liveUsers, setLiveUsers] = useState<Record<string, LiveUser>>({});

  useEffect(() => {
    const roomsRef = ref(rtdb, 'rooms');
    const unsubscribe = onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRooms(Object.entries(data).map(([id, val]: any) => ({ id, ...val })));
      } else {
        setRooms([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentRoom) return;
    const roomRef = ref(rtdb, `rooms/${currentRoom}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRoomData(data);
      } else {
        setCurrentRoom(null);
        setRoomData(null);
      }
    });
    return () => unsubscribe();
  }, [currentRoom]);

  useEffect(() => {
    if (roomData && user && roomData.host === user.uid) {
      get(ref(rtdb, `users/${user.uid}/following`)).then(snap => {
        const val = snap.val() || [];
        setFollowing(Array.isArray(val) ? val : Object.keys(val));
      });
    }
  }, [roomData?.host, user?.uid]);

  useEffect(() => {
    if (!currentRoom || !roomData) return;
    const usersRef = ref(rtdb, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
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
  }, [currentRoom, roomData?.players]);

  const createRoom = () => {
    if (!user) return;
    const name = BABY_NAMES[Math.floor(Math.random() * BABY_NAMES.length)];
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const roomsRef = ref(rtdb, 'rooms');
    const newRoomRef = push(roomsRef);
    set(newRoomRef, {
      name,
      color,
      host: user.uid,
      players: {
        [user.uid]: { role: 'host', team: 'none' }
      },
      match: {
        team1Score: 0,
        team2Score: 0,
        round: 1
      }
    });
    setCurrentRoom(newRoomRef.key);
  };

  const joinRoom = (roomId: string) => {
    if (!user) return;
    update(ref(rtdb, `rooms/${roomId}/players/${user.uid}`), {
      role: 'spectator',
      team: 'none'
    });
    setCurrentRoom(roomId);
  };

  const assignTeam = (playerId: string, team: string) => {
    if (!user || roomData?.host !== user.uid) return;
    update(ref(rtdb, `rooms/${currentRoom}/players/${playerId}`), { team });
  };

  const updateScore = (team: 'team1Score' | 'team2Score', delta: number) => {
    if (!user || roomData?.host !== user.uid) return;
    const newScore = Math.max(0, (roomData.match?.[team] || 0) + delta);
    update(ref(rtdb, `rooms/${currentRoom}/match`), { [team]: newScore });
  };

  const applyAutomaticRoundScores = () => {
    if (!user || roomData?.host !== user.uid) return;
    const players = Object.entries(roomData.players || {}).filter(([_, p]: any) => p.team === '1' || p.team === '2');
    
    const solvesToScore = players.map(([uid, p]: any) => {
      const u = liveUsers[uid];
      const recent = u?.recentSolves?.[0];
      if (!recent) return null;
      return {
        team: p.team,
        timeMs: recent.time,
        isDNF: recent.penalty === 'DNF',
        penalty: recent.penalty
      };
    }).filter(Boolean);

    if (solvesToScore.length === 0) return;

    const deltas = calculateRoundScores(solvesToScore, players.length);
    
    const newT1 = Math.max(0, (roomData.match?.team1Score || 0) + deltas.team1Delta);
    const newT2 = Math.max(0, (roomData.match?.team2Score || 0) + deltas.team2Delta);

    update(ref(rtdb, `rooms/${currentRoom}/match`), { 
      team1Score: newT1, 
      team2Score: newT2,
      round: (roomData.match?.round || 1) + 1
    });
  };

  if (!currentRoom || !roomData) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary">Arena Lobby</h1>
          <button 
            onClick={createRoom} 
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
          >
            Create Room
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {rooms.map(room => (
            <div 
              key={room.id} 
              onClick={() => joinRoom(room.id)}
              className="p-8 rounded-xl cursor-pointer text-white font-bold text-xl text-center shadow-md hover:shadow-lg transition-shadow"
              style={{ backgroundColor: room.color }}
            >
              {room.name}
            </div>
          ))}
          {rooms.length === 0 && (
            <div className="col-span-full text-center text-text-secondary py-12">
              No active rooms. Create one to get started!
            </div>
          )}
        </div>
      </div>
    );
  }

  const isHost = roomData.host === user?.uid;
  const players = Object.entries(roomData.players || {});
  
  const team1 = players.filter(([_, p]: any) => p.team === '1');
  const team2 = players.filter(([_, p]: any) => p.team === '2');
  const spectators = players.filter(([_, p]: any) => p.team === 'none' && p.role !== 'host');

  const followedSpectators = spectators.filter(([uid]) => following.includes(uid));
  const otherSpectators = spectators.filter(([uid]) => !following.includes(uid));

  return (
    <div className="h-full flex flex-col p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Room: {roomData.name} (Round {roomData.match?.round || 1})</h1>
        <div className="flex items-center gap-4">
          {isHost && (
            <select 
              value={settings.scoringMode} 
              onChange={e => updateSettings({ scoringMode: e.target.value as any })}
              className="bg-surface-elevation-1 border border-border rounded px-2 py-1 text-sm"
            >
              <option value="RANK_BASED">Rank Based</option>
              <option value="DIFFERENTIAL">Differential</option>
            </select>
          )}
          <button onClick={() => setCurrentRoom(null)} className="text-blue-500 hover:text-blue-600">Leave Room</button>
        </div>
      </div>
      
      {/* Scoreboard */}
      <div className="flex flex-col mb-8 bg-surface-elevation-1 p-6 rounded-xl border border-border relative">
        <div className="flex justify-center items-center gap-12">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2">Team 1</h2>
            <div className="text-4xl font-mono flex items-center gap-4">
              {isHost && <button onClick={() => updateScore('team1Score', -1)} className="text-xl bg-surface-elevation-2 px-3 py-1 rounded">-</button>}
              {roomData.match?.team1Score || 0}
              {isHost && <button onClick={() => updateScore('team1Score', 1)} className="text-xl bg-surface-elevation-2 px-3 py-1 rounded">+</button>}
            </div>
          </div>
          <div className="text-3xl font-bold text-text-secondary">VS</div>
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2">Team 2</h2>
            <div className="text-4xl font-mono flex items-center gap-4">
              {isHost && <button onClick={() => updateScore('team2Score', -1)} className="text-xl bg-surface-elevation-2 px-3 py-1 rounded">-</button>}
              {roomData.match?.team2Score || 0}
              {isHost && <button onClick={() => updateScore('team2Score', 1)} className="text-xl bg-surface-elevation-2 px-3 py-1 rounded">+</button>}
            </div>
          </div>
        </div>
        
        {isHost && (
          <div className="mt-6 flex justify-center">
            <button 
              onClick={applyAutomaticRoundScores}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors shadow-md"
            >
              Apply Recent Solves to Score
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        <div className="flex-1 bg-surface-elevation-1 p-4 rounded-xl border border-border overflow-y-auto">
          <h2 className="font-bold mb-4 text-lg">Team 1</h2>
          <div className="flex flex-wrap gap-3">
            {team1.map(([id]: any) => liveUsers[id] && (
               <div key={id} className="relative group">
                 <UserCard user={liveUsers[id]} />
                 {isHost && (
                   <button onClick={() => assignTeam(id, 'none')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100">×</button>
                 )}
               </div>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-surface-elevation-1 p-4 rounded-xl border border-border overflow-y-auto">
          <h2 className="font-bold mb-4 text-lg">Team 2</h2>
          <div className="flex flex-wrap gap-3">
            {team2.map(([id]: any) => liveUsers[id] && (
               <div key={id} className="relative group">
                 <UserCard user={liveUsers[id]} />
                 {isHost && (
                   <button onClick={() => assignTeam(id, 'none')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100">×</button>
                 )}
               </div>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-surface-elevation-1 p-4 rounded-xl border border-border flex flex-col gap-6 overflow-y-auto">
          <div>
            <h2 className="font-bold mb-4 text-lg">Spectators {isHost ? '(Followed)' : ''}</h2>
            <div className="flex flex-wrap gap-2">
              {(isHost ? followedSpectators : spectators).map(([id]: any) => liveUsers[id] && (
                 <div key={id} className="bg-surface-elevation-2 px-3 py-1.5 rounded-full flex items-center gap-2 border border-border">
                   <div className="w-2 h-2 rounded-full" style={{ backgroundColor: liveUsers[id].color }} />
                   <span className="text-sm font-medium">{liveUsers[id].username}</span>
                   {isHost && (
                     <div className="flex gap-1 ml-2">
                       <button onClick={() => assignTeam(id, '1')} className="text-xs bg-blue-500/20 text-blue-500 hover:bg-blue-500 hover:text-white px-2 py-0.5 rounded transition-colors">T1</button>
                       <button onClick={() => assignTeam(id, '2')} className="text-xs bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white px-2 py-0.5 rounded transition-colors">T2</button>
                     </div>
                   )}
                 </div>
              ))}
            </div>
          </div>

          {isHost && otherSpectators.length > 0 && (
            <div>
              <h2 className="font-bold mb-4 text-lg text-text-secondary">Other Spectators</h2>
              <div className="flex flex-wrap gap-2">
                {otherSpectators.map(([id]: any) => liveUsers[id] && (
                   <div key={id} className="bg-surface-elevation-2 px-3 py-1.5 rounded-full flex items-center gap-2 border border-border opacity-70 hover:opacity-100 transition-opacity">
                     <div className="w-2 h-2 rounded-full" style={{ backgroundColor: liveUsers[id].color }} />
                     <span className="text-sm font-medium">{liveUsers[id].username}</span>
                     <div className="flex gap-1 ml-2">
                       <button onClick={() => assignTeam(id, '1')} className="text-xs bg-blue-500/20 text-blue-500 hover:bg-blue-500 hover:text-white px-2 py-0.5 rounded transition-colors">T1</button>
                       <button onClick={() => assignTeam(id, '2')} className="text-xs bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white px-2 py-0.5 rounded transition-colors">T2</button>
                     </div>
                   </div>
                ))}
              </div>
            </div>
          )}
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
