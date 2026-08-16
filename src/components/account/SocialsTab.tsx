import { useState } from 'react';
import { Mail, Trash2, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { SocialProfile } from '../../types';

export default function SocialsTab() {
    const { user } = useAuth();
    const [isEditingSocials, setIsEditingSocials] = useState(false);
    const [newNetwork, setNewNetwork] = useState('discord');
    const [newValue, setNewValue] = useState('');

    const availableNetworks = [
        'apple', 'bluesky', 'discord', 'dribbble', 'facebook', 'figma', 'github',
        'instagram', 'linkedin', 'messenger', 'pinterest', 'reddit', 'signal',
        'snapchat', 'spotify', 'telegram', 'threads', 'tiktok', 'tumblr',
        'twitch', 'vk', 'whatsapp', 'x-twitter', 'youtube'
    ];

    // Ensure we always have the email entry
    const socials: SocialProfile[] = user?.socials || [];
    const emailEntry = socials.find(s => s.network === 'email') || {
        id: 'email-default',
        network: 'email',
        value: user?.email || '',
        privacy: 'hidden' as const
    };

    // Filter out email from the main list, as it's pinned
    const otherSocials = socials.filter(s => s.network !== 'email');

    // Sync email value if it changes in auth (local logic for display)
    if (emailEntry.value !== user?.email) emailEntry.value = user?.email || '';

    const updateSocials = async (newSocialsList: SocialProfile[]) => {
        if (!user) return;
        try {
            await setDoc(doc(db, 'users', user.uid), { socials: newSocialsList }, { merge: true });
        } catch (e) {
            console.error("Error updating socials", e);
        }
    };

    const handleAddSocial = () => {
        if (!newValue.trim()) return;
        const newEntry: SocialProfile = {
            id: crypto.randomUUID(),
            network: newNetwork as any, // Cast to known network type or string
            value: newValue.trim(),
            privacy: 'hidden'
        };

        let fullList = [...socials];
        if (!fullList.find(s => s.network === 'email')) {
            fullList.push(emailEntry as SocialProfile);
        }
        fullList.push(newEntry);

        updateSocials(fullList);
        setNewValue('');
    };

    const handlDeleteSocial = (id: string) => {
        const fullList = socials.filter(s => s.id !== id);
        updateSocials(fullList);
    };

    const cyclePrivacy = (id: string, currentPrivacy: string) => {
        const states = ['hidden', 'friends', 'public'];
        const currentIndex = states.indexOf(currentPrivacy);
        const nextPrivacy = states[(currentIndex + 1) % states.length];

        let fullList = [...socials];
        // If it's the default email entry and it's not in the list yet, add it
        if (id === 'email-default' && !fullList.find(s => s.network === 'email')) {
            fullList.push({ ...emailEntry, privacy: nextPrivacy as 'hidden' | 'friends' | 'public' } as SocialProfile);
        } else {
            fullList = fullList.map(s => s.id === id ? { ...s, privacy: nextPrivacy as 'hidden' | 'friends' | 'public' } : s);
        }
        updateSocials(fullList);
    };

    const handleMove = (index: number, direction: 'up' | 'down') => {
        // operate on otherSocials copy
        const newSocials = [...otherSocials];
        if (direction === 'up' && index > 0) {
            [newSocials[index], newSocials[index - 1]] = [newSocials[index - 1], newSocials[index]];
        } else if (direction === 'down' && index < newSocials.length - 1) {
            [newSocials[index], newSocials[index + 1]] = [newSocials[index + 1], newSocials[index]];
        }

        // Reconstruct full list with email always first
        let fullList: SocialProfile[] = [];

        if (socials.find(s => s.network === 'email')) {
            // If email is in the DB list, put it first
            fullList = [socials.find(s => s.network === 'email')!, ...newSocials];
        } else {
            // If email isn't in DB list, it's virtual, so just save `newSocials`.
            // logic matches original, assuming user wants implicitly saved email only if modified?
            // If email is not in DB but we are reordering others, we should preserve otherSocials order.
            fullList = [...newSocials];
            const dbEmail = socials.find(s => s.network === 'email');
            if (dbEmail) {
                fullList.unshift(dbEmail);
            }
        }

        updateSocials(fullList);
    };

    const getPrivacyStyles = (privacy: string) => {
        switch (privacy) {
            case 'public': return 'text-green-500 bg-green-500/10 hover:bg-green-500/20';
            case 'friends': return 'text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20';
            default: return 'text-text-secondary bg-text-secondary/10 hover:bg-text-secondary/20'; // hidden
        }
    };

    const NetworkIcon = ({ network }: { network: string }) => {
        if (network === 'email') {
            return (
                <div className="w-8 h-8 flex items-center justify-center">
                    <span className="text-text-primary"><Mail className="w-6 h-6" /></span>
                </div>
            );
        }

        if (availableNetworks.includes(network)) {
            return (
                <div className="w-8 h-8 relative flex items-center justify-center">
                    <img
                        src={`/socials/${network}.svg`}
                        alt={network}
                        className="w-full h-full object-contain dark:hidden"
                    />
                    <img
                        src={`/socials/${network}-dark.svg`}
                        alt={network}
                        className="w-full h-full object-contain hidden dark:block"
                    />
                </div>
            );
        }

        return (
            <div className="w-8 h-8 bg-bg-secondary rounded-full flex items-center justify-center text-xs font-bold uppercase text-text-secondary border border-border">
                {network.substring(0, 2)}
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-6 p-2">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-text-primary">Social Profiles</h4>
                <button
                    onClick={() => setIsEditingSocials(!isEditingSocials)}
                    className={`text-xs px-3 py-1 rounded-md transition-colors border ${isEditingSocials ? 'bg-text-primary text-bg-primary border-transparent font-bold' : 'text-text-secondary border-border hover:border-text-secondary'}`}
                >
                    {isEditingSocials ? 'Done' : 'Edit Profiles'}
                </button>
            </div>

            <div className="flex flex-col gap-4">
                {/* Email (Virtual or Real) */}
                <div className="flex items-center justify-between py-2 border-b border-border/20 last:border-0 group">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => cyclePrivacy(emailEntry.id, emailEntry.privacy)}
                            className={`px-2 py-1 text-xs font-bold rounded capitalize w-16 text-center transition-colors ${getPrivacyStyles(emailEntry.privacy)}`}
                            title="Click to toggle privacy"
                        >
                            {emailEntry.privacy}
                        </button>
                        <div className="w-8 flex justify-center">
                            <Mail className="w-6 h-6 text-text-primary" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-text-primary">Email</span>
                            <span className="text-xs text-text-secondary font-mono">{user?.email}</span>
                        </div>
                    </div>
                </div>

                {otherSocials.map((social: SocialProfile) => (
                    <div key={social.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0 group">
                        <div className="flex items-center gap-4 overflow-hidden">
                            <button
                                onClick={() => cyclePrivacy(social.id, social.privacy)}
                                className={`px-2 py-1 text-xs font-bold rounded capitalize w-16 text-center shrink-0 transition-colors ${getPrivacyStyles(social.privacy)}`}
                                title="Click to toggle privacy"
                            >
                                {social.privacy}
                            </button>
                            <div className="w-8 shrink-0 flex justify-center">
                                <NetworkIcon network={social.network} />
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-sm font-medium text-text-primary capitalize">{(social.network as string) === 'x-twitter' ? 'X (Twitter)' : social.network}</span>
                                <span className="text-xs text-text-secondary truncate font-mono">{social.value}</span>
                            </div>
                        </div>

                        {isEditingSocials && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handleMove(otherSocials.indexOf(social), 'up')}
                                    disabled={otherSocials.indexOf(social) === 0}
                                    className="p-1.5 text-text-secondary hover:bg-bg-secondary rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    title="Move Up"
                                >
                                    <ChevronUp className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleMove(otherSocials.indexOf(social), 'down')}
                                    disabled={otherSocials.indexOf(social) === otherSocials.length - 1}
                                    className="p-1.5 text-text-secondary hover:bg-bg-secondary rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    title="Move Down"
                                >
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handlDeleteSocial(social.id)}
                                    className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors ml-1"
                                    title="Remove"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                ))}

                {otherSocials.length === 0 && (
                    <p className="text-xs text-text-secondary italic px-2 py-4 text-center opacity-50">
                        No additional profiles connected.
                    </p>
                )}
            </div>

            {isEditingSocials && (
                <div className="mt-4 p-4 dotted-bg rounded-lg border border-dashed border-border animate-in slide-in-from-top-2">
                    <h5 className="text-xs font-bold text-text-secondary uppercase mb-3">Add New Profile</h5>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <select
                            value={newNetwork}
                            onChange={(e) => setNewNetwork(e.target.value)}
                            className="bg-bg-secondary border border-border text-sm text-text-primary rounded px-3 py-2 w-full sm:w-auto focus:outline-none focus:border-accent capitalize"
                        >
                            {availableNetworks.map(net => (
                                <option key={net} value={net}>
                                    {net === 'x-twitter' ? 'X (Twitter)' : net}
                                </option>
                            ))}
                            <option value="other">Other</option>
                        </select>
                        <input
                            type="text"
                            placeholder="Username"
                            value={newValue}
                            onChange={(e) => setNewValue(e.target.value)}
                            className="bg-bg-secondary border border-border text-sm text-text-primary rounded px-3 py-2 flex-1 focus:outline-none focus:border-accent"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddSocial()}
                        />
                        <button
                            onClick={handleAddSocial}
                            disabled={!newValue.trim()}
                            className="bg-accent text-white px-4 py-2 rounded text-sm font-bold hover:brightness-110 disabled:opacity-50 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
