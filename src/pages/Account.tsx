import { Settings, Check, X, LogOut, Info, Trash2, Download, Upload, TriangleAlert } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useSolves } from '../contexts/SolvesContext';
import { useState, useEffect, useRef } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Account() {
    const { settings, updateSettings } = useSettings();
    const { user, signInWithGoogle, emailSignUp, emailSignIn, logout } = useAuth();

    // Profile State
    const [username, setUsername] = useState('');
    const [selectedColor, setSelectedColor] = useState('#3b82f6');
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState('');
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const colorPickerRef = useRef<HTMLDivElement>(null);

    // Auth State
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [isSignUpMode, setIsSignUpMode] = useState(false);

    // Sync & Local Data Settings State
    const { trimSolves } = useSolves();
    const [localLimitInput, setLocalLimitInput] = useState(settings.localDataSettings?.localLimit || 250);

    useEffect(() => {
        setLocalLimitInput(settings.localDataSettings?.localLimit || 250);
    }, [settings.localDataSettings]);

    const saveLocalLimit = () => {
        if (localLimitInput !== settings.localDataSettings.localLimit) {
            if (confirm(`Saving this limit will permanently delete local solves exceeding ${localLimitInput}. This cannot be undone. Are you sure?`)) {
                updateSettings({
                    localDataSettings: { ...settings.localDataSettings, localLimit: localLimitInput }
                });
                // Trigger trim immediately
                trimSolves(localLimitInput);
            }
        }
    };

    // Initial load
    useEffect(() => {
        if (user) {
            setUsername(user.username || 'CubingUser');
            setSelectedColor(user.color || '#3b82f6');
        }
    }, [user]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
                setIsColorPickerOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const saveProfileUpdate = async (newUsername?: string, newColor?: string) => {
        if (!user) return;
        try {
            const updates: any = {};
            if (newUsername !== undefined) updates.username = newUsername;
            if (newColor !== undefined) updates.color = newColor;

            await setDoc(doc(db, 'users', user.uid), updates, { merge: true });
        } catch (e) {
            console.error("Error saving profile", e);
        }
    };

    const handleNameSubmit = () => {
        if (tempName.trim()) {
            saveProfileUpdate(tempName.trim(), undefined);
        }
        setIsEditingName(false);
    };

    const handleColorSelect = (c: string) => {
        setSelectedColor(c);
        saveProfileUpdate(undefined, c);
        setIsColorPickerOpen(false);
    };

    const handleAuthAction = async () => {
        setAuthError('');
        try {
            if (isSignUpMode) {
                if (password !== confirmPassword) {
                    setAuthError("Passwords do not match");
                    return;
                }
                await emailSignUp(email, password);
            } else {
                await emailSignIn(email, password);
            }
        } catch (e: any) {
            setAuthError(e.message || 'Authentication failed');
        }
    };

    const colors = [
        '#ef4444', '#f97316', '#eab308', '#22c55e',
        '#06b6d4', '#3b82f6', '#a855f7', '#ec4899',
        '#64748b', '#000000'
    ];

    const SettingRow = ({ label, description, children }: { label: string, description: string, children: React.ReactNode }) => (
        <div className="flex items-center justify-between py-2 group">
            <div className="flex items-center gap-2">
                <span className="text-text-primary font-medium">{label}</span>
                <div className="relative group/info">
                    <Info className="w-3.5 h-3.5 text-text-secondary/50 cursor-help" />
                    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 w-48 p-2 bg-bg-secondary border border-border rounded shadow-lg text-xs text-text-secondary opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-10 pointer-events-none">
                        {description}
                    </div>
                </div>
            </div>
            {children}
        </div>
    );



    return (
        <div className="w-full max-w-3xl flex flex-col items-start text-left p-4 sm:p-0 pb-20">

            {/* Header / Account Section */}
            {user ? (
                <div className="mb-12 w-full">
                    <div className="flex items-center gap-6 mb-2">
                        {/* Color Picker - Larger */}
                        <div className="relative" ref={colorPickerRef}>
                            <button
                                onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                                className="w-24 h-24 rounded-lg shadow-sm hover:ring-2 hover:ring-offset-2 hover:ring-text-secondary transition-all"
                                style={{ backgroundColor: selectedColor }}
                                title="Change Color"
                            />
                            {isColorPickerOpen && (
                                <div className="absolute top-28 left-0 bg-bg-secondary border border-border rounded-lg shadow-xl p-3 grid grid-cols-5 gap-2 z-50 w-64">
                                    {colors.map(c => (
                                        <button
                                            key={c}
                                            onClick={() => handleColorSelect(c)}
                                            className="w-8 h-8 rounded-md hover:scale-110 transition-transform border border-black/10"
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Name, Email, ID Stack */}
                        <div className="flex-1 flex flex-col justify-center">
                            {isEditingName ? (
                                <div className="flex items-center gap-2 mb-1">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={tempName}
                                        onChange={(e) => setTempName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleNameSubmit();
                                            if (e.key === 'Escape') setIsEditingName(false);
                                        }}
                                        className="text-3xl font-bold bg-transparent border-b-2 border-accent text-text-primary focus:outline-none w-full max-w-md"
                                    />
                                    <button onClick={handleNameSubmit} className="text-accent hover:bg-accent/10 p-1.5 rounded"><Check className="w-5 h-5" /></button>
                                    <button onClick={() => setIsEditingName(false)} className="text-red-500 hover:bg-red-500/10 p-1.5 rounded"><X className="w-5 h-5" /></button>
                                </div>
                            ) : (
                                <h1
                                    onClick={() => { setTempName(username); setIsEditingName(true); }}
                                    className="text-3xl font-bold text-text-primary cursor-pointer hover:underline decoration-dashed underline-offset-8 decoration-text-secondary/30 mb-1"
                                >
                                    {username}
                                </h1>
                            )}
                            <p className="text-text-primary text-sm opacity-80 mb-0.5">
                                {user.email}
                            </p>
                            <p className="text-text-secondary text-xs font-mono opacity-60">
                                {user.uid}
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                // Sign In / Sign Up UI remains largely the same, just keeping it clean
                <div className="mb-12 w-full">
                    <h2 className="text-3xl font-bold text-text-primary mb-6">Account</h2>
                    <div className="flex flex-col gap-6 max-w-md bg-bg-secondary/30 p-6 rounded-xl border border-border/50">
                        {!showEmailForm ? (
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={signInWithGoogle}
                                    className="bg-white text-black border border-gray-300 px-5 py-3 rounded-md hover:bg-gray-50 transition-colors font-medium flex items-center justify-center gap-3 shadow-sm w-full"
                                >
                                    <svg viewBox="0 0 24 24" className="w-5 h-5">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                    Sign in with Google
                                </button>
                                <button
                                    onClick={() => { setShowEmailForm(true); setIsSignUpMode(false); }}
                                    className="bg-bg-primary text-text-primary border border-border px-5 py-3 rounded-md hover:bg-bg-hover transition-colors font-medium w-full"
                                >
                                    Continue with Email
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4 w-full">
                                <div className="flex gap-4 border-b border-border mb-4">
                                    <button
                                        className={`pb-2 text-sm font-medium px-2 ${!isSignUpMode ? 'border-b-2 border-accent text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                                        onClick={() => { setIsSignUpMode(false); setAuthError(''); }}
                                    >
                                        Sign In
                                    </button>
                                    <button
                                        className={`pb-2 text-sm font-medium px-2 ${isSignUpMode ? 'border-b-2 border-accent text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                                        onClick={() => { setIsSignUpMode(true); setAuthError(''); }}
                                    >
                                        Create Account
                                    </button>
                                </div>

                                <input
                                    type="email"
                                    placeholder="Email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                                />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                                />
                                {isSignUpMode && (
                                    <input
                                        type="password"
                                        placeholder="Confirm Password"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                                    />
                                )}

                                {authError && <p className="text-red-500 text-sm">{authError}</p>}

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={handleAuthAction}
                                        className="bg-accent text-white px-6 py-2 rounded-md hover:bg-accent/90 font-medium"
                                    >
                                        {isSignUpMode ? 'Sign Up' : 'Sign In'}
                                    </button>
                                    <button
                                        onClick={() => setShowEmailForm(false)}
                                        className="text-text-secondary hover:text-text-primary text-sm px-4"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                        <p className="text-text-secondary text-xs text-center mt-2">
                            Sync unlimited solves across devices.
                        </p>
                    </div>
                </div>
            )}



            {/* Device Settings (Vertical List) */}
            <div className="w-full mb-12">
                <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-zinc-400" /> Device Settings
                </h3>

                <div className="flex flex-col gap-2 max-w-md w-full pl-4 border-l border-border/50 ml-2">
                    <SettingRow label="Solve Inspection" description="Enable 15s inspection timer before solve.">
                        <input
                            type="checkbox"
                            className="toggle-checkbox w-5 h-5 accent-accent cursor-pointer"
                            checked={settings.solveInspection}
                            onChange={(e) => updateSettings({ solveInspection: e.target.checked })}
                        />
                    </SettingRow>

                    <SettingRow label="Show Live Timer" description="Show running time during solve.">
                        <input
                            type="checkbox"
                            className="toggle-checkbox w-5 h-5 accent-accent cursor-pointer"
                            checked={settings.showLiveTimer}
                            onChange={(e) => updateSettings({ showLiveTimer: e.target.checked })}
                        />
                    </SettingRow>

                    <SettingRow label="Save All Local Solves" description="Keep entire history in browser storage.">
                        <input
                            type="checkbox"
                            className="toggle-checkbox w-5 h-5 accent-accent cursor-pointer"
                            checked={settings.localDataSettings.saveAll}
                            onChange={(e) => updateSettings({
                                localDataSettings: { ...settings.localDataSettings, saveAll: e.target.checked }
                            })}
                        />
                    </SettingRow>

                    {!settings.localDataSettings.saveAll && (
                        <div className="animate-in fade-in slide-in-from-top-1">
                            <SettingRow label="Local Storage Limit" description="Max number of solves to keep locally.">
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 font-mono text-sm">
                                        <input
                                            type="number"
                                            value={localLimitInput}
                                            onChange={(e) => setLocalLimitInput(parseInt(e.target.value) || 0)}
                                            className="bg-transparent border-b border-border text-text-primary w-16 text-right focus:outline-none focus:border-accent"
                                        />
                                        <span className="text-text-secondary">solves</span>
                                    </div>
                                    {localLimitInput !== settings.localDataSettings.localLimit && (
                                        <button
                                            onClick={saveLocalLimit}
                                            className="ml-2 text-xs bg-accent text-white px-2 py-1 rounded hover:bg-accent/90"
                                        >
                                            Save
                                        </button>
                                    )}
                                </div>
                            </SettingRow>
                        </div>
                    )}

                    <SettingRow label="Priming Length" description="Seconds to hold spacebar to ready (0.0 - 3.0s).">
                        <div className="flex items-center gap-1 font-mono text-sm">
                            <input
                                type="text"
                                inputMode="decimal"
                                value={settings.primingLength}
                                onChange={(e) => {
                                    // Allow typing, but validate on blur or just soft parse
                                    const val = e.target.value;
                                    // Allow numbers and decimal point
                                    if (/^\d*\.?\d*$/.test(val)) {
                                        // Update context immediately so typing works, but we might want to clamp only on blur or if valid
                                        const num = parseFloat(val);
                                        if (!isNaN(num) && num >= 0 && num <= 3) {
                                            updateSettings({ primingLength: num });
                                        }
                                    }
                                }}
                                className="bg-transparent border-b border-border text-text-primary w-12 text-right focus:outline-none focus:border-accent"
                            />
                            <span className="text-text-secondary">s</span>
                        </div>
                    </SettingRow>
                </div>
            </div>

            {/* "Dangerous Buttons" Footer */}
            {user && (
                <div className="w-full pt-8 border-t border-border mt-8">
                    <h3 className="text-sm font-semibold text-red-500 mb-4 flex items-center gap-2">
                        <TriangleAlert className="w-4 h-4" /> Dangerous Zone
                    </h3>

                    <div className="flex flex-col items-start gap-2">
                        <button
                            onClick={logout}
                            className="text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-2 px-2 py-1 hover:bg-bg-secondary rounded"
                        >
                            <LogOut className="w-3 h-3" /> Sign Out
                        </button>

                        <button disabled className="text-xs text-text-secondary/50 cursor-not-allowed flex items-center gap-2 px-2 py-1 rounded">
                            <Download className="w-3 h-3" /> Download Data (Locked)
                        </button>

                        <button disabled className="text-xs text-text-secondary/50 cursor-not-allowed flex items-center gap-2 px-2 py-1 rounded">
                            <Upload className="w-3 h-3" /> Upload Data (Locked)
                        </button>

                        <button
                            onClick={() => alert("Delete account functionality coming soon.")}
                            className="text-xs text-red-500/80 hover:text-red-500 transition-colors flex items-center gap-2 px-2 py-1 hover:bg-red-500/10 rounded"
                        >
                            <Trash2 className="w-3 h-3" /> Delete Account
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
