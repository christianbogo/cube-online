import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface AppNotification {
    id: string; // e.g., 'goal-time-warm-hands', 'pb-3x3-single', 'tooltip-space-timer'
    type: 'goal' | 'record' | 'tooltip' | 'system';
    title: string;
    description: string;
    timestamp: string; // ISO string
    status: 'unread' | 'read' | 'archived';
    metadata?: any; // e.g., goalId, recordTime
}

interface NotificationsContextType {
    notifications: AppNotification[];
    unreadCount: number;
    upsertNotification: (notification: Omit<AppNotification, 'timestamp' | 'status'> & Partial<AppNotification>) => void;
    removeNotification: (id: string) => void;
    markAsRead: (id: string) => void;
    archiveNotification: (id: string) => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'cube-online-notifications';

export function NotificationsProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    
    const prevUserRef = useRef<{ uid: string } | null | undefined>(undefined);

    // Handle Auth state changes (Sign In / Sign Out)
    useEffect(() => {
        const isFirstRun = prevUserRef.current === undefined;
        const prevUser = prevUserRef.current;
        const currentUser = user;

        if (isFirstRun) {
            // Initial load: if not signed in, load from local storage
            if (!currentUser) {
                const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
                if (stored) {
                    try {
                        setNotifications(JSON.parse(stored));
                    } catch (e) {
                        console.error("Failed to parse local notifications", e);
                    }
                } else {
                    setNotifications([]);
                }
            }
        } else {
            const prevUid = prevUser?.uid;
            const currentUid = currentUser?.uid;

            if (prevUid !== currentUid) {
                // Check if this was a new account sign up
                const justSignedUpUid = sessionStorage.getItem('just_signed_up_uid');
                if (currentUid && justSignedUpUid === currentUid) {
                    // Keep existing notifications, they will be merged to Firestore in the other effect
                    sessionStorage.removeItem('just_signed_up_uid');
                } else {
                    // Regular Sign In or Sign Out: wipe local notifications
                    setNotifications([]);
                    localStorage.removeItem(LOCAL_STORAGE_KEY);
                }
            }
        }

        prevUserRef.current = currentUser;
    }, [user]);

    // Load from firestore
    useEffect(() => {
        if (!user) return;
        const notificationsRef = doc(db, 'users', user.uid, 'notifications', 'data');
        const unsubscribe = onSnapshot(notificationsRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (Array.isArray(data.notifications)) {
                    setNotifications(data.notifications);
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data.notifications));
                }
            } else {
                // Merge local storage to firestore if it doesn't exist
                const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
                let localNotes: AppNotification[] = [];
                if (stored) {
                    try {
                        localNotes = JSON.parse(stored);
                    } catch (e) {}
                }
                setDoc(notificationsRef, { notifications: localNotes }, { merge: true });
                setNotifications(localNotes);
            }
        });

        return () => unsubscribe();
    }, [user]);

    const syncNotifications = useCallback((newNotifications: AppNotification[]) => {
        setNotifications(newNotifications);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newNotifications));
        
        if (user) {
            const notificationsRef = doc(db, 'users', user.uid, 'notifications', 'data');
            setDoc(notificationsRef, { notifications: newNotifications }, { merge: true }).catch(err => {
                console.error("Error syncing notifications to Firestore:", err);
            });
        }
    }, [user]);

    const upsertNotification = useCallback((notif: Omit<AppNotification, 'timestamp' | 'status'> & Partial<AppNotification>) => {
        setNotifications(prev => {
            const existingIndex = prev.findIndex(n => n.id === notif.id);
            const newNotif: AppNotification = {
                timestamp: new Date().toISOString(),
                status: 'unread',
                ...notif,
                id: notif.id,
                type: notif.type,
                title: notif.title,
                description: notif.description,
            };
            
            let updated = [...prev];
            if (existingIndex >= 0) {
                updated[existingIndex] = { ...prev[existingIndex], ...newNotif };
            } else {
                updated.push(newNotif);
            }
            
            // Sort by timestamp desc
            updated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            
            // Schedule sync
            setTimeout(() => syncNotifications(updated), 0);
            return updated;
        });
    }, [syncNotifications]);

    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => {
            const updated = prev.filter(n => n.id !== id);
            setTimeout(() => syncNotifications(updated), 0);
            return updated;
        });
    }, [syncNotifications]);

    const markAsRead = useCallback((id: string) => {
        setNotifications(prev => {
            const updated = prev.map(n => n.id === id ? { ...n, status: 'read' as const } : n);
            setTimeout(() => syncNotifications(updated), 0);
            return updated;
        });
    }, [syncNotifications]);

    const archiveNotification = useCallback((id: string) => {
        setNotifications(prev => {
            const updated = prev.map(n => n.id === id ? { ...n, status: 'archived' as const } : n);
            setTimeout(() => syncNotifications(updated), 0);
            return updated;
        });
    }, [syncNotifications]);

    const unreadCount = notifications.filter(n => n.status === 'unread').length;

    return (
        <NotificationsContext.Provider value={{
            notifications,
            unreadCount,
            upsertNotification,
            removeNotification,
            markAsRead,
            archiveNotification
        }}>
            {children}
        </NotificationsContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationsContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationsProvider');
    }
    return context;
}
