import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';


export default function WCACallback() {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Linking your WCA account...');
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const hasFetched = useRef(false);

    useEffect(() => {
        if (!user) {
            setStatus('error');
            setMessage('You must be logged in to link your WCA account.');
            setTimeout(() => navigate('/account'), 3000);
            return;
        }

        const params = new URLSearchParams(location.search);
        const code = params.get('code');

        if (!code) {
            setStatus('error');
            setMessage('Invalid callback URL: missing code parameter.');
            setTimeout(() => navigate('/account'), 3000);
            return;
        }

        if (hasFetched.current) return;
        hasFetched.current = true;

        const exchangeCode = async () => {
            try {
                const redirectUri = window.location.origin.includes('localhost')
                    ? 'http://localhost:5173/callback'
                    : 'https://cubeonline.org/callback';

                const response = await fetch('/api/wca', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ code, redirectUri })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error_description || data.error || 'Failed to link account');
                }

                // Update user's socials
                const wcaProfile = data.me;
                if (!wcaProfile || !wcaProfile.wca_id) {
                    throw new Error('Could not retrieve WCA ID');
                }

                const currentSocials = user.socials || [];
                const newSocials = currentSocials.filter(s => 
                    !(s.network === 'wca' && s.value === wcaProfile.wca_id) &&
                    !(s.network === 'other' && s.value === wcaProfile.wca_id)
                );
                
                // See if a WCA profile exists
                const existingWcaIndex = newSocials.findIndex(s => s.network === 'wca' && s.value === wcaProfile.wca_id);
                
                if (existingWcaIndex === -1) {
                    newSocials.push({
                        id: crypto.randomUUID(),
                        network: 'wca',
                        value: wcaProfile.wca_id,
                        privacy: 'public'
                    });
                }

                await setDoc(doc(db, 'users', user.uid), {
                    socials: newSocials,
                    wcaId: wcaProfile.wca_id
                }, { merge: true });

                setStatus('success');
                setMessage(`Successfully linked WCA ID: ${wcaProfile.wca_id}`);
                
                setTimeout(() => navigate('/account'), 2000);
            } catch (err: any) {
                setStatus('error');
                setMessage(err.message || 'An error occurred during linking.');
                setTimeout(() => navigate('/account'), 3000);
            }
        };

        exchangeCode();
    }, [location, navigate, user]);

    return (
        <div className="flex h-full w-full items-center justify-center bg-bg-primary">
            <div className="flex flex-col items-center gap-4 p-8 bg-bg-secondary border border-border rounded-xl shadow-lg max-w-sm text-center">
                {status === 'loading' && <Loader2 className="w-12 h-12 text-accent animate-spin" />}
                {status === 'success' && <CheckCircle2 className="w-12 h-12 text-green-500" />}
                {status === 'error' && <XCircle className="w-12 h-12 text-red-500" />}
                
                <h2 className="text-xl font-bold text-text-primary">
                    {status === 'loading' ? 'Linking Account' : status === 'success' ? 'Success!' : 'Error'}
                </h2>
                <p className="text-sm text-text-secondary">
                    {message}
                </p>
            </div>
        </div>
    );
}
