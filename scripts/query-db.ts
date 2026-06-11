import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

// Load env variables
try {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      let val = parts.slice(1).join('=').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
    }
  }
} catch (err) {
  // Ignore
}

const MONGODB_URI = process.env.MONGODB_URI;

async function queryDB() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined in .env.local!');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    
    // Get database reference
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database object is undefined');
    }

    const collections = await db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));

    const usersCollection = db.collection('users');
    const count = await usersCollection.countDocuments();
    console.log(`Total users in collection: ${count}`);

    const recentUsers = await usersCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    console.log('\n5 Most Recent Users:');
    recentUsers.forEach((user, idx) => {
      const maskedEmail = user.email ? maskEmail(user.email) : 'N/A';
      console.log(`${idx + 1}. ID: ${user._id} | Email: ${maskedEmail} | Role: ${user.role} | CreatedAt: ${user.createdAt || user.createdAt}`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Database query failed:', error);
    process.exit(1);
  }
}

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 ? name.substring(0, 2) + '*'.repeat(name.length - 2) : name;
  return `${maskedName}@${domain}`;
}

queryDB();
