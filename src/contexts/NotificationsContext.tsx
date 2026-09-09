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

export function NotificationsProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    
    // Only registered, authenticated accounts sync notifications
    const accountUid = user && !user.isAnonymous ? user.uid : null;

    // Synchronize notifications with the current account's Firestore document
    useEffect(() => {
        // Purge any legacy localStorage cache
        try {
            localStorage.removeItem('cube-online-notifications');
        } catch {
            // Ignore storage errors
        }

        // When logged out or in guest/anonymous mode, keep notifications empty
        if (!accountUid) {
            setNotifications([]);
            return;
        }

        // Reset notifications immediately on account switch while loading
        setNotifications([]);

        const notificationsRef = doc(db, 'users', accountUid, 'notifications', 'data');
        const unsubscribe = onSnapshot(
            notificationsRef,
            (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    if (Array.isArray(data.notifications)) {
                        setNotifications(data.notifications);
                    } else {
                        setNotifications([]);
                    }
                } else {
                    setNotifications([]);
                }
            },
            (error) => {
                console.error("Error listening to account notifications:", error);
            }
        );

        return () => {
            unsubscribe();
        };
    }, [accountUid]);

    const persistNotifications = useCallback((newNotifications: AppNotification[]) => {
        if (!accountUid) return;

        const notificationsRef = doc(db, 'users', accountUid, 'notifications', 'data');
        setDoc(notificationsRef, { notifications: newNotifications }, { merge: true }).catch(err => {
            console.error("Error syncing notifications to Firestore:", err);
        });
    }, [accountUid]);

    const upsertNotification = useCallback((notif: Omit<AppNotification, 'timestamp' | 'status'> & Partial<AppNotification>) => {
        if (!accountUid) return;

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
            persistNotifications(updated);
            return updated;
        });
    }, [accountUid, persistNotifications]);

    const removeNotification = useCallback((id: string) => {
        if (!accountUid) return;

        setNotifications(prev => {
            const updated = prev.filter(n => n.id !== id);
            persistNotifications(updated);
            return updated;
        });
    }, [accountUid, persistNotifications]);

    const markAsRead = useCallback((id: string) => {
        if (!accountUid) return;

        setNotifications(prev => {
            const updated = prev.map(n => n.id === id ? { ...n, status: 'read' as const } : n);
            persistNotifications(updated);
            return updated;
        });
    }, [accountUid, persistNotifications]);

    const archiveNotification = useCallback((id: string) => {
        if (!accountUid) return;

        setNotifications(prev => {
            const updated = prev.map(n => n.id === id ? { ...n, status: 'archived' as const } : n);
            persistNotifications(updated);
            return updated;
        });
    }, [accountUid, persistNotifications]);

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
