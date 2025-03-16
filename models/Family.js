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

// Member schema (embedded in Family)
const MemberSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
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
  location: {
    type: String,
    trim: true
  },
  occupation: {
    type: String,
    trim: true
  },
  bio: {
    type: String
  },
  photoURL: {
    type: String
  },
  contactInfo: {
    email: String,
    phone: String,
    address: String,
    socialMedia: {
      facebook: String,
      twitter: String,
      instagram: String,
      linkedin: String
    }
  },
  // Relationship fields
  parents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member'
  }],
  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member'
  }],
  partners: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member'
  }],
  relationshipType: {
    type: String,
    enum: ['child', 'adopted', 'foster', 'spouse', 'partner', 'wife', 'husband', 'parent', 'father', 'mother', 'mom', 'dad', 'stepMom', 'stepDad'],
    default: 'child'
  },
  isRoot: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Family schema
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
  description: {
    type: String,
    trim: true
  },
  familyPicture: {
    type: String
  },
  members: [MemberSchema]
}, { timestamps: true });

// Create index for faster queries
FamilySchema.index({ userId: 1 });

// Virtual for getting the root members (those without parents)
FamilySchema.virtual('rootMembers').get(function() {
  return this.members.filter(member => 
    !member.parents || member.parents.length === 0
  );
});

// Method to find a member by ID
FamilySchema.methods.findMemberById = function(memberId) {
  return this.members.find(member => 
    member._id.toString() === memberId.toString()
  );
};

// Method to add a spouse relationship
FamilySchema.methods.addSpouseRelationship = function(member1Id, member2Id) {
  const member1 = this.findMemberById(member1Id);
  const member2 = this.findMemberById(member2Id);
  
  if (!member1 || !member2) {
    return false;
  }
  
  // Initialize spouses arrays if they don't exist
  if (!member1.partners) member1.partners = [];
  if (!member2.partners) member2.partners = [];
  
  // Add the relationship if it doesn't already exist
  if (!member1.partners.includes(member2._id)) {
    member1.partners.push(member2._id);
  }
  
  if (!member2.partners.includes(member1._id)) {
    member2.partners.push(member1._id);
  }
  
  return true;
};

const Family = mongoose.model('Family', FamilySchema);

export default Family;