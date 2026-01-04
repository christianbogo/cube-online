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

// Helper to generate 6-char alphanumeric ID
const generateShortId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

interface UserData {
    uid: string;
    email: string | null;
    username: string;
    color: string;
    emailVerified: boolean;
    starredUsers?: string[];
    blockedUsers?: string[];
}

interface AuthContextType {
    user: UserData | null;
    loading: boolean;
    emailSignUp: (email: string, pass: string) => Promise<any>;
    emailSignIn: (email: string, pass: string) => Promise<any>;
    resendVerificationEmail: () => Promise<void>;
    logout: () => Promise<void>;
    deleteUserAccount?: () => Promise<void>;
    toggleStarUser: (targetUid: string) => Promise<void>;
    toggleBlockUser: (targetUid: string) => Promise<void>;
}

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
                // Query "users" collection where "uid" field (Auth UID) matches
                // We do not know the document ID (Short ID) yet.
                const q = query(collection(db, 'users'), where('uid', '==', firebaseUser.uid));

                // We need a real-time listener on the query to get the doc ID
                const unsubscribeQuery = onSnapshot(q, (snapshot) => {
                    console.log("AuthContext: Snapshot received", { empty: snapshot.empty, size: snapshot.size });

                    if (!snapshot.empty) {
                        // Priority: Find a doc with a Short ID (length <= 8 to be safe, usually 6)
                        // This avoids picking up legacy docs keyed by the long Auth UID.
                        let userDoc = snapshot.docs.find(d => d.id.length <= 10);

                        // Fallback: If no short ID doc found, take the first one (legacy behavior)
                        if (!userDoc) {
                            console.warn("AuthContext: No Short ID doc found. Using first available doc.");
                            userDoc = snapshot.docs[0];
                        }

                        console.log("AuthContext: Selected User Doc", { id: userDoc.id, data: userDoc.data() });

                        const data = userDoc.data();
                        const shortId = userDoc.id;

                        const userData: UserData = {
                            uid: shortId,
                            email: firebaseUser.email,
                            emailVerified: firebaseUser.emailVerified,
                            ...data as { username: string; color: string; starredUsers?: string[]; blockedUsers?: string[] }
                        };
                        console.log("AuthContext: Setting User", userData);
                        setUser(userData);
                        localStorage.setItem('cached_user_profile', JSON.stringify(userData));
                        setLoading(false);
                    } else {
                        console.warn("AuthContext: User authenticated but NO profile doc found.");
                        // User authenticated but no profile yet? 
                        // Should handle creation elsewhere or wait for it.
                        // For legacy support or race conditions, we might just wait.
                        // Or if this is a legacy user without a Short ID doc... 
                        // (Migration might be needed if there are existing users, but assuming new project or fresh start)
                        // If we just signed up, the doc creation happens in emailSignUp.
                        setLoading(false);
                    }
                });

                return () => unsubscribeQuery();
            } else {
                console.log("AuthContext: User signed out.");
                setUser(null);
                localStorage.removeItem('cached_user_profile');
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const emailSignUp = async (email: string, pass: string) => {
        const result = await createUserWithEmailAndPassword(auth, email, pass);
        // Send verification email
        await sendEmailVerification(result.user);

        // Generate Short ID and create User Doc
        let shortId = generateShortId();
        let retries = 0;
        let created = false;

        while (!created && retries < 5) {
            try {
                // Check collision conceptually by just trying to create?
                // setDoc with merge: false (default is overwrite, but we want to ensure uniqueness?)
                // Actually to ensure uniqueness we should read first.
                const docRef = doc(db, 'users', shortId);
                const docSnap = await getDocs(query(collection(db, 'users'), where('__name__', '==', shortId)));

                if (!docSnap.empty) {
                    throw new Error("Collision");
                }

                // Create the user profile
                await setDoc(docRef, {
                    uid: result.user.uid, // Store the Auth UID for lookups
                    email: email, // Store email
                    username: 'CubingUser',
                    color: ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'][Math.floor(Math.random() * 10)],
                    starredUsers: [],
                    blockedUsers: []
                });
                created = true;
            } catch (e) {
                console.error("Collision or error creating user doc", e);
                shortId = generateShortId();
                retries++;
            }
        }

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

    const toggleStarUser = async (targetUid: string) => {
        if (!user) return;
        const currentStarred = user.starredUsers || [];
        const isStarred = currentStarred.includes(targetUid);
        let newStarred;
        if (isStarred) {
            newStarred = currentStarred.filter(id => id !== targetUid);
        } else {
            newStarred = [...currentStarred, targetUid];
        }
        await updateDoc(doc(db, 'users', user.uid), { starredUsers: newStarred });
    };

    const toggleBlockUser = async (targetUid: string) => {
        if (!user) return;
        const currentBlocked = user.blockedUsers || [];
        const isBlocked = currentBlocked.includes(targetUid);
        let newBlocked;
        if (isBlocked) {
            newBlocked = currentBlocked.filter(id => id !== targetUid);
        } else {
            newBlocked = [...currentBlocked, targetUid];
        }
        await updateDoc(doc(db, 'users', user.uid), { blockedUsers: newBlocked });
    };

    return (
        <AuthContext.Provider value={{ user, loading, emailSignUp, emailSignIn, resendVerificationEmail, logout, deleteUserAccount, toggleStarUser, toggleBlockUser }}>
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
