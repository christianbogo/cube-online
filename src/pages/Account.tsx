import { User, Settings, Shield } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

export default function Account() {
    const { settings, updateSettings } = useSettings();

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

    const handlePrimingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val)) val = 0;
        if (val < 0) val = 0;
        if (val > 3) val = 3; // Clamp max
        updateSettings({ primingLength: val });
    };

    return (
        <div className="w-full max-w-2xl flex flex-col items-start text-left">
            <h2 className="text-3xl font-semibold mb-6 text-text-primary">Account & Settings</h2>

            {/* Account Section */}
            <section className="w-full mb-10">
                <h3 className="text-xl font-medium text-text-primary mb-4 flex items-center gap-2">
                    <User className="w-5 h-5" /> Account
                </h3>
                <div className="bg-bg-secondary border border-border rounded-lg p-6 space-y-6">
                    <div className="flex flex-col gap-4">
                        <p className="text-text-secondary">
                            Sign in to save your solves to the cloud and access them from any device.
                        </p>
                        <div className="flex gap-3">
                            <button className="bg-accent text-white px-4 py-2 rounded-md hover:bg-accent/90 transition-colors font-medium">
                                Sign In with Email
                            </button>
                            <button className="bg-white text-black border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors font-medium flex items-center gap-2">
                                {/* Simple G icon placeholder since we don't have SVGs handy usually, or just text */}
                                <span className="font-bold text-blue-500">G</span> Sign in with Google
                            </button>
                        </div>
                    </div>
                    {/* Placeholder for logged in state later */}
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
                            type="number"
                            step="0.1"
                            min="0"
                            max="3"
                            value={settings.primingLength}
                            onChange={handlePrimingChange}
                            className="bg-bg-primary border border-border rounded-md px-3 py-1.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 w-24 text-right"
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

                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3 text-sm text-yellow-500/90 flex gap-2 items-start mt-2">
                            <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <p>Create an account to sync unlimited solves across devices.</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
