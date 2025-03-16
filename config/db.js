import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB_URI, {
      dbName: 'trees',
    });

    console.log('✅ Connected to MongoDB');

    // Disable debug mode by default to reduce console output
    // Only enable it if explicitly set in .env
    mongoose.set('debug', process.env.MONGOOSE_DEBUG === 'true');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1); // Exit process on failure
  }
};