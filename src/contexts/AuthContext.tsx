import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
    onAuthStateChanged,
    signInWithPopup,
    signOut as firebaseSignOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, onSnapshot, query, collection, where, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';

interface UserData {
    uid: string;
    email: string | null;
    username: string;
    color: string;
}

interface AuthContextType {
    user: UserData | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    emailSignUp: (email: string, pass: string) => Promise<any>;
    emailSignIn: (email: string, pass: string) => Promise<any>;
    logout: () => Promise<void>;
    deleteUserAccount?: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserData | null>(() => {
        const cached = localStorage.getItem('cached_user_profile');
        return cached ? JSON.parse(cached) : null;
    });
    const [loading, setLoading] = useState(!user);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                // Real-time listener for user data
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                const unsubscribeDoc = onSnapshot(userDocRef, (docSnap) => {
                    let userData: UserData;
                    if (docSnap.exists()) {
                        userData = {
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            ...docSnap.data() as { username: string; color: string }
                        };
                    } else {
                        userData = {
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            username: firebaseUser.displayName || 'CubingUser',
                            color: '#3b82f6'
                        };
                    }
                    setUser(userData);
                    localStorage.setItem('cached_user_profile', JSON.stringify(userData));
                    setLoading(false);
                });

                // Cleanup subscription when auth state changes or component unmounts
                return () => unsubscribeDoc();
            } else {
                setUser(null);
                localStorage.removeItem('cached_user_profile');
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error(error);
        }
    };

    const emailSignUp = (email: string, pass: string) => {
        return createUserWithEmailAndPassword(auth, email, pass);
    };

    const emailSignIn = (email: string, pass: string) => {
        return signInWithEmailAndPassword(auth, email, pass);
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

    return (
        <AuthContext.Provider value={{ user, loading, signInWithGoogle, emailSignUp, emailSignIn, logout, deleteUserAccount }}>
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
