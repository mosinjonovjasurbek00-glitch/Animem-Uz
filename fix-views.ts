import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import * as fs from 'fs';

const configStr = fs.readFileSync('./firebase-applet-config.json', 'utf8');
const firebaseConfig = JSON.parse(configStr);
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId || "(default)");

async function fix() {
  const animes = await getDocs(collection(db, 'anime'));
  let c = 0;
  for (const a of animes.docs) {
    await updateDoc(doc(db, 'anime', a.id), { views: 0 });
    c++;
  }
  console.log('Fixed', c, 'animes');
}

fix().catch((err) => {
  console.error("Error running fix:", err);
  process.exit(1);
});
