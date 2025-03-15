// File: models/ChatMessage.js
// MongoDB model for chat messages

import mongoose from 'mongoose';

const ChatMessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatRoom',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  attachment: {
    type: String,
    default: null
  },
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create indexes for better query performance
ChatMessageSchema.index({ roomId: 1, createdAt: -1 });
ChatMessageSchema.index({ sender: 1 });

export default mongoose.model('ChatMessage', ChatMessageSchema);
 