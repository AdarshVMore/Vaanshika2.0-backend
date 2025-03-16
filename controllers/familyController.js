import Family from '../models/Family.js';
import User from '../models/User.js';
import ChatRoom from '../models/ChatRoom.js';
import Notification from '../models/Notification.js';
import { createFamily } from '../services/familyService.js';
import { sendNotificationToUser } from '../config/socket.js';
import mongoose from 'mongoose';

// ✅ POST: Add Family Tree Data
export const addFamily = async (req, res) => {
  try {
    const familyData = req.body;
    
    // Attach the user ID to the family data
    familyData.userId = req.user._id; // Use MongoDB's _id
    
    // Create a new family document
    const family = new Family(familyData);
    
    // Save the family to the database
    const savedFamily = await family.save();
    
    // Create a chat room for the family
    const chatRoom = new ChatRoom({
      name: familyData.name || `${req.user.name}'s Family`,
      familyId: savedFamily._id,
      members: [req.user._id], // Start with just the creator
      description: `Chat room for ${familyData.name || req.user.name}'s family`,
      type: 'family',
      createdBy: req.user._id,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await chatRoom.save();
    
    // Add chat room to user's chatGroups
    await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { chatGroups: chatRoom._id } }
    );
    
    // Add family to user's families array
    await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { families: { familyId: savedFamily._id, access: 'admin' } } }
    );
    
    // If there are invited members, add them to the chat room
    if (familyData.invitedMembers && familyData.invitedMembers.length > 0) {
      // Add members to chat room
      await ChatRoom.findByIdAndUpdate(
        chatRoom._id,
        { $addToSet: { members: { $each: familyData.invitedMembers } } }
      );
      
      // Add chat room to each member's chatGroups
      await User.updateMany(
        { _id: { $in: familyData.invitedMembers } },
        { $addToSet: { chatGroups: chatRoom._id } }
      );
      
      // Create notifications for invited members
      const notifications = familyData.invitedMembers.map(memberId => ({
        recipient: memberId,
        type: 'invite',
        title: 'Family Tree Invitation',
        message: `${req.user.name} has invited you to join their family tree and chat room: ${chatRoom.name}`,
        relatedId: chatRoom._id,
        relatedType: 'ChatRoom',
        isRead: false,
        createdAt: new Date()
      }));
      
      if (notifications.length > 0) {
        const createdNotifications = await Notification.insertMany(notifications);
        
        // Send real-time notifications to online users
        createdNotifications.forEach(notification => {
          const io = req.app.get('io');
          if (io) {
            sendNotificationToUser(io, notification.recipient, {
              _id: notification._id,
              type: notification.type,
              title: notification.title,
              message: notification.message
            });
          }
        });
      }
    }
    
    res.status(201).json({
      success: true,
      data: savedFamily,
      chatRoom
    });
  } catch (error) {
    console.error('Add Family Error:', error);
    
    // Check for validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        error: messages
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// ✅ GET: Get All Family Trees for a User
export const getAllFamilyTrees = async (req, res) => {
  try {
    // Get the user with populated families
    const user = await User.findById(req.user._id)
      .populate({
        path: 'families.familyId',
        select: 'name description familyPicture createdAt'
      });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Extract and format the family trees
    const familyTrees = user.families.map(family => ({
      id: family.familyId._id,
      name: family.familyId.name,
      description: family.familyId.description,
      image: family.familyId.familyPicture,
      access: family.access,
      createdAt: family.familyId.createdAt
    }));
    
    res.status(200).json({
      success: true,
      data: familyTrees
    });
  } catch (error) {
    console.error('Get All Family Trees Error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// ✅ GET: Retrieve Family Tree Data by User ID
export const getFamilyByUserId = async (req, res) => {
  try {
    // Find all family trees for the user instead of just one
    const families = await Family.find({ userId: req.user._id });
    
    if (!families || families.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No family trees found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: families
    });
  } catch (error) {
    console.error('Get Family Error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// ✅ PUT: Update Child Information
export const updateChild = async (req, res) => {
  try {
    const { childId } = req.params;
    const { treeId } = req.query; // Get the tree ID from query params
    const updateData = req.body;
    
    // Find the specific family tree
    const family = treeId 
      ? await Family.findOne({ _id: treeId, userId: req.user._id })
      : await Family.findOne({ userId: req.user._id });
    
    if (!family) {
      return res.status(404).json({
        success: false,
        error: 'Family tree not found'
      });
    }
    
    // Find the child in the family tree
    const childIndex = family.children.findIndex(
      child => child._id.toString() === childId
    );
    
    if (childIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Child not found in family tree'
      });
    }
    
    // Update the child data
    Object.keys(updateData).forEach(key => {
      family.children[childIndex][key] = updateData[key];
    });
    
    // Save the updated family tree
    const updatedFamily = await family.save();
    
    res.status(200).json({
      success: true,
      data: updatedFamily
    });
  } catch (error) {
    console.error('Update Child Error:', error);
    
    // Check for validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        error: messages
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// ✅ DELETE: Remove Child from Family Tree
export const deleteChild = async (req, res) => {
  try {
    const { childId } = req.params;
    const { treeId } = req.query; // Get the tree ID from query params
    
    // Find the specific family tree
    const family = treeId 
      ? await Family.findOne({ _id: treeId, userId: req.user._id })
      : await Family.findOne({ userId: req.user._id });
    
    if (!family) {
      return res.status(404).json({
        success: false,
        error: 'Family tree not found'
      });
    }
    
    // Remove the child from the family tree
    family.children = family.children.filter(
      child => child._id.toString() !== childId
    );
    
    // Save the updated family tree
    const updatedFamily = await family.save();
    
    res.status(200).json({
      success: true,
      data: updatedFamily
    });
  } catch (error) {
    console.error('Delete Child Error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// ✅ DELETE: Remove Entire Family Tree
export const deleteTree = async (req, res) => {
  try {
    const { treeId } = req.params;
    
    // If treeId is provided, delete that specific tree
    // Otherwise, delete all trees for the user (legacy behavior)
    let result;
    
    if (treeId) {
      // Delete the specific family tree
      result = await Family.deleteOne({ 
        _id: treeId,
        userId: req.user._id 
      });
      
      // Remove the family from user's families array
      await User.findByIdAndUpdate(
        req.user._id,
        { $pull: { families: { familyId: treeId } } }
      );
      
      // Find and delete associated chat room
      const chatRoom = await ChatRoom.findOne({ familyId: treeId });
      if (chatRoom) {
        await ChatRoom.deleteOne({ _id: chatRoom._id });
        
        // Remove chat room from all users' chatGroups
        await User.updateMany(
          { chatGroups: chatRoom._id },
          { $pull: { chatGroups: chatRoom._id } }
        );
      }
    } else {
      // Delete all family trees for the current user (legacy behavior)
      result = await Family.deleteMany({ userId: req.user._id });
    }
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Family tree not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Family tree deleted successfully'
    });
  } catch (error) {
    console.error('Delete Tree Error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// 🔄 Recursive Helper: Add Child to Family Tree
const addChildRecursive = (member, parentId, child) => {
  if (member.member_id === parentId) {
    child.member_id = `${parentId}.${member.children.length + 1}`; // Generate new member_id
    member.children.push(child);
    return true;
  }

  return member.children?.some((childMember) => addChildRecursive(childMember, parentId, child));
};

// ✅ POST: Add Child to Existing Member
export const addChild = async (req, res) => {
  try {
    const childData = req.body;
    // Get the tree ID from URL params or query params
    const treeId = req.params.treeId || req.query.treeId;
    
    console.log('Adding child to tree:', treeId, 'with data:', childData);
    
    // Find the specific family tree
    const family = treeId 
      ? await Family.findOne({ _id: treeId, userId: req.user._id })
      : await Family.findOne({ userId: req.user._id });
    
    if (!family) {
      console.error('Family tree not found for treeId:', treeId, 'and userId:', req.user._id);
      return res.status(404).json({
        success: false,
        error: 'Family tree not found'
      });
    }
    
    console.log('Found family tree:', family._id);
    
    // Transform the data to match the schema
    const transformedChildData = {
      // Combine firstName and lastName into name if they exist
      name: childData.firstName && childData.lastName 
        ? `${childData.firstName} ${childData.lastName}`
        : childData.name || '',
      firstName: childData.firstName,
      lastName: childData.lastName,
      gender: childData.gender || 'other',
      birthDate: childData.birthDate || childData.dateOfBirth,
      deathDate: childData.deathDate || childData.dateOfDeath,
      isAlive: childData.isAlive !== undefined ? childData.isAlive : true,
      relationship: childData.relationship || 'other',
      parentId: childData.parentId,
      location: childData.location,
      occupation: childData.occupation,
      notes: childData.bio || childData.notes,
      bio: childData.bio || childData.notes,
      profilePicture: childData.photo || childData.photoURL || childData.profilePicture,
      photoURL: childData.photo || childData.photoURL || childData.profilePicture,
      contactInfo: childData.contactInfo || {}
    };
    
    // Add the child to the family tree
    family.children.push(transformedChildData);
    
    // Save the updated family tree
    const updatedFamily = await family.save();
    
    console.log('Updated family tree with new child:', updatedFamily._id);
    
    res.status(200).json({
      success: true,
      data: updatedFamily
    });
  } catch (error) {
    console.error('Add Child Error:', error);
    
    // Check for validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        error: messages
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Get family members (for sharing, etc.)
export const getFamilyMembers = async (req, res) => {
  try {
    // Find the family tree for the current user
    const family = await Family.findOne({ userId: req.user._id });
    
    if (!family) {
      return res.status(404).json({
        success: false,
        error: 'Family tree not found'
      });
    }
    
    // Extract family members
    const members = [
      {
        id: family._id,
        name: family.name,
        relationship: 'self',
        isRoot: true
      },
      ...family.children.map(child => ({
        id: child._id,
        name: child.name,
        relationship: child.relationship,
        isRoot: false
      }))
    ];
    
    res.status(200).json({
      success: true,
      data: members
    });
  } catch (error) {
    console.error('Get Family Members Error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// ✅ GET: Get a specific family tree by ID
export const getFamilyById = async (req, res) => {
  try {
    const { treeId } = req.params;
    
    // Validate that the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(treeId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid family tree ID'
      });
    }
    
    // Find the family tree by ID
    const family = await Family.findById(treeId);
    
    if (!family) {
      return res.status(404).json({
        success: false,
        error: 'Family tree not found'
      });
    }
    
    // Check if the user has access to this family tree
    const user = await User.findById(req.user._id);
    const hasAccess = user.families.some(f => 
      f.familyId.toString() === treeId && ['view', 'edit', 'admin'].includes(f.access)
    );
    
    if (!hasAccess && family.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this family tree'
      });
    }
    
    res.status(200).json({
      success: true,
      data: family
    });
  } catch (error) {
    console.error('Get Family By ID Error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// ✅ GET: Get members of a specific family tree
export const getFamilyMembersByTreeId = async (req, res) => {
  try {
    const { treeId } = req.params;
    
    // Validate that the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(treeId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid family tree ID'
      });
    }
    
    // Find the family tree by ID
    const family = await Family.findById(treeId);
    
    if (!family) {
      return res.status(404).json({
        success: false,
        error: 'Family tree not found'
      });
    }
    
    // Check if the user has access to this family tree
    const user = await User.findById(req.user._id);
    const hasAccess = user.families.some(f => 
      f.familyId.toString() === treeId && ['view', 'edit', 'admin'].includes(f.access)
    );
    
    if (!hasAccess && family.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this family tree'
      });
    }
    
    // Format the members data
    const members = family.children.map(child => ({
      id: child._id,
      name: child.name,
      firstName: child.firstName,
      lastName: child.lastName,
      gender: child.gender,
      birthDate: child.birthDate,
      deathDate: child.deathDate,
      isAlive: child.isAlive,
      relationship: child.relationship,
      parentId: child.parentId,
      location: child.location,
      occupation: child.occupation,
      bio: child.bio || child.notes,
      photoURL: child.photoURL || child.profilePicture,
      contactInfo: child.contactInfo
    }));
    
    res.status(200).json({
      success: true,
      data: members
    });
  } catch (error) {
    console.error('Get Family Members By Tree ID Error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};