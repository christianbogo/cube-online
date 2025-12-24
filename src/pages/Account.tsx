import { User, Settings, Shield } from 'lucide-react';

export default function Account() {
    return (
        <div className="w-full max-w-2xl flex flex-col items-start text-left">
            <h2 className="text-3xl font-semibold mb-6 text-text-primary">Account & Settings</h2>

            <section className="w-full mb-10">
                <h3 className="text-xl font-medium text-text-primary mb-4 flex items-center gap-2">
                    <User className="w-5 h-5" /> Profile
                </h3>
                <div className="bg-bg-secondary border border-border rounded-lg p-6 space-y-4">
                    <div className="grid gap-2">
                        <label className="text-sm font-medium text-text-secondary">Display Name</label>
                        <input
                            type="text"
                            defaultValue="Cutter"
                            className="bg-bg-primary border border-border rounded-md px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                    </div>
                    <div className="grid gap-2">
                        <label className="text-sm font-medium text-text-secondary">Bio</label>
                        <textarea
                            rows={3}
                            placeholder="Tell us about your cubing journey..."
                            className="bg-bg-primary border border-border rounded-md px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y"
                        />
                    </div>
                    <button className="bg-accent text-white px-4 py-2 rounded-md hover:bg-accent/90 transition-colors w-fit">
                        Save Changes
                    </button>
                </div>
            </section>

            <section className="w-full mb-10">
                <h3 className="text-xl font-medium text-text-primary mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5" /> Preferences
                </h3>
                <div className="bg-bg-secondary border border-border rounded-lg p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-text-primary font-medium">Email Notifications</p>
                            <p className="text-sm text-text-secondary">Receive updates about new featured cubes.</p>
                        </div>
                        <input type="checkbox" className="toggle-checkbox w-5 h-5 accent-accent" defaultChecked />
                    </div>
                    <div className="border-t border-border" />
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-text-primary font-medium">Public Profile</p>
                            <p className="text-sm text-text-secondary">Allow others to see your solve stats.</p>
                        </div>
                        <input type="checkbox" className="toggle-checkbox w-5 h-5 accent-accent" defaultChecked />
                    </div>
                </div>
            </section>

            {/* Filler text to test scrolling */}
            <section className="w-full mb-10 text-text-secondary">
                <h3 className="text-xl font-medium text-text-primary mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5" /> Privacy & Data
                </h3>
                <p className="mb-4">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                </p>
                <p className="mb-4">
                    Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                </p>
                <p>
                    Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
                </p>
            </section>
        </div>
    );
}
