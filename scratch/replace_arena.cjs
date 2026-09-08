const fs = require('fs');
let content = fs.readFileSync('src/pages/Arena.tsx', 'utf-8');

// 1. Add bot addition logic and reset score logic
const newFunctions = `
  const applyAutomaticRoundScores = () => {
    if (!user || !roomId || roomData?.host !== user.uid) return;
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

    update(ref(rtdb, \`rooms/\${roomId}/match\`), { 
      team1Score: newT1, 
      team2Score: newT2,
      round: (roomData.match?.round || 1) + 1
    });
  };

  const resetScores = () => {
    if (!user || !roomId || roomData?.host !== user.uid) return;
    update(ref(rtdb, \`rooms/\${roomId}/match\`), { 
      team1Score: 0, 
      team2Score: 0,
      round: 1
    });
  };

  const addBot = () => {
    if (!user || !roomId || roomData?.host !== user.uid) return;
    const botId = 'bot-' + Date.now();
    const botNum = Object.keys(roomData.players || {}).filter(id => id.startsWith('bot-')).length + 1;
    update(ref(rtdb, \`rooms/\${roomId}/players/\${botId}\`), {
      role: 'bot',
      team: 'none',
      username: \`Bot \${botNum}\`
    });
  };

  const removeBot = (botId: string) => {
    if (!user || !roomId || roomData?.host !== user.uid) return;
    update(ref(rtdb, \`rooms/\${roomId}/players/\${botId}\`), null);
  };
`;

content = content.replace(
  /const applyAutomaticRoundScores = \(\) => \{[\s\S]*?\};\n/,
  newFunctions
);

// 2. Adjust render logic to support bots
const newRenderVars = `
  const players = Object.entries(roomData.players || {});
  
  const team1 = players.filter(([_, p]: any) => p.team === '1');
  const team2 = players.filter(([_, p]: any) => p.team === '2');
  const spectators = players.filter(([_, p]: any) => p.team === 'none' && p.role !== 'host');

  const followedSpectators = spectators.filter(([uid]) => following.includes(uid));
  const otherSpectators = spectators.filter(([uid]) => !following.includes(uid));

  const resolveUser = (id: string, p: any) => {
    if (p.role === 'bot') {
      return { uid: id, username: p.username || 'Bot', color: '#f59e0b', status: 'IDLE', recentSolves: [] };
    }
    return liveUsers[id];
  };
`;
content = content.replace(
  /const players = Object\.entries\(roomData\.players \|\| \{\}\);\s*const team1 = [^\n]*\n\s*const team2 = [^\n]*\n\s*const spectators = [^\n]*\n\s*const followedSpectators = [^\n]*\n\s*const otherSpectators = [^\n]*\n/,
  newRenderVars
);

// 3. Rewrite return block
const returnBlock = `
  return (
    <div className="w-full h-full flex flex-col sm:flex-row gap-4 sm:gap-6 p-4 sm:p-6 overflow-hidden">
      {/* LEFT MAIN AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-3.5 h-3.5 rounded-md shrink-0 shadow-xs"
              style={{
                backgroundColor:
                  roomData.color === '#18181b'
                    ? 'var(--profile-black, #2d333b)'
                    : roomData.color || '#64748b',
              }}
            />
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight truncate">
              {roomData.name} <span className="text-text-secondary font-normal text-base sm:text-lg">· Round {roomData.match?.round || 1}</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {isHost ? (
              <button
                type="button"
                onClick={endLobby}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors cursor-pointer border border-red-500/20 shadow-xs"
              >
                End Lobby
              </button>
            ) : (
              <button
                type="button"
                onClick={leaveRoom}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer border border-border/80 shadow-xs"
              >
                Leave Room
              </button>
            )}
          </div>
        </div>
        
        {/* Scoreboard */}
        <div className="flex flex-col mb-4 bg-bg-secondary p-4 sm:p-5 rounded-xl border border-border/80 relative shrink-0 shadow-2xs">
          <div className="flex justify-center items-center gap-8 sm:gap-16">
            <div className="text-center">
              <h2 className="text-base sm:text-lg font-bold text-blue-400 mb-1">Team 1</h2>
              <div className="text-3xl sm:text-4xl font-mono font-bold text-text-primary">
                {roomData.match?.team1Score || 0}
              </div>
            </div>
            <div className="text-2xl font-bold text-text-secondary/60 select-none">VS</div>
            <div className="text-center">
              <h2 className="text-base sm:text-lg font-bold text-red-400 mb-1">Team 2</h2>
              <div className="text-3xl sm:text-4xl font-mono font-bold text-text-primary">
                {roomData.match?.team2Score || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Full width & height team / spectator columns */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 flex-1 min-h-0 w-full">
          {/* Team 1 */}
          <div className="flex-1 bg-bg-secondary p-4 rounded-xl border border-border/80 flex flex-col min-h-0 shadow-2xs">
            <h2 className="font-bold mb-3 text-sm sm:text-base text-blue-400 flex items-center justify-between shrink-0">
              <span>Team 1</span>
              <span className="text-xs font-mono font-normal text-text-secondary">({team1.length})</span>
            </h2>
            <div className="flex flex-wrap gap-2.5 overflow-y-auto flex-1 custom-scrollbar content-start">
              {team1.map(([id, p]: any) => {
                 const u = resolveUser(id, p);
                 if (!u) return null;
                 return (
                 <div key={id} className="relative group">
                   <UserCard user={u} />
                   {isHost && (
                     <button
                       type="button"
                       onClick={() => assignTeam(id, 'none')}
                       className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-sm"
                     >
                       ×
                     </button>
                   )}
                 </div>
                 );
              })}
            </div>
          </div>

          {/* Team 2 */}
          <div className="flex-1 bg-bg-secondary p-4 rounded-xl border border-border/80 flex flex-col min-h-0 shadow-2xs">
            <h2 className="font-bold mb-3 text-sm sm:text-base text-red-400 flex items-center justify-between shrink-0">
              <span>Team 2</span>
              <span className="text-xs font-mono font-normal text-text-secondary">({team2.length})</span>
            </h2>
            <div className="flex flex-wrap gap-2.5 overflow-y-auto flex-1 custom-scrollbar content-start">
              {team2.map(([id, p]: any) => {
                 const u = resolveUser(id, p);
                 if (!u) return null;
                 return (
                 <div key={id} className="relative group">
                   <UserCard user={u} />
                   {isHost && (
                     <button
                       type="button"
                       onClick={() => assignTeam(id, 'none')}
                       className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-sm"
                     >
                       ×
                     </button>
                   )}
                 </div>
                 );
              })}
            </div>
          </div>

          {/* Spectators */}
          <div className="flex-1 bg-bg-secondary p-4 rounded-xl border border-border/80 flex flex-col min-h-0 shadow-2xs">
            <h2 className="font-bold mb-3 text-sm sm:text-base text-text-primary flex items-center justify-between shrink-0">
              <span>Spectators {isHost ? '(Followed)' : ''}</span>
              <span className="text-xs font-mono font-normal text-text-secondary">({spectators.length})</span>
            </h2>
            <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
              <div className="flex flex-wrap gap-2 content-start">
                {(isHost ? followedSpectators : spectators).map(([id, p]: any) => {
                   const u = resolveUser(id, p);
                   if (!u) return null;
                   return (
                   <div key={id} className="bg-bg-primary px-3 py-1.5 rounded-xl flex items-center gap-2 border border-border/80 shadow-2xs group relative pr-16">
                     <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: u.color }} />
                     <span className="text-xs font-medium text-text-primary truncate">{u.username}</span>
                     {isHost && (
                       <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button
                           type="button"
                           onClick={() => assignTeam(id, '1')}
                           className="text-[10px] font-semibold bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                         >
                           T1
                         </button>
                         <button
                           type="button"
                           onClick={() => assignTeam(id, '2')}
                           className="text-[10px] font-semibold bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                         >
                           T2
                         </button>
                         {p.role === 'bot' && (
                           <button
                             type="button"
                             onClick={() => removeBot(id)}
                             className="text-[10px] font-semibold bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white px-1.5 py-0.5 rounded transition-colors cursor-pointer ml-1"
                           >
                             ×
                           </button>
                         )}
                       </div>
                     )}
                   </div>
                   );
                })}
              </div>

              {isHost && otherSpectators.length > 0 && (
                <div className="border-t border-border/60 pt-3">
                  <h3 className="font-semibold mb-2 text-xs text-text-secondary uppercase tracking-wider">Other Spectators</h3>
                  <div className="flex flex-wrap gap-2 content-start">
                    {otherSpectators.map(([id, p]: any) => {
                       const u = resolveUser(id, p);
                       if (!u) return null;
                       return (
                       <div key={id} className="bg-bg-primary px-3 py-1.5 rounded-xl flex items-center gap-2 border border-border/80 opacity-75 hover:opacity-100 transition-opacity shadow-2xs group relative pr-16">
                         <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: u.color }} />
                         <span className="text-xs font-medium text-text-primary truncate">{u.username}</span>
                         <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button
                             type="button"
                             onClick={() => assignTeam(id, '1')}
                             className="text-[10px] font-semibold bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                           >
                             T1
                           </button>
                           <button
                             type="button"
                             onClick={() => assignTeam(id, '2')}
                             className="text-[10px] font-semibold bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                           >
                             T2
                           </button>
                         </div>
                       </div>
                       );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="w-full sm:w-72 lg:w-80 flex flex-col gap-5 bg-bg-secondary p-5 rounded-xl border border-border/80 overflow-y-auto custom-scrollbar shrink-0 shadow-2xs">
        <h2 className="font-bold text-base text-text-primary mb-1">Match Settings</h2>
        
        {/* Match Scoring Settings */}
        {isHost && (
          <div className="flex flex-col gap-3">
            <h3 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Scoring</h3>
            
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-text-primary font-medium">Scoring Mode</span>
              <select 
                value={settings.scoringMode} 
                onChange={e => updateSettings({ scoringMode: e.target.value as any })}
                className="bg-bg-primary border border-border/80 rounded-lg px-2.5 py-2 text-xs font-medium text-text-primary focus:outline-none focus:border-accent cursor-pointer transition-colors"
              >
                <option value="RANK_BASED">Rank Based (Points)</option>
                <option value="DIFFERENTIAL">Differential (Time Gap)</option>
              </select>
            </label>

            <button 
              type="button"
              onClick={applyAutomaticRoundScores}
              className="bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white border border-emerald-500/20 px-3 py-2 rounded-lg text-xs font-semibold transition-colors mt-2 cursor-pointer text-left flex items-center justify-between"
            >
              <span>Apply Round Scores</span>
              <span>→</span>
            </button>
          </div>
        )}

        {/* Score Controls */}
        {isHost && (
          <div className="flex flex-col gap-3 pt-3 border-t border-border/60">
            <h3 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Master Score Controls</h3>
            
            <div className="flex justify-between items-center bg-bg-primary p-2.5 rounded-lg border border-border/80">
              <span className="text-xs font-medium text-blue-400">Team 1</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateScore('team1Score', -1)}
                  className="w-6 h-6 flex items-center justify-center bg-bg-secondary hover:bg-bg-tertiary rounded text-text-primary transition-colors border border-border/50 text-sm font-medium"
                >
                  -
                </button>
                <span className="text-sm font-mono font-bold w-6 text-center">{roomData.match?.team1Score || 0}</span>
                <button
                  type="button"
                  onClick={() => updateScore('team1Score', 1)}
                  className="w-6 h-6 flex items-center justify-center bg-bg-secondary hover:bg-bg-tertiary rounded text-text-primary transition-colors border border-border/50 text-sm font-medium"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center bg-bg-primary p-2.5 rounded-lg border border-border/80">
              <span className="text-xs font-medium text-red-400">Team 2</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateScore('team2Score', -1)}
                  className="w-6 h-6 flex items-center justify-center bg-bg-secondary hover:bg-bg-tertiary rounded text-text-primary transition-colors border border-border/50 text-sm font-medium"
                >
                  -
                </button>
                <span className="text-sm font-mono font-bold w-6 text-center">{roomData.match?.team2Score || 0}</span>
                <button
                  type="button"
                  onClick={() => updateScore('team2Score', 1)}
                  className="w-6 h-6 flex items-center justify-center bg-bg-secondary hover:bg-bg-tertiary rounded text-text-primary transition-colors border border-border/50 text-sm font-medium"
                >
                  +
                </button>
              </div>
            </div>

            <button 
              type="button"
              onClick={resetScores}
              className="bg-bg-hover hover:bg-red-500/10 text-text-secondary hover:text-red-400 px-3 py-2 rounded-lg text-xs font-semibold transition-colors mt-1 border border-border/50 hover:border-red-500/20 cursor-pointer"
            >
              Reset Match Score
            </button>
          </div>
        )}

        {/* Bot Management */}
        {isHost && (
          <div className="flex flex-col gap-3 pt-3 border-t border-border/60">
            <h3 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider flex justify-between items-center">
              <span>Bots</span>
              <span className="bg-bg-primary px-1.5 py-0.5 rounded border border-border/50">{spectators.filter(([, p]: any) => p.role === 'bot').length}</span>
            </h3>
            
            <button 
              type="button"
              onClick={addBot}
              className="bg-accent/10 hover:bg-accent text-accent hover:text-white border border-accent/20 px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Arena Bot</span>
            </button>
            <p className="text-[10px] text-text-secondary leading-tight mt-1">
              Bots will join as spectators. Assign them to a team from the spectators list.
            </p>
          </div>
        )}
      </div>

    </div>
  );
`;

const splitPattern = /return \(\s*<div className="w-full h-full flex flex-col p-4 sm:p-6 overflow-hidden">[\s\S]*?\);\s*\}/;
content = content.replace(splitPattern, returnBlock + "\n}");
fs.writeFileSync('src/pages/Arena.tsx', content, 'utf-8');
console.log('Successfully updated Arena.tsx');
