// File: models/Event.js
// MongoDB model for family events

import mongoose from 'mongoose';

const attendeeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'attending', 'declined'],
    default: 'pending'
  }
}, { _id: false });

const EventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  location: {
    type: String,
    trim: true,
    default: ''
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  familyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Family',
    required: true
  },
  notifiedChatRooms: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatRoom'
  }],
  attendees: [attendeeSchema],
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
EventSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create indexes for better query performance
EventSchema.index({ familyId: 1 });
EventSchema.index({ startDate: 1 });
EventSchema.index({ createdBy: 1 });
EventSchema.index({ 'attendees.userId': 1 });

export default mongoose.model('Event', EventSchema); 