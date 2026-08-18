import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
    onAuthStateChanged,
    signOut as firebaseSignOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification
} from 'firebase/auth';
import { doc, onSnapshot, query, collection, where, getDocs, writeBatch, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { UserData, SocialProfile, AuthContextType } from '../types';

// Helper to generate 6-char alphanumeric ID
const generateShortId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

export type { SocialProfile };

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserData | null>(() => {
        const cached = localStorage.getItem('cached_user_profile');
        return cached ? JSON.parse(cached) : null;
    });
    const [loading, setLoading] = useState(!user);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            console.log("AuthContext: onAuthStateChanged", firebaseUser?.uid);
            if (firebaseUser) {
                // Listen directly to the user's document at users/{AuthUID}
                const userDocRef = doc(db, 'users', firebaseUser.uid);

                const unsubscribeDoc = onSnapshot(userDocRef, (docSnap) => {
                    console.log("AuthContext: Doc Snapshot", { exists: docSnap.exists() });
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const followingList = data.following || data.starredUsers || [];
                        const userData: UserData = {
                            uid: firebaseUser.uid,
                            shortId: data.shortId,
                            email: firebaseUser.email,
                            emailVerified: firebaseUser.emailVerified,
                            username: data.username || 'CubingUser',
                            color: data.color || '#3b82f6',
                            following: followingList,
                            starredUsers: followingList,
                            blockedUsers: data.blockedUsers || [],
                            socials: data.socials || [],
                            lastSeenAt: data.lastSeenAt,
                            status: data.status,
                        };
                        console.log("AuthContext: Setting User", userData);
                        setUser(userData);
                        localStorage.setItem('cached_user_profile', JSON.stringify(userData));
                    } else {
                        console.warn("AuthContext: authenticated but no profile doc at users/" + firebaseUser.uid);
                    }
                    setLoading(false);
                });

                return () => unsubscribeDoc();
            } else {
                console.log("AuthContext: User signed out.");
                setUser(null);
                localStorage.removeItem('cached_user_profile');
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    // Presence Heartbeat: updates lastSeenAt while user is active
    useEffect(() => {
        if (!user?.uid) return;

        const updatePresence = async () => {
            try {
                await updateDoc(doc(db, 'users', user.uid), {
                    lastSeenAt: new Date().toISOString(),
                    status: 'Online'
                });
            } catch {
                // Ignore if document not yet ready
            }
        };

        updatePresence();
        const interval = setInterval(updatePresence, 60000);
        const handleActivity = () => updatePresence();
        window.addEventListener('focus', handleActivity);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', handleActivity);
        };
    }, [user?.uid]);

    const emailSignUp = async (email: string, pass: string) => {
        const result = await createUserWithEmailAndPassword(auth, email, pass);
        // Send verification email
        await sendEmailVerification(result.user);

        // Generate a unique Short ID
        let shortId = generateShortId();
        let isUnique = false;
        let retries = 0;

        while (!isUnique && retries < 5) {
            // Check if this shortId already exists in ANY user document
            const q = query(collection(db, 'users'), where('shortId', '==', shortId));
            const querySnap = await getDocs(q);
            if (querySnap.empty) {
                isUnique = true;
            } else {
                shortId = generateShortId();
                retries++;
            }
        }

        // Create the user profile at users/{AuthUID}
        await setDoc(doc(db, 'users', result.user.uid), {
            uid: result.user.uid,
            shortId: shortId,
            email: email,
            username: 'CubingUser',
            color: ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'][Math.floor(Math.random() * 10)],
            following: [],
            starredUsers: [],
            blockedUsers: []
        });

        return result;
    };

    const emailSignIn = (email: string, pass: string) => {
        return signInWithEmailAndPassword(auth, email, pass);
    };

    const resendVerificationEmail = async () => {
        if (auth.currentUser && !auth.currentUser.emailVerified) {
            await sendEmailVerification(auth.currentUser);
        }
    };

    const logout = async () => {
        await firebaseSignOut(auth);
        // Clear local cache
        localStorage.removeItem('cached_user_profile');
        setUser(null);
    };

    const deleteUserAccount = async () => {
        if (!user || !user.uid) return;

        try {
            // 1. Delete all user solves
            const q = query(collection(db, 'solves'), where('userId', '==', user.uid));
            const snapshot = await getDocs(q);
            const batch = writeBatch(db);
            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();

            // 2. Delete user profile
            await deleteDoc(doc(db, 'users', user.uid));

            // 3. Delete Firebase Auth User
            // Note: This requires re-authentication if recent login is old, 
            // but for simplicity we assume active session.
            const currentUser = auth.currentUser;
            if (currentUser) {
                await currentUser.delete();
            }
        } catch (error) {
            console.error("Error deleting account", error);
            throw error;
        }
    };

    const toggleFollowUser = async (targetUid: string) => {
        if (!user) return;
        const currentFollowing = user.following || user.starredUsers || [];
        const isFollowing = currentFollowing.includes(targetUid);
        let newFollowing: string[];
        if (isFollowing) {
            newFollowing = currentFollowing.filter(id => id !== targetUid);
        } else {
            newFollowing = [...currentFollowing, targetUid];
        }

        // Optimistic local state update
        const updatedUser: UserData = {
            ...user,
            following: newFollowing,
            starredUsers: newFollowing
        };
        setUser(updatedUser);
        localStorage.setItem('cached_user_profile', JSON.stringify(updatedUser));

        try {
            await updateDoc(doc(db, 'users', user.uid), {
                following: newFollowing,
                starredUsers: newFollowing
            });
        } catch (err) {
            console.error("Error updating following list:", err);
            try {
                await setDoc(doc(db, 'users', user.uid), {
                    following: newFollowing,
                    starredUsers: newFollowing
                }, { merge: true });
            } catch (e2) {
                console.error("Failed setDoc fallback for following:", e2);
            }
        }
    };

    const toggleStarUser = toggleFollowUser;

    const toggleBlockUser = async (targetUid: string) => {
        if (!user) return;
        const currentBlocked = user.blockedUsers || [];
        const isBlocked = currentBlocked.includes(targetUid);
        let newBlocked: string[];
        if (isBlocked) {
            newBlocked = currentBlocked.filter(id => id !== targetUid);
        } else {
            newBlocked = [...currentBlocked, targetUid];
        }

        // Optimistic local state update
        const updatedUser: UserData = {
            ...user,
            blockedUsers: newBlocked
        };
        setUser(updatedUser);
        localStorage.setItem('cached_user_profile', JSON.stringify(updatedUser));

        try {
            await updateDoc(doc(db, 'users', user.uid), { blockedUsers: newBlocked });
        } catch (err) {
            console.error("Error updating blocked list:", err);
            try {
                await setDoc(doc(db, 'users', user.uid), { blockedUsers: newBlocked }, { merge: true });
            } catch (e2) {
                console.error("Failed setDoc fallback for blocked:", e2);
            }
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, emailSignUp, emailSignIn, resendVerificationEmail, logout, deleteUserAccount, toggleFollowUser, toggleStarUser, toggleBlockUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
