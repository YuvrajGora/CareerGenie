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

async function testConnection() {
  console.log('Testing connection to MongoDB URI:', MONGODB_URI);
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined in .env.local!');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Successfully connected to MongoDB!');
    await mongoose.disconnect();
    console.log('Disconnected cleanly.');
  } catch (error) {
    console.error('✗ Connection to MongoDB failed:', error);
    process.exit(1);
  }
}

testConnection();
