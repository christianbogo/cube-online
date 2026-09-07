import { useState } from 'react';
import { useNotifications } from '../../contexts/NotificationsContext';
import { NotificationItem } from './NotificationItem';
import { Inbox, Archive, CheckCircle2 } from 'lucide-react';

interface NotificationDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function NotificationDrawer({ isOpen }: NotificationDrawerProps) {
    const { notifications, markAsRead, archiveNotification } = useNotifications();
    const [tab, setTab] = useState<'inbox' | 'archived'>('inbox');

    if (!isOpen) return null;

    const inboxNotifications = notifications.filter(n => n.status !== 'archived');
    const archivedNotifications = notifications.filter(n => n.status === 'archived');
    
    const displayList = tab === 'inbox' ? inboxNotifications : archivedNotifications;

    return (
        <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-bg-secondary border border-border shadow-2xl rounded-xl overflow-hidden z-50 flex flex-col max-h-[80vh]">
            <div className="p-3 border-b border-border bg-bg-tertiary flex items-center justify-between">
                <h3 className="font-semibold text-text-primary pl-1">Notifications</h3>
                <div className="flex bg-bg-secondary p-0.5 rounded-lg border border-border/60">
                    <button
                        onClick={() => setTab('inbox')}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                            tab === 'inbox' 
                            ? 'bg-bg-tertiary text-text-primary shadow-sm' 
                            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                        }`}
                    >
                        <Inbox className="w-3.5 h-3.5" />
                        Inbox
                        {inboxNotifications.filter(n => n.status === 'unread').length > 0 && (
                            <span className="bg-accent text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                                {inboxNotifications.filter(n => n.status === 'unread').length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setTab('archived')}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                            tab === 'archived' 
                            ? 'bg-bg-tertiary text-text-primary shadow-sm' 
                            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                        }`}
                    >
                        <Archive className="w-3.5 h-3.5" />
                        Archive
                    </button>
                </div>
            </div>

            <div className="overflow-y-auto p-2 flex-1 scrollbar-thin">
                {displayList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-text-tertiary px-6">
                        <CheckCircle2 className="w-10 h-10 mb-3 opacity-40" />
                        <p className="text-sm font-medium">You're all caught up!</p>
                        <p className="text-xs mt-1">No {tab} notifications to show.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        {displayList.map(notif => (
                            <NotificationItem
                                key={notif.id}
                                notification={notif}
                                onRead={markAsRead}
                                onArchive={archiveNotification}
                            />
                        ))}
                    </div>
                )}
            </div>
            
            {tab === 'inbox' && inboxNotifications.length > 0 && (
                <div className="p-2 border-t border-border bg-bg-tertiary/50">
                    <button
                        onClick={() => {
                            inboxNotifications.forEach(n => {
                                if (n.status === 'unread') markAsRead(n.id);
                            });
                        }}
                        className="w-full py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors"
                    >
                        Mark all as read
                    </button>
                </div>
            )}
        </div>
    );
}
