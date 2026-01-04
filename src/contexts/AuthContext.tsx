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
    shortId?: string;
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
                // Listen directly to the user's document at users/{AuthUID}
                const userDocRef = doc(db, 'users', firebaseUser.uid);

                const unsubscribeDoc = onSnapshot(userDocRef, (docSnap) => {
                    console.log("AuthContext: Doc Snapshot", { exists: docSnap.exists() });
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const userData: UserData = {
                            uid: firebaseUser.uid, // The ID of the user is the Auth UID
                            shortId: data.shortId, // The friend code
                            email: firebaseUser.email,
                            emailVerified: firebaseUser.emailVerified,
                            ...data as { username: string; color: string; starredUsers?: string[]; blockedUsers?: string[] }
                        };
                        console.log("AuthContext: Setting User", userData);
                        setUser(userData);
                        localStorage.setItem('cached_user_profile', JSON.stringify(userData));
                    } else {
                        console.warn("AuthContext: authenticated but no profile doc at users/" + firebaseUser.uid);
                        // If no profile exists (legacy or just created), checking logic elsewhere handles creation
                        // or we wait for creation in sign-up flow.
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
