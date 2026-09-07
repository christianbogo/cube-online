import { Award, Flame, Info, Timer } from 'lucide-react';
import type { AppNotification } from '../../contexts/NotificationsContext';
import { formatDistanceToNow } from 'date-fns';

interface NotificationItemProps {
    notification: AppNotification;
    onRead: (id: string) => void;
    onArchive: (id: string) => void;
}

export function NotificationItem({ notification, onRead, onArchive }: NotificationItemProps) {
    const getIcon = () => {
        switch (notification.type) {
            case 'goal': return <Award className="w-5 h-5 text-accent" />;
            case 'record': return <Flame className="w-5 h-5 text-orange-500" />;
            case 'tooltip': return <Info className="w-5 h-5 text-blue-400" />;
            case 'system': return <Timer className="w-5 h-5 text-text-secondary" />;
            default: return <Info className="w-5 h-5 text-text-secondary" />;
        }
    };

    const isUnread = notification.status === 'unread';

    return (
        <div 
            className={`relative flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors border group ${
                isUnread 
                ? 'bg-bg-tertiary border-accent/30 hover:border-accent/60' 
                : 'bg-bg-secondary border-border/40 hover:bg-bg-tertiary hover:border-border'
            }`}
            onClick={() => {
                if (isUnread) onRead(notification.id);
            }}
        >
            {isUnread && (
                <div className="absolute top-3 left-1 w-1.5 h-1.5 rounded-full bg-accent" />
            )}
            <div className={`mt-0.5 shrink-0 p-1.5 rounded-md ${isUnread ? 'bg-bg-secondary shadow-inner' : 'bg-bg-tertiary'}`}>
                {getIcon()}
            </div>
            
            <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <h4 className={`text-sm font-semibold truncate ${isUnread ? 'text-text-primary' : 'text-text-secondary'}`}>
                        {notification.title}
                    </h4>
                    <span className="text-[10px] text-text-tertiary whitespace-nowrap">
                        {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                    </span>
                </div>
                <p className={`text-xs line-clamp-2 ${isUnread ? 'text-text-secondary' : 'text-text-tertiary'}`}>
                    {notification.description}
                </p>
            </div>

            {notification.status !== 'archived' && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onArchive(notification.id);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                    title="Archive"
                >
                    <span className="sr-only">Archive</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
                </button>
            )}
        </div>
    );
}
