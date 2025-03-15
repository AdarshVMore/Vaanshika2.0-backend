// File: controllers/notificationController.js
// Controller for notification functionality

import Notification from '../models/Notification.js';
import { isUserOnline } from '../config/socket.js';

/**
 * @desc    Get user's notifications
 * @route   GET /api/notifications
 * @access  Private
 */
export const getNotifications = async (req, res) => {
  try {
    // Get query parameters
    const { limit = 20, page = 1, unreadOnly = false } = req.query;
    
    // Build filter
    const filter = { recipient: req.user._id };
    
    // Filter by read status if requested
    if (unreadOnly === 'true') {
      filter.isRead = false;
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get notifications with pagination
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate({
        path: 'relatedId',
        select: 'title name content startDate location',
        options: { lean: true }
      });
    
    // Get total count for pagination
    const total = await Notification.countDocuments(filter);
    
    // Get unread count
    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false
    });
    
    res.json({
      success: true,
      data: notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Mark notification as read
 * @route   PUT /api/notifications/:id/read
 * @access  Private
 */
export const markNotificationAsRead = async (req, res) => {
  try {
    const notificationId = req.params.id;
    
    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    // Check if user is the recipient
    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this notification'
      });
    }
    
    // Mark as read if not already
    if (!notification.isRead) {
      notification.isRead = true;
      await notification.save();
      
      // Emit socket event for real-time updates
      const io = req.app.get('io');
      if (io) {
        io.to(req.user._id.toString()).emit('notification_read', {
          notificationId: notification._id
        });
      }
    }
    
    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/notifications/read-all
 * @access  Private
 */
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    // Update all unread notifications for the user
    const result = await Notification.updateMany(
      { 
        recipient: req.user._id,
        isRead: false
      },
      { 
        $set: { isRead: true }
      }
    );
    
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id.toString()).emit('all_notifications_read');
    }
    
    res.json({
      success: true,
      message: 'All notifications marked as read',
      count: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Delete notification
 * @route   DELETE /api/notifications/:id
 * @access  Private
 */
export const deleteNotification = async (req, res) => {
  try {
    const notificationId = req.params.id;
    
    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    // Check if user is the recipient
    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this notification'
      });
    }
    
    // Delete notification
    await Notification.findByIdAndDelete(notificationId);
    
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id.toString()).emit('notification_deleted', {
        notificationId: notification._id
      });
    }
    
    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get unread notification count
 * @route   GET /api/notifications/unread-count
 * @access  Private
 */
export const getUnreadNotificationCount = async (req, res) => {
  try {
    // Get unread count
    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false
    });
    
    res.json({
      success: true,
      data: {
        unreadCount
      }
    });
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
}; 