import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const configRaw = fs.readFileSync("./firebase-applet-config.json", "utf8");
const config = JSON.parse(configRaw);

admin.initializeApp({
  projectId: config.projectId,
});

const db = getFirestore();
db.settings({ databaseId: config.firestoreDatabaseId });

async function bumpViews() {
  const animeRef = db.collection('anime');
  const snapshot = await animeRef.get();
  
  if (snapshot.empty) {
    console.log('No matching documents.');
    return;
  }

  const batch = db.batch();
  let updatedCount = 0;

  snapshot.forEach(doc => {
    // between 108256 and higher range based on the user's prompt "108 256 shunaqa kotarib chiq"
    const views = Math.floor(Math.random() * (350000 - 108256 + 1)) + 108256;
    
    batch.update(doc.ref, { views });
    updatedCount++;
    console.log(`Setting anime ${doc.id} views to ${views}`);
  });

  await batch.commit();
  console.log(`Successfully updated ${updatedCount} animes.`);
}

bumpViews().catch(console.error);
