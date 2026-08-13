import mongoose from 'mongoose';
import dns from 'node:dns';

// Ensure reliable MongoDB SRV lookup across local ISPs on Windows
dns.setServers(['8.8.8.8', '1.1.1.1']);

/**
 * Connect to MongoDB Atlas Cluster via Mongoose
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[MongoDB Error] Failed to connect: ${error.message}`);
    console.error(
      `[MongoDB Tip] Ensure your MONGODB_URI in .env has the correct username, password, cluster address, and IP whitelist configured in MongoDB Atlas.`
    );
    process.exit(1);
  }
};

export default connectDB;
