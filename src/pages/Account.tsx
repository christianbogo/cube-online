import { User, Settings, Shield, LogOut } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Account() {
    const { settings, updateSettings } = useSettings();
    const { user, signInWithGoogle, emailSignUp, emailSignIn, logout } = useAuth();

    const [username, setUsername] = useState('');
    const [selectedColor, setSelectedColor] = useState('#3b82f6'); // Default Blue
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    // Email Auth State
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');

    const handleEmailSignIn = async () => {
        try {
            setAuthError('');
            await emailSignIn(email, password);
        } catch (e: any) {
            setAuthError(e.message || 'Failed to sign in');
        }
    };

    const handleEmailSignUp = async () => {
        try {
            setAuthError('');
            await emailSignUp(email, password);
        } catch (e: any) {
            setAuthError(e.message || 'Failed to sign up');
        }
    };

    // Initial load of user data
    useEffect(() => {
        if (user) {
            setUsername(user.username || '');
            setSelectedColor(user.color || '#3b82f6');
        }
    }, [user]);

    const handleSaveProfile = async () => {
        if (!user) return;
        setIsSavingProfile(true);
        try {
            await setDoc(doc(db, 'users', user.uid), {
                username: username,
                color: selectedColor
            }, { merge: true });
            // Ideally notify context to reload, or context listens to changes.
            // For now simple alert or feedback
        } catch (e) {
            console.error(e);
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleSaveAllChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateSettings({
            localDataSettings: {
                ...settings.localDataSettings,
                saveAll: e.target.checked,
            }
        });
    };

    const handleSaveLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        updateSettings({
            localDataSettings: {
                ...settings.localDataSettings,
                saveLastX: parseInt(e.target.value),
            }
        });
    };

    const [primingStr, setPrimingStr] = useState(settings.primingLength.toString());

    const handlePrimingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val === '' || /^\d*\.?\d*$/.test(val)) {
            setPrimingStr(val);
            const num = parseFloat(val);
            if (!isNaN(num) && num >= 0 && num <= 10) {
                updateSettings({ primingLength: Math.min(3, num) });
            }
        }
    };

    const colors = [
        '#ef4444', // Red
        '#f97316', // Orange
        '#eab308', // Yellow
        '#22c55e', // Green
        '#06b6d4', // Cyan
        '#3b82f6', // Blue
        '#a855f7', // Purple
        '#ec4899', // Pink
    ];

    return (
        <div className="w-full max-w-2xl flex flex-col items-start text-left">
            <h2 className="text-3xl font-semibold mb-6 text-text-primary">Account & Settings</h2>

            {/* Account Section */}
            <section className="w-full mb-10">
                <h3 className="text-xl font-medium text-text-primary mb-4 flex items-center gap-2">
                    <User className="w-5 h-5" /> Account
                </h3>
                <div className="bg-bg-secondary border border-border rounded-lg p-6 space-y-6">
                    {!user ? (
                        <div className="flex flex-col gap-4">
                            <p className="text-text-secondary">
                                Sign in to save your solves to the cloud and access them from any device.
                            </p>

                            {!showEmailForm ? (
                                <div className="flex gap-3 flex-wrap">
                                    <button
                                        onClick={() => setShowEmailForm(true)}
                                        className="bg-accent text-white px-4 py-2 rounded-md hover:bg-accent/90 transition-colors font-medium border border-transparent"
                                    >
                                        Sign In with Email
                                    </button>
                                    <button
                                        onClick={signInWithGoogle}
                                        className="bg-white text-black border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors font-medium flex items-center gap-2"
                                    >
                                        <svg viewBox="0 0 24 24" className="w-5 h-5">
                                            <path
                                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                                fill="#4285F4"
                                            />
                                            <path
                                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                                fill="#34A853"
                                            />
                                            <path
                                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                                fill="#FBBC05"
                                            />
                                            <path
                                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                                fill="#EA4335"
                                            />
                                        </svg>
                                        Sign in with Google
                                    </button>
                                </div>
                            ) : (
                                <div className="max-w-xs space-y-3 p-4 border border-border rounded-md bg-bg-primary">
                                    <h4 className="font-medium text-text-primary">Email Sign In</h4>
                                    <input
                                        type="email"
                                        placeholder="Email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full bg-bg-secondary border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                                    />
                                    <input
                                        type="password"
                                        placeholder="Password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full bg-bg-secondary border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                                    />
                                    {authError && <p className="text-red-500 text-xs">{authError}</p>}
                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={handleEmailSignIn}
                                            className="bg-accent text-white px-3 py-1.5 rounded hover:bg-accent/90 text-sm font-medium"
                                        >
                                            Sign In
                                        </button>
                                        <button
                                            onClick={handleEmailSignUp}
                                            className="bg-white/10 text-text-primary border border-border px-3 py-1.5 rounded hover:bg-white/20 text-sm"
                                        >
                                            Sign Up
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowEmailForm(false);
                                                setAuthError('');
                                            }}
                                            className="ml-auto text-text-secondary hover:text-text-primary text-sm"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-start gap-4">
                                <div
                                    className="w-16 h-16 rounded-md flex-shrink-0 shadow-sm"
                                    style={{ backgroundColor: selectedColor }}
                                    title="Your Avatar"
                                />
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary uppercase mb-1">Username</label>
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="bg-bg-primary border border-border rounded-md px-3 py-2 w-full max-w-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                                            placeholder="Enter username"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary uppercase mb-2">Avatar Color</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {colors.map(c => (
                                                <button
                                                    key={c}
                                                    onClick={() => setSelectedColor(c)}
                                                    className={`w-8 h-8 rounded-md transition-transform hover:scale-110 ${selectedColor === c ? 'ring-2 ring-text-primary ring-offset-2 ring-offset-bg-secondary' : ''}`}
                                                    style={{ backgroundColor: c }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={handleSaveProfile}
                                            disabled={isSavingProfile}
                                            className="bg-accent text-white px-4 py-2 rounded-md hover:bg-accent/90 transition-colors font-medium disabled:opacity-50"
                                        >
                                            {isSavingProfile ? 'Saving...' : 'Save Profile'}
                                        </button>
                                        <button
                                            onClick={logout}
                                            className="text-red-500 border border-red-500/30 px-4 py-2 rounded-md hover:bg-red-500/10 transition-colors font-medium flex items-center gap-2"
                                        >
                                            <LogOut className="w-4 h-4" /> Sign Out
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="text-xs text-text-secondary">
                                User ID: <span className="font-mono opacity-50">{user.uid}</span>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Settings Section */}
            <section className="w-full mb-10">
                <h3 className="text-xl font-medium text-text-primary mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5" /> Settings
                </h3>
                <div className="bg-bg-secondary border border-border rounded-lg p-6 space-y-6">

                    {/* Solve Inspection */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-text-primary font-medium">Solve Inspection</p>
                            <p className="text-sm text-text-secondary">Enable 15s inspection timer before solve.</p>
                        </div>
                        <input
                            type="checkbox"
                            className="toggle-checkbox w-5 h-5 accent-accent cursor-pointer"
                            checked={settings.solveInspection}
                            onChange={(e) => updateSettings({ solveInspection: e.target.checked })}
                        />
                    </div>

                    <div className="border-t border-border" />

                    {/* Priming Length */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-text-primary font-medium">Priming Length</p>
                            <p className="text-sm text-text-secondary">Time to hold spacebar to ready (0.0 - 3.0s).</p>
                        </div>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={primingStr}
                            onChange={handlePrimingChange}
                            onBlur={() => setPrimingStr(settings.primingLength.toString())} // Reset to valid formatted value on blur
                            className="bg-bg-primary border border-border rounded-md px-3 py-1.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 w-24 text-right font-mono"
                        />
                    </div>

                    <div className="border-t border-border" />

                    {/* Show Live Timer */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-text-primary font-medium">Show Live Timer</p>
                            <p className="text-sm text-text-secondary">Show running time during solve.</p>
                        </div>
                        <input
                            type="checkbox"
                            className="toggle-checkbox w-5 h-5 accent-accent cursor-pointer"
                            checked={settings.showLiveTimer}
                            onChange={(e) => updateSettings({ showLiveTimer: e.target.checked })}
                        />
                    </div>

                    <div className="border-t border-border" />

                    {/* Local Data Settings */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-text-primary font-medium">Save All Solves Locally</p>
                                <p className="text-sm text-text-secondary">Keep entire history in browser storage.</p>
                            </div>
                            <input
                                type="checkbox"
                                className="toggle-checkbox w-5 h-5 accent-accent cursor-pointer"
                                checked={settings.localDataSettings.saveAll}
                                onChange={handleSaveAllChange}
                            />
                        </div>

                        {!settings.localDataSettings.saveAll && (
                            <div className="flex items-center justify-between pl-4 border-l-2 border-border/50">
                                <div>
                                    <p className="text-text-primary font-medium">History Limit</p>
                                    <p className="text-sm text-text-secondary">Number of recent solves to keep.</p>
                                </div>
                                <select
                                    value={settings.localDataSettings.saveLastX}
                                    onChange={handleSaveLimitChange}
                                    className="bg-bg-primary border border-border rounded-md px-3 py-1.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                                >
                                    <option value="100">Last 100</option>
                                    <option value="12">Last 12</option>
                                    <option value="5">Last 5</option>
                                    <option value="1">Last 1</option>
                                </select>
                            </div>
                        )}
                        {!user && (
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3 text-sm text-yellow-500/90 flex gap-2 items-start mt-2">
                                <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <p>Create an account to sync unlimited solves across devices.</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
