import mongoose from 'mongoose';

// Schema for social media links
const SocialMediaSchema = new mongoose.Schema({
  facebook: String,
  twitter: String,
  instagram: String,
  linkedin: String
}, { _id: false });

// Schema for contact information
const ContactInfoSchema = new mongoose.Schema({
  email: String,
  phone: String,
  address: String,
  socialMedia: SocialMediaSchema
}, { _id: false });

const ChildSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    default: 'other'
  },
  birthDate: {
    type: Date
  },
  deathDate: {
    type: Date
  },
  isAlive: {
    type: Boolean,
    default: true
  },
  relationship: {
    type: String,
    enum: ['son', 'daughter', 'spouse', 'father', 'mother', 'brother', 'sister', 'other'],
    default: 'other'
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Child'
  },
  location: {
    type: String,
    trim: true
  },
  occupation: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  bio: {
    type: String,
    trim: true
  },
  profilePicture: {
    type: String
  },
  photoURL: {
    type: String
  },
  contactInfo: ContactInfoSchema
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

// Create index for faster queries but don't make it unique
FamilySchema.index({ userId: 1 });

const Family = mongoose.model('Family', FamilySchema);

export default Family;