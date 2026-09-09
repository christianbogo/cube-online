import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ref, onValue, get, remove, update } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/contexts/ConfirmationContext';

export const KNOWN_PREFIXES = [
  '/', '/arena', '/logs', '/social', '/account', '/keybinds',
  '/goals', '/dev', '/privacy', '/info', '/records', '/data',
  '/stats', '/callback'
];

export function getRoomIdFromPathname(pathname: string): string | null {
  const isKnown = KNOWN_PREFIXES.some(p => pathname === p || (p !== '/' && pathname.startsWith(p + '/')));
  if (isKnown) return null;
  const segments = pathname.split('/').filter(Boolean);
  return segments.length > 0 ? segments[0] : null;
}

export function useRoomLeave() {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const location = useLocation();

  const roomId = getRoomIdFromPathname(location.pathname);
  const isRoomPage = Boolean(roomId);

  const [hostUid, setHostUid] = useState<string | null>(null);

  useEffect(() => {
    if (!isRoomPage || !roomId) {
      return;
    }
    const hostRef = ref(rtdb, `rooms/${roomId}/host`);
    const unsub = onValue(hostRef, (snap) => {
      setHostUid(snap.val() || null);
    });
    return () => {
      unsub();
      setHostUid(null);
    };
  }, [isRoomPage, roomId]);

  const confirmLeaveRoom = useCallback(async (targetPath?: string, state?: unknown): Promise<boolean> => {
    if (!isRoomPage || !roomId) {
      if (targetPath) {
        navigate(targetPath, state ? { state } : undefined);
      }
      return true;
    }

    let currentHost = hostUid;
    if (!currentHost) {
      try {
        const snap = await get(ref(rtdb, `rooms/${roomId}/host`));
        if (snap.exists()) {
          currentHost = snap.val();
        }
      } catch {
        // Fallback if unable to fetch host immediately
      }
    }

    const isHost = Boolean(user && currentHost && user.uid === currentHost);

    const title = isHost ? 'End Room' : 'Leave Room';
    const confirmText = isHost ? 'End & Leave' : 'Leave';
    const message = isHost
      ? 'Are you sure you want to leave? As the host, this will end the room for everyone.'
      : 'Are you sure you want to leave the Arena?';

    const ok = await confirm(message, {
      title,
      confirmText,
      isDanger: true,
    });

    if (!ok) return false;

    try {
      if (isHost) {
        await remove(ref(rtdb, `rooms/${roomId}`));
      } else if (user?.uid) {
        await update(ref(rtdb, `rooms/${roomId}/players`), { [user.uid]: null });
      }
    } catch (err) {
      console.error('Error leaving/ending room:', err);
    }

    if (targetPath) {
      navigate(targetPath, state ? { state } : undefined);
    }

    return true;
  }, [isRoomPage, roomId, hostUid, user, confirm, navigate]);

  return {
    isRoomPage,
    roomId,
    hostUid,
    isHost: Boolean(user && hostUid && user.uid === hostUid),
    confirmLeaveRoom,
  };
}
