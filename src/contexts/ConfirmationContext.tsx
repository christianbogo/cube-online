import { createContext, useContext, useState, useRef, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface ConfirmationContextType {
    confirm: (message: string) => Promise<boolean>;
}

const ConfirmationContext = createContext<ConfirmationContextType | undefined>(undefined);

export function ConfirmationProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const resolverRef = useRef<((value: boolean) => void) | null>(null);

    const confirm = (msg: string) => {
        setMessage(msg);
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

    return (
        <ConfirmationContext.Provider value={{ confirm }}>
            {children}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div
                        className="bg-bg-secondary w-full max-w-sm rounded-lg shadow-xl border border-border overflow-hidden animate-in zoom-in-95 duration-200"
                        role="dialog"
                        aria-modal="true"
                    >
                        <div className="p-6 flex flex-col items-center text-center gap-4">

                            <h3 className="text-lg font-semibold text-text-primary">Confirmation</h3>
                            <p className="text-sm text-text-secondary leading-relaxed">
                                {message}
                            </p>
                        </div>
                        <div className="flex border-t border-border/50 divide-x divide-border/50">
                            <button
                                onClick={handleCancel}
                                className="flex-1 py-3 px-4 text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="flex-1 py-3 px-4 text-sm font-medium text-accent hover:bg-bg-hover transition-colors font-semibold"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmationContext.Provider>
    );
}

export function useConfirm() {
    const context = useContext(ConfirmationContext);
    if (!context) throw new Error('useConfirm must be used within a ConfirmationProvider');
    return context;
}
