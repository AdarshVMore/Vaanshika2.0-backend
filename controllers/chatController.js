// File: controllers/chatController.js
// Controller for chat functionality

import ChatRoom from '../models/ChatRoom.js';
import ChatMessage from '../models/ChatMessage.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { sendNotificationToRoom, isUserOnline } from '../config/socket.js';

/**
 * @desc    Create a new chat room
 * @route   POST /api/chat/rooms
 * @access  Private
 */
export const createChatRoom = async (req, res) => {
  try {
    const { name, familyId, members } = req.body;

    if (!name || !familyId) {
      return res.status(400).json({ message: 'Name and family ID are required' });
    }

    // Create new chat room
    const newRoom = new ChatRoom({
      name,
      familyId,
      members: [...new Set([req.user._id, ...(members || [])])], // Ensure unique members
      createdBy: req.user._id,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await newRoom.save();

    // Add room to each member's chatGroups
    await User.updateMany(
      { _id: { $in: newRoom.members } },
      { $addToSet: { chatGroups: newRoom._id } }
    );

    // Create notifications for all members except creator
    const notifications = newRoom.members
      .filter(memberId => memberId.toString() !== req.user._id.toString())
      .map(memberId => ({
        recipient: memberId,
        type: 'chat',
        title: 'New Chat Room',
        message: `You've been added to the chat room: ${newRoom.name}`,
        relatedId: newRoom._id,
        relatedType: 'ChatRoom',
        isRead: false,
        createdAt: new Date()
      }));

    if (notifications.length > 0) {
      const createdNotifications = await Notification.insertMany(notifications);
      
      // Send real-time notifications to online users
      const io = req.app.get('io');
      if (io) {
        createdNotifications.forEach(notification => {
          // Add members to the socket room
          const socketId = io.sockets.adapter.rooms.get(notification.recipient.toString());
          if (socketId) {
            io.sockets.sockets.get(socketId).join(newRoom._id.toString());
          }
          
          // Send notification
          io.to(notification.recipient.toString()).emit('notification', {
            _id: notification._id,
            type: notification.type,
            title: notification.title,
            message: notification.message
          });
        });
      }
    }

    res.status(201).json({
      success: true,
      data: newRoom
    });
  } catch (error) {
    console.error('Error creating chat room:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get all chat rooms for current user
 * @route   GET /api/chat/rooms
 * @access  Private
 */
export const getChatRooms = async (req, res) => {
  try {
    // Find all rooms where the user is a member
    const rooms = await ChatRoom.find({
      members: req.user._id
    })
      .populate('members', 'name email profilePicture lastActive')
      .sort({ updatedAt: -1 });

    // Get the last message for each room
    const roomsWithLastMessage = await Promise.all(
      rooms.map(async (room) => {
        const lastMessage = await ChatMessage.findOne({ roomId: room._id })
          .sort({ createdAt: -1 })
          .limit(1)
          .populate('sender', 'name email profilePicture');

        // Get unread message count
        const unreadCount = await ChatMessage.countDocuments({
          roomId: room._id,
          'readBy.userId': { $ne: req.user._id },
          sender: { $ne: req.user._id }
        });

        // Add online status for each member
        const membersWithStatus = room.members.map(member => ({
          ...member._doc,
          isOnline: isUserOnline(member._id)
        }));

        return {
          ...room._doc,
          members: membersWithStatus,
          lastMessage: lastMessage || null,
          unreadCount
        };
      })
    );

    res.json({
      success: true,
      count: roomsWithLastMessage.length,
      data: roomsWithLastMessage
    });
  } catch (error) {
    console.error('Error fetching chat rooms:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get specific chat room and messages
 * @route   GET /api/chat/rooms/:id
 * @access  Private
 */
export const getChatRoomById = async (req, res) => {
  try {
    const roomId = req.params.id;
    
    // Find the room
    const room = await ChatRoom.findById(roomId)
      .populate('members', 'name email profilePicture lastActive');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    // Check if user is a member
    if (!room.members.some(member => member._id.toString() === req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this chat room'
      });
    }

    // Get messages with pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const skip = (page - 1) * limit;

    const messages = await ChatMessage.find({ roomId })
      .populate('sender', 'name email profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const total = await ChatMessage.countDocuments({ roomId });

    // Add online status for each member
    const membersWithStatus = room.members.map(member => ({
      ...member._doc,
      isOnline: isUserOnline(member._id)
    }));

    // Join the socket room if not already joined
    const io = req.app.get('io');
    if (io) {
      const socketId = io.sockets.adapter.rooms.get(req.user._id.toString());
      if (socketId) {
        io.sockets.sockets.get(socketId).join(roomId);
      }
    }

    res.json({
      success: true,
      data: {
        room: {
          ...room._doc,
          members: membersWithStatus
        },
        messages: messages.reverse(), // Reverse to get chronological order
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching chat room:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Send a new message
 * @route   POST /api/chat/messages
 * @access  Private
 */
export const sendMessage = async (req, res) => {
  try {
    const { roomId, content, attachment } = req.body;

    if (!roomId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Room ID and content are required'
      });
    }

    // Check if room exists and user is a member
    const room = await ChatRoom.findById(roomId);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    if (!room.members.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send messages to this room'
      });
    }

    // Create new message
    const newMessage = new ChatMessage({
      sender: req.user._id,
      roomId,
      content,
      attachment: attachment || null,
      readBy: [{ userId: req.user._id, readAt: new Date() }],
      createdAt: new Date()
    });

    await newMessage.save();

    // Update room's updatedAt
    room.updatedAt = new Date();
    await room.save();

    // Create notifications for all room members except sender
    const notifications = room.members
      .filter(memberId => memberId.toString() !== req.user._id.toString())
      .map(memberId => ({
        recipient: memberId,
        type: 'chat',
        title: `New message in ${room.name}`,
        message: `${req.user.name}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
        relatedId: newMessage._id,
        relatedType: 'ChatMessage',
        isRead: false,
        createdAt: new Date()
      }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    // Populate sender info for response
    const populatedMessage = await ChatMessage.findById(newMessage._id)
      .populate('sender', 'name email profilePicture');

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('new_message', {
        ...populatedMessage._doc,
        isNew: true
      });
    }

    res.status(201).json({
      success: true,
      data: populatedMessage
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Mark message as read
 * @route   PUT /api/chat/messages/:id/read
 * @access  Private
 */
export const markMessageAsRead = async (req, res) => {
  try {
    const messageId = req.params.id;
    
    const message = await ChatMessage.findById(messageId);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is a member of the chat room
    const room = await ChatRoom.findById(message.roomId);
    
    if (!room || !room.members.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this message'
      });
    }

    // Check if user has already read the message
    const alreadyRead = message.readBy.some(
      read => read.userId.toString() === req.user._id.toString()
    );

    if (!alreadyRead) {
      // Add user to readBy array
      message.readBy.push({
        userId: req.user._id,
        readAt: new Date()
      });
      
      await message.save();

      // Emit socket event for read receipt
      const io = req.app.get('io');
      if (io) {
        io.to(message.roomId.toString()).emit('message_read', {
          messageId: message._id,
          userId: req.user._id,
          userName: req.user.name,
          readAt: new Date()
        });
      }
    }

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get unread message count for all rooms
 * @route   GET /api/chat/unread
 * @access  Private
 */
export const getUnreadMessageCount = async (req, res) => {
  try {
    // Get all rooms where user is a member
    const rooms = await ChatRoom.find({ members: req.user._id });
    
    // Get unread count for each room
    const unreadCounts = await Promise.all(
      rooms.map(async room => {
        const count = await ChatMessage.countDocuments({
          roomId: room._id,
          'readBy.userId': { $ne: req.user._id },
          sender: { $ne: req.user._id }
        });
        
        return {
          roomId: room._id,
          roomName: room.name,
          unreadCount: count
        };
      })
    );
    
    // Calculate total unread count
    const totalUnread = unreadCounts.reduce((total, room) => total + room.unreadCount, 0);
    
    res.json({
      success: true,
      data: {
        totalUnread,
        rooms: unreadCounts
      }
    });
  } catch (error) {
    console.error('Error getting unread message count:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
}; 