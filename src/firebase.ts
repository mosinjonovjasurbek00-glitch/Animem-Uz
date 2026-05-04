import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile, 
  sendEmailVerification, 
  signInWithCustomToken,
  setPersistence,
  sendPasswordResetEmail,
  browserLocalPersistence,
  onAuthStateChanged
} from 'firebase/auth';
import { initializeFirestore, doc, setDoc, serverTimestamp, updateDoc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, onMessage } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId || "(default)");

export const auth = getAuth(app);

// Enforce local persistence which is more reliable in WebViews/APKs
setPersistence(auth, browserLocalPersistence).catch(err => {
    console.error("[Firebase] Persistence error:", err);
});
export const storage = getStorage(app);
export const messaging = getMessaging(app);
export const googleProvider = new GoogleAuthProvider();

// Listener for foreground notifications
onMessage(messaging, (payload) => {
  console.log('Foreground message received:', payload);
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // In snapshot listeners we should not throw, just log for debugging
}

// Service Worker Registration for FCM
export const registerServiceWorker = () => {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/firebase-messaging-sw.js')
                .then(registration => {
                    console.log('Service Worker registered with scope:', registration.scope);
                })
                .catch(err => {
                    console.error('Service Worker registration failed:', err);
                });
        });
    }
};

// Force account selection every time
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const logout = () => signOut(auth);

export { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendEmailVerification, signInWithCustomToken, sendPasswordResetEmail };

export const syncUserToFirestore = async (user: any) => {
  if (!user) return;
  const userDocRef = doc(db, 'users', user.uid);
  
  try {
    // We check if the user already exists to avoid overwriting their role (especially admins)
    // If we can't read it (permission denied), we just try to set it; the rules will protect it.
    const userSnap = await getDocFromServer(userDocRef).catch(() => null);
    
    const userData: any = {
      uid: user.uid,
      email: user.email || '',
      username: user.displayName || user.email?.split('@')[0] || 'User',
      photoURL: user.photoURL || '',
      updatedAt: serverTimestamp()
    };

    if (user.email === "mosinjonovjasurbek00@gmail.com") {
      userData.role = 'admin';
    } else if (!userSnap?.exists()) {
      userData.role = 'user';
    }

    await setDoc(userDocRef, userData, { merge: true });
    console.log('[Firebase] User synced successfully:', user.email);
  } catch (error: any) {
    console.error('[Firebase] Failed to sync user:', error.message, error.code);
  }
};

export const loginWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        await syncUserToFirestore(result.user);
        return result;
    } catch (error: any) {
        if (error.code === 'auth/popup-blocked' || error.message.includes('popup')) {
             console.warn("Popup bloklandi. Redirect orqali kirishga urinish...");
             const { signInWithRedirect } = await import('firebase/auth');
             await signInWithRedirect(auth, googleProvider);
             return null;
        }
        throw error;
    }
};

// Test connection on boot as recommended but silently
async function testConnection() {
  try {
    const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
    
    // Attempting a simple read to check connectivity
    await getDocFromServer(doc(db, '_connection_test_', 'check'));
  } catch (error: any) {
    // Silently fail, log only for internal debugging
    console.debug("Firebase connection test silent failure:", error.code);
  }
}
testConnection();
