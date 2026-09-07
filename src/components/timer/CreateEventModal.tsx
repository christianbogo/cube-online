import { useState, useEffect } from 'react';
import { X, Plus, Info } from 'lucide-react';
import { SCRAMBLE_TYPES } from '../../utils/constants';
import { useSettings } from '../../contexts/SettingsContext';
import type { CustomEvent } from '../../types';

interface CreateEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultName?: string;
    initialScrambleType?: string;
    onCreated?: (newEvent: CustomEvent) => void;
}

export default function CreateEventModal({
    isOpen,
    onClose,
    defaultName = '',
    initialScrambleType = '333',
    onCreated
}: CreateEventModalProps) {
    const { settings, updateSettings } = useSettings();
    const [eventName, setEventName] = useState(defaultName);
    const [scrambleType, setScrambleType] = useState(initialScrambleType);

    useEffect(() => {
        if (isOpen) {
            setEventName(defaultName);
            setScrambleType(initialScrambleType);
        }
    }, [isOpen, defaultName, initialScrambleType]);

    // Close on Escape key
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

    const handleCreate = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = eventName.trim();
        if (!trimmed) return;

        const newEvent: CustomEvent = {
            id: `custom_${Date.now()}`,
            name: trimmed,
            scrambleType
        };

        updateSettings({
            customEvents: [...(settings.customEvents || []), newEvent]
        });

        if (onCreated) {
            onCreated(newEvent);
        }
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-bg-secondary border border-border/80 rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0 bg-bg-secondary">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                            <Plus className="w-4 h-4" />
                        </div>
                        <h2 className="text-sm font-bold text-text-primary">Create Custom Event</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-bg-hover rounded-lg text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                        title="Close (Esc)"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleCreate} className="p-5 flex flex-col gap-4 text-text-primary">
                    {/* Explanatory Info Box */}
                    <div className="bg-bg-primary/70 border border-border/60 rounded-xl p-3 flex items-start gap-2.5 text-text-secondary text-xs leading-relaxed">
                        <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                        <p>
                            Custom events may use an existing supported scramble generator (like 3x3x3 or Megaminx) or <strong className="text-text-primary">&quot;None&quot;</strong> if the puzzle scramble is unsupported or not needed.
                        </p>
                    </div>

                    {/* Event Name */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                            Event Name
                        </label>
                        <input
                            type="text"
                            value={eventName}
                            onChange={(e) => setEventName(e.target.value)}
                            placeholder="e.g., FTO, 3x3 One-Handed, Mirror Blocks"
                            className="bg-bg-primary border border-border/70 focus:border-accent rounded-xl px-3 py-2 text-xs text-text-primary outline-none transition-colors"
                            autoFocus
                        />
                    </div>

                    {/* Base Scramble Type */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                            Base Scramble Type
                        </label>
                        <select
                            value={scrambleType}
                            onChange={(e) => setScrambleType(e.target.value)}
                            className="bg-bg-primary border border-border/70 focus:border-accent rounded-xl px-3 py-2 text-xs text-text-primary outline-none transition-colors cursor-pointer"
                        >
                            <option value="none">None (No Scramble)</option>
                            {SCRAMBLE_TYPES.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!eventName.trim()}
                            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                        >
                            Create Event
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
