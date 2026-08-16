import { useState } from 'react';
import { Trash2, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { SocialProfile, SocialNetwork } from '../../types';

const NETWORK_LABELS: Record<string, string> = {
    'email': 'Email',
    'discord': 'Discord',
    'x-twitter': 'X (Twitter)',
    'twitter': 'Twitter',
    'instagram': 'Instagram',
    'youtube': 'YouTube',
    'twitch': 'Twitch',
    'github': 'GitHub',
    'bluesky': 'Bluesky',
    'threads': 'Threads',
    'reddit': 'Reddit',
    'tiktok': 'TikTok',
    'spotify': 'Spotify',
    'snapchat': 'Snapchat',
    'facebook': 'Facebook',
    'linkedin': 'LinkedIn',
    'telegram': 'Telegram',
    'signal': 'Signal',
    'whatsapp': 'WhatsApp',
    'pinterest': 'Pinterest',
    'dribbble': 'Dribbble',
    'figma': 'Figma',
    'messenger': 'Messenger',
    'tumblr': 'Tumblr',
    'vk': 'VK',
    'other': 'Other',
};

const AVAILABLE_NETWORKS: string[] = [
    'discord', 'x-twitter', 'instagram', 'youtube', 'twitch', 'github',
    'bluesky', 'threads', 'reddit', 'tiktok', 'spotify', 'snapchat',
    'facebook', 'linkedin', 'telegram', 'signal', 'whatsapp', 'pinterest',
    'dribbble', 'figma', 'messenger', 'tumblr', 'vk', 'other'
];

export default function SocialsTab() {
    const { user } = useAuth();
    const [isEditingSocials, setIsEditingSocials] = useState(false);
    const [newNetwork, setNewNetwork] = useState('discord');
    const [newValue, setNewValue] = useState('');

    // Ensure we always have the email entry
    const socials: SocialProfile[] = user?.socials || [];
    const emailEntry = socials.find(s => s.network === 'email') || {
        id: 'email-default',
        network: 'email' as SocialNetwork,
        value: user?.email || '',
        privacy: 'hidden' as const
    };

    // Filter out email from the main list, as it's pinned
    const otherSocials = socials.filter(s => s.network !== 'email');

    // Sync email value if it changes in auth
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
            network: newNetwork as SocialNetwork,
            value: newValue.trim(),
            privacy: 'hidden'
        };

        const fullList = [...socials];
        if (!fullList.find(s => s.network === 'email')) {
            fullList.push(emailEntry as SocialProfile);
        }
        fullList.push(newEntry);

        updateSocials(fullList);
        setNewValue('');
    };

    const handleDeleteSocial = (id: string) => {
        const fullList = socials.filter(s => s.id !== id);
        updateSocials(fullList);
    };

    const cyclePrivacy = (id: string, currentPrivacy: string) => {
        const states = ['hidden', 'friends', 'public'];
        const currentIndex = states.indexOf(currentPrivacy);
        const nextPrivacy = states[(currentIndex + 1) % states.length];

        let fullList = [...socials];
        if (id === 'email-default' && !fullList.find(s => s.network === 'email')) {
            fullList.push({ ...emailEntry, privacy: nextPrivacy as 'hidden' | 'friends' | 'public' } as SocialProfile);
        } else {
            fullList = fullList.map(s => s.id === id ? { ...s, privacy: nextPrivacy as 'hidden' | 'friends' | 'public' } : s);
        }
        updateSocials(fullList);
    };

    const handleMove = (index: number, direction: 'up' | 'down') => {
        const newSocials = [...otherSocials];
        if (direction === 'up' && index > 0) {
            [newSocials[index], newSocials[index - 1]] = [newSocials[index - 1], newSocials[index]];
        } else if (direction === 'down' && index < newSocials.length - 1) {
            [newSocials[index], newSocials[index + 1]] = [newSocials[index + 1], newSocials[index]];
        }

        let fullList: SocialProfile[] = [];
        if (socials.find(s => s.network === 'email')) {
            fullList = [socials.find(s => s.network === 'email')!, ...newSocials];
        } else {
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
            default: return 'text-text-secondary bg-text-secondary/10 hover:bg-text-secondary/20';
        }
    };

    const getNetworkLabel = (network: string) => {
        return NETWORK_LABELS[network] || network.charAt(0).toUpperCase() + network.slice(1);
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

            <div className="flex flex-col gap-3">
                {/* Email Entry */}
                <div className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-border/40 bg-bg-secondary/40">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            onClick={() => cyclePrivacy(emailEntry.id, emailEntry.privacy)}
                            className={`px-2 py-1 text-xs font-bold rounded capitalize w-16 text-center transition-colors shrink-0 ${getPrivacyStyles(emailEntry.privacy)}`}
                            title="Click to toggle privacy"
                        >
                            {emailEntry.privacy}
                        </button>
                        <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded shrink-0">
                            Email
                        </span>
                        <span className="text-xs text-text-secondary font-mono truncate">{user?.email}</span>
                    </div>
                </div>

                {/* Other Socials */}
                {otherSocials.map((social: SocialProfile) => (
                    <div key={social.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-border/40 bg-bg-secondary/40">
                        <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                            <button
                                onClick={() => cyclePrivacy(social.id, social.privacy)}
                                className={`px-2 py-1 text-xs font-bold rounded capitalize w-16 text-center shrink-0 transition-colors ${getPrivacyStyles(social.privacy)}`}
                                title="Click to toggle privacy"
                            >
                                {social.privacy}
                            </button>
                            <span className="text-xs font-semibold text-text-primary bg-bg-hover px-2 py-0.5 rounded shrink-0 border border-border/50">
                                {getNetworkLabel(social.network)}
                            </span>
                            <span className="text-xs text-text-secondary truncate font-mono">{social.value}</span>
                        </div>

                        {isEditingSocials && (
                            <div className="flex items-center gap-1 shrink-0 ml-2">
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
                                    onClick={() => handleDeleteSocial(social.id)}
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

            {/* Add New Profile */}
            {isEditingSocials && (
                <div className="mt-4 p-4 bg-bg-secondary/20 rounded-lg border border-dashed border-border animate-in slide-in-from-top-2">
                    <h5 className="text-xs font-bold text-text-secondary uppercase mb-3">Add New Profile</h5>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <select
                            value={newNetwork}
                            onChange={(e) => setNewNetwork(e.target.value)}
                            className="bg-bg-secondary border border-border text-sm text-text-primary rounded px-3 py-2 w-full sm:w-auto focus:outline-none focus:border-accent"
                        >
                            {AVAILABLE_NETWORKS.map(net => (
                                <option key={net} value={net}>
                                    {getNetworkLabel(net)}
                                </option>
                            ))}
                        </select>
                        <input
                            type="text"
                            placeholder="Username or handle"
                            value={newValue}
                            onChange={(e) => setNewValue(e.target.value)}
                            className="bg-bg-secondary border border-border text-sm text-text-primary rounded px-3 py-2 flex-1 focus:outline-none focus:border-accent"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddSocial()}
                        />
                        <button
                            onClick={handleAddSocial}
                            disabled={!newValue.trim()}
                            className="bg-accent text-white px-4 py-2 rounded text-sm font-bold hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
