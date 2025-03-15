// File: config/socket.js
// Socket.io configuration and event handlers

import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ChatRoom from '../models/ChatRoom.js';

// Map to store active user connections
const connectedUsers = new Map();

/**
 * Set up Socket.io server with authentication and event handlers
 * @param {Object} io - Socket.io server instance
 */
export const setupSocketIO = (io) => {
  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: Token not provided'));
      }
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      
      // Attach user to socket
      socket.user = user;
      
      // Update user's last active timestamp
      await User.findByIdAndUpdate(user._id, { lastActive: new Date() });
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection event
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user._id}`);
    
    // Add user to connected users map
    connectedUsers.set(socket.user._id.toString(), socket.id);
    
    // Join user to their chat rooms
    joinUserRooms(socket);
    
    // Handle chat message
    socket.on('send_message', (data) => {
      // Message will be saved to DB by the API endpoint
      // Here we just emit to room members for real-time updates
      io.to(data.roomId).emit('new_message', {
        ...data,
        sender: {
          _id: socket.user._id,
          name: socket.user.name
        }
      });
    });
    
    // Handle typing indicator
    socket.on('typing', (data) => {
      socket.to(data.roomId).emit('user_typing', {
        roomId: data.roomId,
        user: {
          _id: socket.user._id,
          name: socket.user.name
        }
      });
    });
    
    // Handle stop typing
    socket.on('stop_typing', (data) => {
      socket.to(data.roomId).emit('user_stop_typing', {
        roomId: data.roomId,
        user: {
          _id: socket.user._id,
          name: socket.user.name
        }
      });
    });
    
    // Handle read receipt
    socket.on('mark_read', (data) => {
      socket.to(data.roomId).emit('message_read', {
        messageId: data.messageId,
        roomId: data.roomId,
        userId: socket.user._id
      });
    });
    
    // Handle joining a new chat room
    socket.on('join_room', (roomId) => {
      socket.join(roomId);
      console.log(`User ${socket.user._id} joined room ${roomId}`);
    });
    
    // Handle leaving a chat room
    socket.on('leave_room', (roomId) => {
      socket.leave(roomId);
      console.log(`User ${socket.user._id} left room ${roomId}`);
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user._id}`);
      connectedUsers.delete(socket.user._id.toString());
    });
  });
};

/**
 * Join user to all their chat rooms
 * @param {Object} socket - Socket instance
 */
const joinUserRooms = async (socket) => {
  try {
    // Find all chat rooms where user is a member
    const rooms = await ChatRoom.find({ members: socket.user._id });
    
    // Join each room
    rooms.forEach(room => {
      socket.join(room._id.toString());
      console.log(`User ${socket.user._id} joined room ${room._id}`);
    });
  } catch (error) {
    console.error('Error joining user rooms:', error);
  }
};

/**
 * Get socket ID for a user
 * @param {String} userId - User ID
 * @returns {String|null} Socket ID or null if user not connected
 */
export const getUserSocketId = (userId) => {
  return connectedUsers.get(userId.toString()) || null;
};

/**
 * Check if a user is online
 * @param {String} userId - User ID
 * @returns {Boolean} True if user is online
 */
export const isUserOnline = (userId) => {
  return connectedUsers.has(userId.toString());
};

/**
 * Send a notification to a specific user
 * @param {Object} io - Socket.io server instance
 * @param {String} userId - User ID
 * @param {Object} notification - Notification data
 */
export const sendNotificationToUser = (io, userId, notification) => {
  const socketId = getUserSocketId(userId);
  
  if (socketId) {
    io.to(socketId).emit('notification', notification);
  }
};

/**
 * Send a notification to all users in a chat room
 * @param {Object} io - Socket.io server instance
 * @param {String} roomId - Chat room ID
 * @param {Object} notification - Notification data
 * @param {String} excludeUserId - User ID to exclude from notification
 */
export const sendNotificationToRoom = (io, roomId, notification, excludeUserId = null) => {
  if (excludeUserId) {
    io.to(roomId).except(getUserSocketId(excludeUserId)).emit('notification', notification);
  } else {
    io.to(roomId).emit('notification', notification);
  }
}; 