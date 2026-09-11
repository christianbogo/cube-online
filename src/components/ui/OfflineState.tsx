import { WifiOff, RefreshCw } from 'lucide-react';

export interface OfflineStateProps {
    featureName?: string;
    message?: string;
    compact?: boolean;
    onRetry?: () => void;
}

export function OfflineState({
    featureName,
    message,
    compact = false,
    onRetry
}: OfflineStateProps) {
    const displayMessage = message || (featureName 
        ? `Connect to the internet to view and use ${featureName}.`
        : 'Connect to the internet to use this feature.');

    if (compact) {
        return (
            <div className="flex flex-col items-center justify-center p-4 text-center rounded-xl bg-bg-secondary/40 border border-border/40">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-2 text-amber-500/80">
                    <WifiOff className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-medium text-text-primary mb-1">
                    You're offline
                </h4>
                <p className="text-[11px] text-text-secondary max-w-xs leading-relaxed">
                    {displayMessage}
                </p>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="mt-3 flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-lg bg-bg-tertiary hover:bg-bg-secondary border border-border text-text-primary transition-colors cursor-pointer"
                    >
                        <RefreshCw className="w-3 h-3" />
                        <span>Check connection</span>
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="flex-1 w-full h-full min-h-[360px] flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-2xl bg-bg-secondary border border-border/60 flex items-center justify-center shadow-xs mb-4">
                <WifiOff className="w-8 h-8 text-text-secondary/60" />
            </div>

            <h3 className="text-base font-semibold text-text-primary tracking-tight mb-1.5">
                No internet connection
            </h3>

            <p className="text-xs sm:text-sm text-text-secondary max-w-md leading-relaxed">
                {displayMessage}
            </p>

            {onRetry && (
                <button
                    onClick={onRetry}
                    className="mt-4 flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-bg-secondary hover:bg-bg-tertiary border border-border text-text-primary transition-colors cursor-pointer shadow-xs"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Check again</span>
                </button>
            )}
        </div>
    );
}

export default OfflineState;
