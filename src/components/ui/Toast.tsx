import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export interface ToastAction {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'ghost';
}

export interface ToastProps {
    message: string;
    visible: boolean;
    onClose: () => void;
    actions?: ToastAction[];
}

export default function Toast({ message, visible, onClose, actions }: ToastProps) {
    const [isShowing, setIsShowing] = useState(visible);

    useEffect(() => {
        setIsShowing(visible);
    }, [visible]);

    if (!isShowing) return null;

    return (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="bg-bg-secondary border border-border/50 shadow-2xl rounded-xl p-4 flex flex-col gap-3 min-w-[300px] backdrop-blur-md">
                <div className="flex items-start justify-between gap-4">
                    <p className="text-sm text-text-primary font-medium">{message}</p>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                {actions && (
                    <div className="flex items-center gap-2 justify-end">
                        {actions.map((action, idx) => (
                            <button
                                key={idx}
                                onClick={action.onClick}
                                className={`text-xs px-3 py-1.5 rounded-md transition-colors ${action.variant === 'primary'
                                        ? 'bg-accent text-white hover:bg-accent/90'
                                        : action.variant === 'ghost'
                                            ? 'text-text-secondary hover:bg-white/5'
                                            : 'bg-white/5 text-text-primary hover:bg-white/10'
                                    }`}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
