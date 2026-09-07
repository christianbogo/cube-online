import { useState, useEffect } from 'react';
import {
    X,
    Minus,
    Plus,
    Trash2
} from 'lucide-react';
import { SCRAMBLE_TYPES } from '../../utils/constants';
import { useSettings } from '../../contexts/SettingsContext';
import type { FollowerDisplayOption } from '../../types';

interface TimerSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function TimerSettingsModal({ isOpen, onClose }: TimerSettingsModalProps) {
    const { settings, updateSettings } = useSettings();

    // Custom Events state
    const [isCreatingEvent, setIsCreatingEvent] = useState(false);
    const [newEventName, setNewEventName] = useState('');
    const [newEventScrambleType, setNewEventScrambleType] = useState('333');

    // Escape key listener to close
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleCreateCustomEvent = () => {
        if (!newEventName.trim()) return;
        const newEvent = {
            id: `custom_${Date.now()}`,
            name: newEventName.trim(),
            scrambleType: newEventScrambleType
        };
        updateSettings({
            customEvents: [...(settings.customEvents || []), newEvent]
        });
        setNewEventName('');
        setNewEventScrambleType('333');
        setIsCreatingEvent(false);
    };

    const handleDeleteCustomEvent = (id: string) => {
        if (!settings.customEvents) return;
        updateSettings({
            customEvents: settings.customEvents.filter(e => e.id !== id)
        });
        if (settings.scrambleType === id) {
            updateSettings({ scrambleType: '333' });
        }
    };

    const followerOptions: {
        id: FollowerDisplayOption;
        label: string;
        desc: string;
    }[] = [
        {
            id: 'default',
            label: 'Default',
            desc: 'Hidden and open followers at the top, unfollowed chips at the bottom.'
        },
        {
            id: 'minimal',
            label: 'Minimal',
            desc: 'No unfollowed chips at bottom.'
        },
        {
            id: 'popular',
            label: 'Popular',
            desc: 'Only followed chips and cards at either top or bottom.'
        }
    ];

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-bg-secondary border border-border/80 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0 bg-bg-secondary">
                    <h2 className="text-base font-bold text-text-primary">Timer Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-bg-hover rounded-lg text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                        title="Close (Esc)"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-6 text-text-primary">

                    {/* 1. SCRAMBLE CONTROLS */}
                    <div className="flex flex-col gap-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                            Scramble Controls
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {/* Hide Scramble Toggle */}
                            <div className="bg-bg-primary/50 border border-border/60 rounded-xl p-3 flex items-center justify-between gap-3">
                                <span className="text-xs font-semibold text-text-primary">
                                    Hide Scramble
                                </span>
                                <button
                                    type="button"
                                    onClick={() => updateSettings({ hideScramble: !settings.hideScramble })}
                                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                                        settings.hideScramble ? 'bg-accent' : 'bg-text-secondary/20'
                                    }`}
                                    title={settings.hideScramble ? "Unhide scramble" : "Hide scramble"}
                                >
                                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                                        settings.hideScramble ? 'translate-x-4' : 'translate-x-0'
                                    }`} />
                                </button>
                            </div>

                            {/* Pass Scramble Keybind Indicator */}
                            <div className="bg-bg-primary/50 border border-border/60 rounded-xl p-3 flex items-center justify-between gap-3">
                                <span className="text-xs font-semibold text-text-primary">
                                    Pass Scramble
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <kbd className="px-2 py-0.5 text-xs font-mono font-bold text-text-primary bg-bg-secondary border border-border rounded shadow-2xs">
                                        P
                                    </kbd>
                                    <span className="text-[11px] text-text-secondary">to pass</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. FOLLOWER DISPLAY SECTION */}
                    <div className="flex flex-col gap-3 pt-4 border-t border-border/50">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                            Follower Display
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            {followerOptions.map(opt => {
                                const isSelected = (settings.followerDisplay || 'default') === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => updateSettings({ followerDisplay: opt.id })}
                                        className={`flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer relative group ${
                                            isSelected
                                                ? 'bg-accent/10 border-accent text-text-primary shadow-xs'
                                                : 'bg-bg-primary/60 hover:bg-bg-primary border-border/70 hover:border-border text-text-secondary hover:text-text-primary'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1.5 w-full">
                                            <span className={`text-xs font-bold ${isSelected ? 'text-text-primary' : ''}`}>
                                                {opt.label}
                                            </span>
                                            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                                isSelected ? 'border-accent bg-accent' : 'border-border/80'
                                            }`}>
                                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </div>
                                        </div>
                                        <p className="text-[10px] leading-relaxed text-text-secondary">
                                            {opt.desc}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 3. TIMER ACTIVATION (PRIMING SCROLL BAR) */}
                    <div className="flex flex-col gap-3 pt-4 border-t border-border/50">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                            Timer Activation
                        </h3>

                        <div className="flex flex-col gap-2">
                            <div className="flex items-start gap-3">
                                <div className="flex-1 flex flex-col gap-1.5">
                                    <input
                                        type="range"
                                        min="0.10"
                                        max="2.00"
                                        step="0.05"
                                        value={settings.primingLength ?? 0.6}
                                        onChange={(e) => updateSettings({ primingLength: parseFloat(e.target.value) })}
                                        className="w-full accent-accent cursor-pointer h-2 bg-bg-primary rounded-lg"
                                    />
                                    <div className="relative w-full h-4 text-[10px] font-mono text-text-secondary/70">
                                        <span className="absolute left-0">0.10s</span>
                                        <span className="absolute -translate-x-1/2" style={{ left: '26.3%' }}>0.6s</span>
                                        <span className="absolute -translate-x-1/2" style={{ left: '47.4%' }}>1.00s</span>
                                        <span className="absolute right-0">2.00s</span>
                                    </div>
                                </div>
                                <span className="font-mono text-xs text-text-secondary font-medium shrink-0 h-2 flex items-center min-w-[3rem] justify-end">
                                    {(settings.primingLength ?? 0.6).toFixed(2)}s
                                </span>
                            </div>
                            <p className="text-[11px] text-text-secondary pt-0.5">
                                Spacebar hold duration required to prime the timer.
                            </p>
                        </div>
                    </div>

                    {/* 4. DISPLAY SIZING (TIMER SIZING & SCRAMBLE SIZING) */}
                    <div className="flex flex-col gap-6 pt-4 border-t border-border/50">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                            Display Sizing
                        </h3>

                        {/* Timer Sizing */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-text-primary">
                                    Timer Sizing
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs text-text-secondary">
                                        {(settings.timerSize ?? 8).toFixed(1)}rem
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => updateSettings({ timerSize: Math.max(4, (settings.timerSize ?? 8) - 0.5) })}
                                            className="p-1 rounded bg-bg-primary hover:bg-bg-hover border border-border text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                                            title="Smaller Timer"
                                        >
                                            <Minus className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => updateSettings({ timerSize: Math.min(14, (settings.timerSize ?? 8) + 0.5) })}
                                            className="p-1 rounded bg-bg-primary hover:bg-bg-hover border border-border text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                                            title="Larger Timer"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <input
                                type="range"
                                min="4.0"
                                max="14.0"
                                step="0.5"
                                value={settings.timerSize ?? 8}
                                onChange={(e) => updateSettings({ timerSize: parseFloat(e.target.value) })}
                                className="w-full accent-accent cursor-pointer h-1.5 bg-bg-primary rounded-lg"
                            />
                            {/* Centered Solve text preview with plenty of space above and beneath */}
                            <div className="py-12 flex items-center justify-center overflow-x-auto no-scrollbar select-none">
                                <span
                                    className="font-normal font-mono text-text-primary text-center leading-none"
                                    style={{ fontSize: `${settings.timerSize ?? 8}rem` }}
                                >
                                    Solve
                                </span>
                            </div>
                        </div>

                        {/* Scramble Sizing */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-text-primary">
                                    Scramble Sizing
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs text-text-secondary">
                                        {(settings.scrambleSize ?? 1.5).toFixed(1)}rem
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => updateSettings({ scrambleSize: Math.max(0.8, (settings.scrambleSize ?? 1.5) - 0.2) })}
                                            className="p-1 rounded bg-bg-primary hover:bg-bg-hover border border-border text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                                            title="Smaller Scramble"
                                        >
                                            <Minus className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => updateSettings({ scrambleSize: Math.min(3.0, (settings.scrambleSize ?? 1.5) + 0.2) })}
                                            className="p-1 rounded bg-bg-primary hover:bg-bg-hover border border-border text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                                            title="Larger Scramble"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <input
                                type="range"
                                min="0.8"
                                max="3.0"
                                step="0.1"
                                value={settings.scrambleSize ?? 1.5}
                                onChange={(e) => updateSettings({ scrambleSize: parseFloat(e.target.value) })}
                                className="w-full accent-accent cursor-pointer h-1.5 bg-bg-primary rounded-lg"
                            />
                            {/* Centered scramble example text preview with plenty of space above and beneath */}
                            <div className="py-10 flex items-center justify-center overflow-x-auto no-scrollbar select-none">
                                <span
                                    className="font-mono text-text-primary text-center leading-none"
                                    style={{ fontSize: `${settings.scrambleSize ?? 1.5}rem` }}
                                >
                                    R U R&apos; U&apos;
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 5. SOLVE & TIMER PREFERENCES */}
                    <div className="flex flex-col gap-3 pt-4 border-t border-border/50">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                            Timer Preferences
                        </h3>

                        <div className="flex flex-col gap-2">
                            {/* Inspection */}
                            <div className="bg-bg-primary/50 border border-border/60 rounded-xl p-3 flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-semibold text-text-primary">Show Inspection</span>
                                    <p className="text-[11px] text-text-secondary">Enable 15s WCA inspection countdown before timing</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => updateSettings({ solveInspection: !settings.solveInspection })}
                                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                                        settings.solveInspection ? 'bg-accent' : 'bg-text-secondary/20'
                                    }`}
                                >
                                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                                        settings.solveInspection ? 'translate-x-4' : 'translate-x-0'
                                    }`} />
                                </button>
                            </div>

                            {/* Show Live Timer */}
                            <div className="bg-bg-primary/50 border border-border/60 rounded-xl p-3 flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-semibold text-text-primary">Show Timer During Solve</span>
                                    <p className="text-[11px] text-text-secondary">Display running timer instead of &quot;SOLVE&quot; text</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => updateSettings({ showLiveTimer: !settings.showLiveTimer })}
                                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                                        settings.showLiveTimer ? 'bg-accent' : 'bg-text-secondary/20'
                                    }`}
                                >
                                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                                        settings.showLiveTimer ? 'translate-x-4' : 'translate-x-0'
                                    }`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 6. CUSTOM EVENTS */}
                    <div className="flex flex-col gap-3 pt-4 border-t border-border/50">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                                Custom Events
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsCreatingEvent(true)}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20 transition-all cursor-pointer"
                            >
                                <Plus className="w-3 h-3" />
                                <span>Add Event</span>
                            </button>
                        </div>

                        <div className="flex flex-col gap-2.5">
                            {(!settings.customEvents || settings.customEvents.length === 0) && !isCreatingEvent && (
                                <p className="text-[11px] text-text-secondary text-center py-2 italic border border-dashed border-border/50 rounded-xl">
                                    No custom events yet. Create one for special puzzles or variants!
                                </p>
                            )}

                            {isCreatingEvent && (
                                <div className="bg-bg-primary border border-accent/40 rounded-xl p-3 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                                    <div className="bg-bg-secondary/70 border border-border/60 rounded-lg p-2.5 text-[11px] text-text-secondary leading-relaxed">
                                        Custom events may use an existing supported scramble generator (like 3x3x3 or Megaminx) or <strong className="text-text-primary">&quot;None&quot;</strong> if the puzzle scramble is unsupported or not needed.
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-semibold text-text-secondary uppercase">Event Name</label>
                                        <input
                                            type="text"
                                            value={newEventName}
                                            onChange={e => setNewEventName(e.target.value)}
                                            placeholder="e.g., FTO, 3x3 One-Handed"
                                            className="bg-bg-secondary border border-border/50 rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-semibold text-text-secondary uppercase">Base Scramble Type</label>
                                        <select
                                            value={newEventScrambleType}
                                            onChange={e => setNewEventScrambleType(e.target.value)}
                                            className="bg-bg-secondary border border-border/50 rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent cursor-pointer"
                                        >
                                            <option value="none">None</option>
                                            {SCRAMBLE_TYPES.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-center justify-end gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setIsCreatingEvent(false)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCreateCustomEvent}
                                            disabled={!newEventName.trim()}
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            Create Event
                                        </button>
                                    </div>
                                </div>
                            )}

                            {settings.customEvents?.map(event => {
                                const baseOpt = SCRAMBLE_TYPES.find(o => o.value === event.scrambleType);
                                return (
                                    <div key={event.id} className="bg-bg-primary/50 border border-border/60 rounded-xl p-3 flex items-center justify-between group">
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-xs font-semibold text-text-primary truncate">{event.name}</span>
                                            <span className="text-[10px] text-text-secondary">Scramble: {baseOpt?.label || (event.scrambleType === 'none' ? 'None' : event.scrambleType)}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteCustomEvent(event.id)}
                                            className="p-1.5 rounded-md text-red-500/70 hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                            title="Delete Custom Event"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
