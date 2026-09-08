import { useState, useRef, createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ConfirmOptions {
    title?: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
}

interface ConfirmationContextType {
    confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
}

const ConfirmationContext = createContext<ConfirmationContextType | undefined>(undefined);

export function ConfirmationProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [options, setOptions] = useState<ConfirmOptions>({});
    const resolverRef = useRef<((value: boolean) => void) | null>(null);

    const confirm = (msg: string, opts?: ConfirmOptions) => {
        setMessage(msg);
        setOptions(opts || {});
        setIsOpen(true);
        return new Promise<boolean>((resolve) => {
            resolverRef.current = resolve;
        });
    };

    const handleConfirm = () => {
        if (resolverRef.current) resolverRef.current(true);
        setIsOpen(false);
    };

    const handleCancel = () => {
        if (resolverRef.current) resolverRef.current(false);
        setIsOpen(false);
    };

    const confirmText = options.confirmText || 'Confirm';
    const cancelText = options.cancelText || 'Cancel';
    const title = options.title || 'Confirmation';
    const isDanger = options.isDanger ?? false;

    return (
        <ConfirmationContext.Provider value={{ confirm }}>
            {children}
            {isOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div
                        className="bg-bg-secondary w-full max-w-sm rounded-2xl shadow-2xl border border-border/80 overflow-hidden animate-in zoom-in-95 duration-200"
                        role="dialog"
                        aria-modal="true"
                    >
                        <div className="p-6 flex flex-col items-center text-center gap-3">
                            <h3 className="text-lg font-bold text-text-primary">{title}</h3>
                            <p className="text-sm text-text-secondary leading-relaxed">
                                {message}
                            </p>
                        </div>
                        <div className="flex border-t border-border/50 divide-x divide-border/50">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="flex-1 py-3 px-4 text-sm font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer"
                            >
                                {cancelText}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors cursor-pointer ${
                                    isDanger
                                        ? 'text-red-500 hover:bg-red-500/10'
                                        : 'text-accent hover:bg-accent/10'
                                }`}
                            >
                                {confirmText}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </ConfirmationContext.Provider>
    );
}

export function useConfirm() {
    const context = useContext(ConfirmationContext);
    if (!context) throw new Error('useConfirm must be used within a ConfirmationProvider');
    return context;
}
