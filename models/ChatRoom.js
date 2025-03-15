// File: models/ChatRoom.js
// MongoDB model for chat rooms

import mongoose from 'mongoose';

const ChatRoomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  familyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Family',
    required: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  description: {
    type: String,
    default: '',
    trim: true
  },
  type: {
    type: String,
    enum: ['family', 'group', 'direct'],
    default: 'family'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
ChatRoomSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create indexes for better query performance
ChatRoomSchema.index({ members: 1 });
ChatRoomSchema.index({ familyId: 1 });
ChatRoomSchema.index({ createdAt: -1 });
ChatRoomSchema.index({ updatedAt: -1 });

export default mongoose.model('ChatRoom', ChatRoomSchema); 