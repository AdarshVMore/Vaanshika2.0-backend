import mongoose from 'mongoose';

const ChildSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  birthDate: {
    type: Date
  },
  relationship: {
    type: String,
    enum: ['son', 'daughter', 'spouse', 'father', 'mother', 'brother', 'sister', 'other'],
    default: 'other'
  },
  notes: {
    type: String,
    trim: true
  },
  profilePicture: {
    type: String
  }
}, { timestamps: true });

const FamilySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Family name is required'],
    trim: true
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
    index: true
  },
  children: [ChildSchema],
  description: {
    type: String,
    trim: true
  },
  familyPicture: {
    type: String
  }
}, { timestamps: true });

// Create index for faster queries
FamilySchema.index({ userId: 1 });

const Family = mongoose.model('Family', FamilySchema);

export default Family;