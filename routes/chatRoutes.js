// File: routes/chatRoutes.js
// Routes for chat functionality

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');

/**
 * @route   GET /api/chat/rooms
 * @desc    Get all chat rooms for the user
 * @access  Private
 */
router.get('/rooms', auth, async (req, res) => {
  try {
    // Find all rooms where the user is a participant
    const rooms = await ChatRoom.find({
      participants: req.user.id
    }).sort({ updatedAt: -1 });

    // Get the last message for each room
    const roomsWithLastMessage = await Promise.all(
      rooms.map(async (room) => {
        const lastMessage = await ChatMessage.findOne({ roomId: room._id })
          .sort({ timestamp: -1 })
          .limit(1);

        return {
          id: room._id,
          name: room.name,
          description: room.description,
          type: room.type,
          createdAt: room.createdAt,
          createdBy: room.createdBy,
          lastMessage: lastMessage ? {
            id: lastMessage._id,
            text: lastMessage.text,
            senderId: lastMessage.senderId,
            timestamp: lastMessage.timestamp
          } : null
        };
      })
    );

    res.json(roomsWithLastMessage);
  } catch (err) {
    console.error('Error fetching chat rooms:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/chat/rooms/:roomId
 * @desc    Get a specific chat room
 * @access  Private
 */
router.get('/rooms/:roomId', auth, async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    // Check if user is a participant
    if (!room.participants.includes(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to access this room' });
    }

    res.json({
      id: room._id,
      name: room.name,
      description: room.description,
      type: room.type,
      createdAt: room.createdAt,
      createdBy: room.createdBy
    });
  } catch (err) {
    console.error('Error fetching chat room:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/chat/rooms
 * @desc    Create a new chat room
 * @access  Private
 */
router.post('/rooms', auth, async (req, res) => {
  try {
    const { name, description, type, participants } = req.body;

    // Validate input
    if (!name || !type) {
      return res.status(400).json({ message: 'Name and type are required' });
    }

    // Create new room
    const newRoom = new ChatRoom({
      name,
      description: description || '',
      type,
      participants: [...new Set([req.user.id, ...(participants || [])])], // Ensure unique participants
      createdBy: req.user.id
    });

    await newRoom.save();

    res.status(201).json({
      id: newRoom._id,
      name: newRoom.name,
      description: newRoom.description,
      type: newRoom.type,
      createdAt: newRoom.createdAt,
      createdBy: newRoom.createdBy
    });
  } catch (err) {
    console.error('Error creating chat room:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PUT /api/chat/rooms/:roomId
 * @desc    Update a chat room
 * @access  Private
 */
router.put('/rooms/:roomId', auth, async (req, res) => {
  try {
    const { name, description } = req.body;
    const room = await ChatRoom.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    // Check if user is the creator or has admin rights
    if (room.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this room' });
    }

    // Update fields
    if (name) room.name = name;
    if (description !== undefined) room.description = description;

    await room.save();

    res.json({
      id: room._id,
      name: room.name,
      description: room.description,
      type: room.type,
      createdAt: room.createdAt,
      createdBy: room.createdBy
    });
  } catch (err) {
    console.error('Error updating chat room:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   DELETE /api/chat/rooms/:roomId
 * @desc    Delete a chat room
 * @access  Private
 */
router.delete('/rooms/:roomId', auth, async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    // Check if user is the creator
    if (room.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this room' });
    }

    // Delete all messages in the room
    await ChatMessage.deleteMany({ roomId: room._id });

    // Delete the room
    await room.remove();

    res.json({ message: 'Chat room deleted' });
  } catch (err) {
    console.error('Error deleting chat room:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/chat/rooms/:roomId/messages
 * @desc    Get messages for a chat room
 * @access  Private
 */
router.get('/rooms/:roomId/messages', auth, async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    // Check if user is a participant
    if (!room.participants.includes(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to access this room' });
    }

    // Get messages with pagination
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;

    const messages = await ChatMessage.find({ roomId: room._id })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    // Format messages for response
    const formattedMessages = messages.map(msg => ({
      id: msg._id,
      roomId: msg.roomId,
      text: msg.text,
      senderId: msg.senderId,
      timestamp: msg.timestamp,
      image: msg.image
    }));

    res.json(formattedMessages.reverse()); // Reverse to get chronological order
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/chat/rooms/:roomId/messages
 * @desc    Send a message to a chat room
 * @access  Private
 */
router.post('/rooms/:roomId/messages', auth, async (req, res) => {
  try {
    const { text, image } = req.body;
    const roomId = req.params.roomId;

    // Validate input
    if (!text && !image) {
      return res.status(400).json({ message: 'Message text or image is required' });
    }

    const room = await ChatRoom.findById(roomId);

    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    // Check if user is a participant
    if (!room.participants.includes(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to send messages to this room' });
    }

    // Create new message
    const newMessage = new ChatMessage({
      roomId,
      senderId: req.user.id,
      text: text || '',
      image,
      timestamp: new Date()
    });

    await newMessage.save();

    // Update room's updatedAt
    room.updatedAt = new Date();
    await room.save();

    // Format message for response
    const formattedMessage = {
      id: newMessage._id,
      roomId: newMessage.roomId,
      text: newMessage.text,
      senderId: newMessage.senderId,
      timestamp: newMessage.timestamp,
      image: newMessage.image
    };

    // Emit socket event (handled by socket.io in server.js)
    req.app.get('io').to(roomId).emit('new_message', formattedMessage);

    res.status(201).json(formattedMessage);
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   DELETE /api/chat/rooms/:roomId/messages/:messageId
 * @desc    Delete a message
 * @access  Private
 */
router.delete('/rooms/:roomId/messages/:messageId', auth, async (req, res) => {
  try {
    const message = await ChatMessage.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user is the sender
    if (message.senderId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    await message.remove();

    res.json({ message: 'Message deleted' });
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/chat/rooms/:roomId/participants
 * @desc    Get participants for a chat room
 * @access  Private
 */
router.get('/rooms/:roomId/participants', auth, async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    // Check if user is a participant
    if (!room.participants.includes(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to access this room' });
    }

    // Get participant details
    const participants = await User.find(
      { _id: { $in: room.participants } },
      'name email profileImage'
    );

    // Format participants for response
    const formattedParticipants = participants.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage
    }));

    res.json(formattedParticipants);
  } catch (err) {
    console.error('Error fetching participants:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/chat/rooms/:roomId/participants
 * @desc    Add a participant to a chat room
 * @access  Private
 */
router.post('/rooms/:roomId/participants', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const room = await ChatRoom.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    // Check if user is the creator or has admin rights
    if (room.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to add participants to this room' });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is already a participant
    if (room.participants.includes(userId)) {
      return res.status(400).json({ message: 'User is already a participant' });
    }

    // Add user to participants
    room.participants.push(userId);
    await room.save();

    res.json({ message: 'Participant added successfully' });
  } catch (err) {
    console.error('Error adding participant:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   DELETE /api/chat/rooms/:roomId/participants/:userId
 * @desc    Remove a participant from a chat room
 * @access  Private
 */
router.delete('/rooms/:roomId/participants/:userId', auth, async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    const userId = req.params.userId;

    // Users can remove themselves, or the creator can remove others
    if (userId !== req.user.id && room.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to remove this participant' });
    }

    // Check if user is a participant
    if (!room.participants.includes(userId)) {
      return res.status(400).json({ message: 'User is not a participant' });
    }

    // Remove user from participants
    room.participants = room.participants.filter(
      participant => participant.toString() !== userId
    );
    
    await room.save();

    res.json({ message: 'Participant removed successfully' });
  } catch (err) {
    console.error('Error removing participant:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 