// File: routes/chatRoutes.js
// Routes for chat functionality

import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';

// Import controllers
import { 
  createChatRoom,
  getChatRooms,
  getChatRoomById,
  sendMessage,
  markMessageAsRead,
  getUnreadMessageCount
} from '../controllers/chatController.js';

const router = express.Router();

// Apply auth middleware to all chat routes
router.use(protect);

// Chat room routes
router.post('/rooms', createChatRoom);
router.get('/rooms', getChatRooms);
router.get('/rooms/:id', getChatRoomById);

// Message routes
router.post('/messages', sendMessage);
router.put('/messages/:id/read', markMessageAsRead);

// Unread messages route
router.get('/unread', getUnreadMessageCount);

export default router; 