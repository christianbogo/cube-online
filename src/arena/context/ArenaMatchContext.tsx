import React, { createContext, useContext, useState, useEffect } from 'react';

export type ScoringMode = 'RANK_BASED' | 'DIFFERENTIAL';
export type MatchState = 'IDLE' | 'WAITING_FOR_ALL' | 'LOCKED_IN' | 'DRAG_COUNTDOWN' | 'RACING' | 'FINISHED';

export interface ArenaSettings {
  scoringMode: ScoringMode;
  firstPlaceBonus: number;
  differentialDNFScore: number;
  falseStartMultiplier: number;
}

export const defaultSettings: ArenaSettings = {
  scoringMode: 'RANK_BASED',
  firstPlaceBonus: 0,
  differentialDNFScore: 300,
  falseStartMultiplier: 1
};

interface ArenaMatchContextType {
  settings: ArenaSettings;
  updateSettings: (newSettings: Partial<ArenaSettings>) => void;
  calculateRoundScores: (solves: any[], activePlayersCount: number) => { team1Delta: number, team2Delta: number };
  matchState: MatchState;
  setMatchState: (state: MatchState) => void;
  countdownStep: number;
  startCountdown: () => void;
  resetMatch: () => void;
}

const ArenaMatchContext = createContext<ArenaMatchContextType | null>(null);

export const ArenaMatchProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  
  const [settings, setSettings] = useState<ArenaSettings>(defaultSettings);
  const [matchState, setMatchState] = useState<MatchState>('IDLE');
  const [countdownStep, setCountdownStep] = useState(0);
  const countdownTimer = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
  };

  const startCountdown = () => {
    setMatchState('DRAG_COUNTDOWN');
    setCountdownStep(0);
    clearTimer();
    
    let step = 0;
    countdownTimer.current = setInterval(() => {
      step += 1;
      setCountdownStep(step);
      if (step >= 4) {
        clearTimer();
        setMatchState('RACING');
      }
    }, 500); // 500ms per light
  };

  const resetMatch = () => {
    clearTimer();
    setMatchState('IDLE');
    setCountdownStep(0);
  };

  useEffect(() => {
    return () => clearTimer();
  }, []);


  const updateSettings = (newSettings: Partial<ArenaSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const calculateRoundScores = (solves: any[], activePlayersCount: number) => {
    // solves is array of { team, timeMs, isDNF, penalty }
    let team1Delta = 0;
    let team2Delta = 0;

    const valid = solves.filter(s => !s.isDNF);
    valid.sort((a, b) => a.timeMs - b.timeMs);
    const fastestMs = valid.length > 0 ? valid[0].timeMs : 0;

    // Apply penalties
    const processedSolves = solves.map(s => {
      let finalTimeMs = s.isDNF ? 0 : s.timeMs;
      if (s.penalty === '+2') finalTimeMs += 2000;
      // You can add false start logic if needed
      return { ...s, finalTimeMs };
    });

    processedSolves.sort((a, b) => {
      if (a.isDNF && !b.isDNF) return 1;
      if (!a.isDNF && b.isDNF) return -1;
      return a.finalTimeMs - b.finalTimeMs;
    });

    processedSolves.forEach((item, idx) => {
      const rank = idx + 1;
      let score = 0;
      
      if (settings.scoringMode === 'RANK_BASED') {
        score = item.isDNF ? 0 : Math.max(1, activePlayersCount - (rank - 1)) + (rank === 1 ? settings.firstPlaceBonus : 0);
      } else {
        score = item.isDNF ? settings.differentialDNFScore : Math.max(0, Math.round(((item.finalTimeMs - fastestMs) / 1000) * 100));
      }

      if (item.team === '1') team1Delta += score;
      if (item.team === '2') team2Delta += score;
    });

    return { team1Delta, team2Delta };
  };

  return (
    <ArenaMatchContext.Provider value={{ settings, updateSettings, calculateRoundScores, matchState, setMatchState, countdownStep, startCountdown, resetMatch }}>
      {children}
    </ArenaMatchContext.Provider>
  );
};

export const useArenaMatch = () => {
  const ctx = useContext(ArenaMatchContext);
  if (!ctx) throw new Error("useArenaMatch must be used within ArenaMatchProvider");
  return ctx;
};
