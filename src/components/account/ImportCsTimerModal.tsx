import { useState, useRef } from 'react';
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { parseCsTimerData, createSolvesFromCsTimerSession, type ParsedCsTimerSession, type CsTimerParseResult } from '../../utils/cstimerParser';
import { useSolves, type Solve } from '../../contexts/SolvesContext';
import { useAuth } from '../../contexts/AuthContext';
import { useEvents } from '../../hooks/useEvents';
import { useSettings } from '../../contexts/SettingsContext';
import CreateEventModal from '../timer/CreateEventModal';

interface ImportCsTimerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ImportCsTimerModal({ isOpen, onClose }: ImportCsTimerModalProps) {
    const { importSolves, deleteImportedSolves, solves } = useSolves();
    const { user } = useAuth();
    const { allEvents } = useEvents();
    const { settings, updateSettings } = useSettings();

    const existingCsTimerSolvesCount = solves.filter(s => s.source === 'cstimer' || (typeof s.sessionId === 'string' && s.sessionId.startsWith('cstimer_'))).length;

    const [fileData, setFileData] = useState<{ name: string; content: string } | null>(null);
    const [parseResult, setParseResult] = useState<CsTimerParseResult | null>(null);
    const [selectedSessionKeys, setSelectedSessionKeys] = useState<Set<string>>(new Set());
    const [sessionEventOverrides, setSessionEventOverrides] = useState<Record<string, string>>({});
    const [creatingEventSession, setCreatingEventSession] = useState<{ sessionKey: string; defaultName: string } | null>(null);
    const [skipDuplicates, setSkipDuplicates] = useState(true);
    const [replaceExisting, setReplaceExisting] = useState(true);
    const [autoApprove, setAutoApprove] = useState(true);

    const [isImporting, setIsImporting] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
    const [importSummary, setImportSummary] = useState<{ imported: number; skipped: number; sessionsCount: number } | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    if (!isOpen) return null;

    const resetState = () => {
        setFileData(null);
        setParseResult(null);
        setSelectedSessionKeys(new Set());
        setIsImporting(false);
        setProgress(null);
        setImportSummary(null);
        setErrorMessage(null);
    };

    const handleClose = () => {
        if (isImporting) return;
        resetState();
        onClose();
    };

    const processFile = (file: File) => {
        setErrorMessage(null);
        const reader = new FileReader();

        reader.onload = (e) => {
            const content = e.target?.result as string;
            if (!content) {
                setErrorMessage('The selected file appears to be empty.');
                return;
            }

            const res = parseCsTimerData(content);
            if (!res.success) {
                setErrorMessage(res.error || 'Failed to parse csTimer file.');
                return;
            }

            setFileData({ name: file.name, content });
            setParseResult(res);
            // Select all sessions by default
            setSelectedSessionKeys(new Set(res.sessions.map(s => s.sessionKey)));
        };

        reader.onerror = () => {
            setErrorMessage('An error occurred while reading the file.');
        };

        reader.readAsText(file);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const toggleSession = (key: string) => {
        setSelectedSessionKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleAllSessions = () => {
        if (!parseResult) return;
        if (selectedSessionKeys.size === parseResult.sessions.length) {
            setSelectedSessionKeys(new Set());
        } else {
            setSelectedSessionKeys(new Set(parseResult.sessions.map(s => s.sessionKey)));
        }
    };

    const totalSelectedSolves = parseResult
        ? parseResult.sessions
            .filter(s => selectedSessionKeys.has(s.sessionKey))
            .reduce((sum, s) => sum + s.solves.length, 0)
        : 0;

    const handleExecuteImport = async () => {
        if (!parseResult) return;
        setIsImporting(true);
        setErrorMessage(null);

        try {
            const selectedSessions = parseResult.sessions.filter(s => selectedSessionKeys.has(s.sessionKey));
            const allSolvesToImport: Solve[] = [];

            for (const s of selectedSessions) {
                // Generate a deterministic or distinct sessionId for each csTimer session
                const sessionId = `cstimer_${s.sessionKey}_${Date.now()}`;
                const solves = createSolvesFromCsTimerSession(s, {
                    userId: user?.uid,
                    sessionId,
                    anomalyApproved: autoApprove
                });
                const overrideType = sessionEventOverrides[s.sessionKey];
                if (overrideType) {
                    solves.forEach(solve => solve.scrambleType = overrideType);
                }
                allSolvesToImport.push(...solves);
            }

            setProgress({ current: 0, total: allSolvesToImport.length });

            const res = await importSolves(allSolvesToImport, {
                skipDuplicates,
                replaceExistingImports: replaceExisting,
                onProgress: (current, total) => {
                    setProgress({ current, total });
                }
            });

            setImportSummary({
                imported: res.importedCount,
                skipped: res.skippedCount,
                sessionsCount: selectedSessions.length
            });
        } catch (err: any) {
            setErrorMessage(err.message || 'An error occurred during import.');
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-bg-secondary border border-border rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-base font-bold text-text-primary">Import csTimer Solves</h2>
                        <p className="text-xs text-text-secondary">Bring your solve history from csTimer into cube-online</p>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={isImporting}
                        className="p-1.5 hover:bg-bg-tertiary rounded-lg text-text-secondary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
                    {/* Error Banner */}
                    {errorMessage && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-xs text-red-400">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {/* Clean up banner if existing csTimer solves detected */}
                    {existingCsTimerSolvesCount > 0 && !fileData && !importSummary && (
                        <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between gap-3 text-xs">
                            <div className="text-amber-400">
                                <strong>{existingCsTimerSolvesCount}</strong> previously imported csTimer solve{existingCsTimerSolvesCount === 1 ? '' : 's'} found on your account.
                            </div>
                            <button
                                type="button"
                                onClick={async () => {
                                    if (window.confirm('Delete previously imported csTimer solves? Any manual solves you timed on cube-online will be preserved.')) {
                                        setIsImporting(true);
                                        try {
                                            const res = await deleteImportedSolves('cstimer');
                                            setErrorMessage(null);
                                        } catch (e: any) {
                                            setErrorMessage(e.message || 'Failed to delete imported solves');
                                        } finally {
                                            setIsImporting(false);
                                        }
                                    }
                                }}
                                disabled={isImporting}
                                className="px-2.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg text-xs font-semibold cursor-pointer transition-colors shrink-0 disabled:opacity-50"
                            >
                                Clear Previous Imports
                            </button>
                        </div>
                    )}

                    {/* Step 1: File Dropzone (if no file loaded) */}
                    {!fileData && !importSummary && (
                        <div
                            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                                isDragOver
                                    ? 'border-accent bg-accent/5'
                                    : 'border-border/80 hover:border-accent/60 hover:bg-bg-tertiary/40'
                            }`}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".txt,.json,.csv"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <div className="w-12 h-12 rounded-full bg-bg-tertiary border border-border/80 flex items-center justify-center text-text-secondary mb-3">
                                <UploadCloud className="w-6 h-6 text-accent" />
                            </div>
                            <span className="text-sm font-semibold text-text-primary mb-1">
                                Click to upload or drag &amp; drop
                            </span>
                            <span className="text-xs text-text-secondary max-w-sm">
                                csTimer export files (<code className="font-mono text-[11px] text-accent">.txt</code>, <code className="font-mono text-[11px] text-accent">.json</code>, or <code className="font-mono text-[11px] text-accent">.csv</code>)
                            </span>
                        </div>
                    )}

                    {/* Step 2: Session Selection & Options (file parsed) */}
                    {fileData && parseResult && !importSummary && (
                        <div className="flex flex-col gap-4">
                            {/* Summary Badge */}
                            <div className="p-3 bg-bg-primary border border-border rounded-xl flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 truncate">
                                    <FileText className="w-4 h-4 text-accent shrink-0" />
                                    <span className="font-mono text-text-primary font-medium truncate">{fileData.name}</span>
                                </div>
                                <span className="text-text-secondary shrink-0 ml-2">
                                    {parseResult.totalSolves} solves in {parseResult.sessions.length} session{parseResult.sessions.length === 1 ? '' : 's'}
                                </span>
                            </div>

                            {/* Session List */}
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                                        Select Sessions to Import
                                    </span>
                                    <button
                                        type="button"
                                        onClick={toggleAllSessions}
                                        className="text-xs text-accent hover:underline font-medium cursor-pointer"
                                    >
                                        {selectedSessionKeys.size === parseResult.sessions.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>

                                <div className="border border-border rounded-xl divide-y divide-border/60 max-h-52 overflow-y-auto bg-bg-primary/40">
                                    {parseResult.sessions.map((s: ParsedCsTimerSession) => {
                                        const isChecked = selectedSessionKeys.has(s.sessionKey);
                                        return (
                                            <div key={s.sessionKey} className={`flex items-center justify-between p-3 transition-colors ${isChecked ? 'bg-bg-secondary/60 hover:bg-bg-secondary' : 'opacity-60 hover:opacity-100 hover:bg-bg-secondary/30'}`}>
                                                <label className="flex items-center gap-3 min-w-0 cursor-pointer grow">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => toggleSession(s.sessionKey)}
                                                        className="w-4 h-4 rounded border-border text-accent focus:ring-accent accent-accent cursor-pointer"
                                                    />
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-xs font-semibold text-text-primary truncate">
                                                            {s.name}
                                                        </span>
                                                        <span className="text-[10px] text-text-secondary">
                                                            {s.solves.length} solve{s.solves.length === 1 ? '' : 's'}
                                                            {s.startDate && (
                                                                <> &bull; {new Date(s.startDate).toLocaleDateString()}{s.endDate && s.endDate !== s.startDate ? ` – ${new Date(s.endDate).toLocaleDateString()}` : ''}</>
                                                            )}
                                                        </span>
                                                    </div>
                                                </label>

                                                <div className="shrink-0 ml-2 relative group z-10">
                                                    <select
                                                        className="appearance-none text-[10px] pl-2 pr-6 py-1 rounded-full bg-accent/10 hover:bg-accent/20 text-accent font-medium border border-accent/20 outline-none cursor-pointer transition-colors"
                                                        value={sessionEventOverrides[s.sessionKey] || s.scrambleType}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (val === '__new__') {
                                                                e.target.value = sessionEventOverrides[s.sessionKey] || s.scrambleType;
                                                                setCreatingEventSession({
                                                                    sessionKey: s.sessionKey,
                                                                    defaultName: s.name || s.scrambleType
                                                                });
                                                            } else {
                                                                setSessionEventOverrides(prev => ({ ...prev, [s.sessionKey]: val }));
                                                            }
                                                        }}
                                                    >
                                                        {allEvents.map(opt => (
                                                            <option key={opt.value} value={opt.value} className="bg-bg-secondary text-text-primary">{opt.label}</option>
                                                        ))}
                                                        {!allEvents.some(e => e.value === s.scrambleType) && (
                                                            <option value={s.scrambleType} className="bg-bg-secondary text-text-primary">{s.scrambleType} (Unknown)</option>
                                                        )}
                                                        <option value="__new__" className="bg-bg-secondary text-accent font-bold">+ Create Custom Event...</option>
                                                    </select>
                                                    <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-accent/70 group-hover:text-accent transition-colors">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Options */}
                            <div className="flex flex-col gap-2.5 p-3.5 bg-bg-primary/40 border border-border/60 rounded-xl text-xs">
                                {existingCsTimerSolvesCount > 0 && (
                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={replaceExisting}
                                            onChange={(e) => setReplaceExisting(e.target.checked)}
                                            className="w-4 h-4 rounded border-border text-accent focus:ring-accent accent-accent cursor-pointer"
                                        />
                                        <span className="text-text-primary">
                                            Replace previously imported csTimer solves ({existingCsTimerSolvesCount} found) to fix dates &amp; prevent duplicates
                                        </span>
                                    </label>
                                )}

                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={skipDuplicates}
                                        onChange={(e) => setSkipDuplicates(e.target.checked)}
                                        className="w-4 h-4 rounded border-border text-accent focus:ring-accent accent-accent cursor-pointer"
                                    />
                                    <span className="text-text-primary">Skip duplicate solves (matching date, scramble, and time)</span>
                                </label>

                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={autoApprove}
                                        onChange={(e) => setAutoApprove(e.target.checked)}
                                        className="w-4 h-4 rounded border-border text-accent focus:ring-accent accent-accent cursor-pointer"
                                    />
                                    <span className="text-text-primary">Auto-approve solves (skip anomaly alerts for historical PB solves)</span>
                                </label>
                            </div>

                            {/* Progress Bar (during import) */}
                            {isImporting && progress && (
                                <div className="flex flex-col gap-1.5 p-3 bg-bg-primary border border-border rounded-xl">
                                    <div className="flex items-center justify-between text-xs text-text-secondary">
                                        <span className="flex items-center gap-1.5 font-medium text-text-primary">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                                            Importing solves...
                                        </span>
                                        <span className="font-mono">{progress.current} / {progress.total}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-accent transition-all duration-300 rounded-full"
                                            style={{
                                                width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Success Completion View */}
                    {importSummary && (
                        <div className="flex flex-col items-center justify-center text-center py-6 gap-3">
                            <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-500 mb-1 animate-in zoom-in-75 duration-200">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-text-primary">Import Complete!</h3>
                            <p className="text-xs text-text-secondary max-w-sm leading-relaxed">
                                Successfully imported <strong className="text-text-primary font-semibold">{importSummary.imported}</strong> solves across <strong className="text-text-primary font-semibold">{importSummary.sessionsCount}</strong> sessions into your account.
                                {importSummary.skipped > 0 && (
                                    <> ({importSummary.skipped} duplicate solves were skipped).</>
                                )}
                            </p>
                            <div className="mt-2 text-[11px] text-text-secondary bg-bg-primary px-3 py-1.5 rounded-lg border border-border">
                                All imported solves have a <span className="text-[10px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono border border-blue-500/20">CSTimer</span> badge in your Logs &amp; Data tables.
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 bg-bg-primary/50 border-t border-border flex items-center justify-between shrink-0">
                    {importSummary ? (
                        <div className="w-full flex justify-end">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-4 py-2 bg-accent hover:bg-accent/90 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    ) : fileData ? (
                        <>
                            <button
                                type="button"
                                onClick={resetState}
                                disabled={isImporting}
                                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer disabled:opacity-50"
                            >
                                Change File
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    disabled={isImporting}
                                    className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExecuteImport}
                                    disabled={isImporting || totalSelectedSolves === 0}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent/90 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                                >
                                    {isImporting ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            <span>Importing...</span>
                                        </>
                                    ) : (
                                        <span>Import {totalSelectedSolves} Solve{totalSelectedSolves === 1 ? '' : 's'}</span>
                                    )}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="w-full flex justify-end">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <CreateEventModal
                isOpen={!!creatingEventSession}
                onClose={() => setCreatingEventSession(null)}
                defaultName={creatingEventSession?.defaultName}
                onCreated={(newEvent) => {
                    if (creatingEventSession) {
                        setSessionEventOverrides(prev => ({
                            ...prev,
                            [creatingEventSession.sessionKey]: newEvent.id
                        }));
                    }
                    setCreatingEventSession(null);
                }}
            />
        </div>
    );
}
