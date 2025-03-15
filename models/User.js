import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  // Remove userId field as we'll use MongoDB's _id
  password: { type: String },
  isVerified: { type: Boolean, default: false },
  profilePicture: { type: String },
  // Verification token for email verification
  verificationToken: { type: String },
  verificationTokenExpiry: { type: Date },
  // Reset token for password reset
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
  // Last login timestamp
  lastLogin: { type: Date },
  // Trees user has access to
  families: [{
    familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Family' },
    access: { type: String, enum: ['view', 'edit', 'admin'], default: 'view' }
  }],
  chatGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom' }],
  events: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
  // Track last activity for online status
  lastActive: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// Create index for email
userSchema.index({ email: 1 });

const User = mongoose.model('User', userSchema);

export default User;