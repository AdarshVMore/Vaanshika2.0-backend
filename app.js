import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { connectDB } from './config/db.js';
import authRoutes from "./routes/authRoutes.js";
import familyRoutes from "./routes/familyRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import { protect } from "./middlewares/authMiddleware.js";
import { setupSocketIO } from "./config/socket.js";

const app = express();

// CORS Configuration - Fix to allow requests from frontend
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
    credentials: true, // Allow cookies to be sent
  })
);

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.send("Testing Branch Works!");
});

app.use("/api/auth", authRoutes);

app.use("/api/family", protect, familyRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/notifications", notificationRoutes);

// Create HTTP server
const server = http.createServer(app);

// Set up Socket.io
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
    credentials: true,
  }
});

// Initialize socket connections
setupSocketIO(io);

// Make io accessible to route handlers
app.set('io', io);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));