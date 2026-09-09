import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { soundEngine } from '@/audio/soundEffects';

interface SoundState {
  isMuted: boolean;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
}

export const useSoundStore = create<SoundState>()(
  persist(
    (set, get) => ({
      isMuted: false,
      toggleMute: () => {
        const newMuted = !get().isMuted;
        set({ isMuted: newMuted });
        soundEngine.setEnabled(!newMuted);
      },
      setMuted: (muted: boolean) => {
        set({ isMuted: muted });
        soundEngine.setEnabled(!muted);
      },
    }),
    {
      name: 'cube-online-sound-settings',
      onRehydrateStorage: () => (state) => {
        if (state) {
          soundEngine.setEnabled(!state.isMuted);
        }
      },
    }
  )
);
