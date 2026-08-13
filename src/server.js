import dotenv from 'dotenv';
import app from './app.js';
import connectDB from './config/db.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;

// Connect to DB and Start HTTP Server
const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`🚀 Server listening on http://localhost:${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  });
};

startServer();
