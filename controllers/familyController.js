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
    
    // Check for duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'You already have a family tree'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// ✅ GET: Retrieve Family Tree Data by User ID
export const getFamilyByUserId = async (req, res) => {
  try {
    const family = await Family.findOne({ userId: req.user._id });
    
    if (!family) {
      return res.status(404).json({
        success: false,
        error: 'Family tree not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: family
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
    const updateData = req.body;
    
    // Find the family tree for the current user
    const family = await Family.findOne({ userId: req.user._id });
    
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
    
    // Find the family tree for the current user
    const family = await Family.findOne({ userId: req.user._id });
    
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
    // Delete the family tree for the current user
    const result = await Family.deleteOne({ userId: req.user._id });
    
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
    
    // Find the family tree for the current user
    const family = await Family.findOne({ userId: req.user._id });
    
    if (!family) {
      return res.status(404).json({
        success: false,
        error: 'Family tree not found'
      });
    }
    
    // Add the child to the family tree
    family.children.push(childData);
    
    // Save the updated family tree
    const updatedFamily = await family.save();
    
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