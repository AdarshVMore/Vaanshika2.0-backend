// File: routes/notificationRoutes.js
// Routes for notification functionality

import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';

// Import controllers
import { 
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getUnreadNotificationCount
} from '../controllers/notificationController.js';

const router = express.Router();

// Apply auth middleware to all notification routes
router.use(protect);

// Notification routes
router.get('/', getNotifications);
router.get('/unread-count', getUnreadNotificationCount);
router.put('/read-all', markAllNotificationsAsRead);
router.put('/:id/read', markNotificationAsRead);
router.delete('/:id', deleteNotification);

export default router; 