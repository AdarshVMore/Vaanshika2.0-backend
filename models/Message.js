// File: models/Message.js
// Message model for MongoDB

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatRoom',
    required: true
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  senderId: {
    type: String, // User UID
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'video', 'document', 'audio'],
    },
    url: String,
    name: String,
    size: Number,
    mimeType: String
  }],
  reactions: [{
    userId: String,
    reaction: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
});

// Create indexes for better query performance
messageSchema.index({ roomId: 1, timestamp: 1 });
messageSchema.index({ senderId: 1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message; 