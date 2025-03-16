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
    console.log('Creating family tree with data:', familyData);
    console.log('User ID:', req.user._id);
    
    // Attach the user ID to the family data
    familyData.userId = req.user._id; // Use MongoDB's _id
    
    // Create a new family document
    const family = new Family(familyData);
    
    // Save the family to the database
    const savedFamily = await family.save();
    console.log('Family tree created with ID:', savedFamily._id);
    
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
    console.log('Chat room created with ID:', chatRoom._id);
    
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
    console.log('Family added to user\'s families array');
    
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
      chatRoom: chatRoom
    });
  } catch (error) {
    console.error('Add Family Error:', error);
    
    // Check for validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
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
        error: 'You already have a family tree'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
  catch(error) {
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

// Helper function to get the complementary relationship type
const getComplementaryRelationshipType = (relationshipType) => {
  switch (relationshipType) {
    case 'husband':
      return 'wife';
    case 'wife':
      return 'husband';
    case 'fiancé':
      return 'fiancée';
    case 'fiancée':
      return 'fiancé';
    case 'father':
      return 'child';
    case 'mother':
      return 'child';
    case 'parent':
      return 'child';
    case 'child':
      return 'parent';
    default:
      return relationshipType; // 'spouse', 'partner', 'ex-spouse' remain the same
  }
};

// ✅ POST: Add a family member (child, parent, or partner)
export const addFamilyMember = async (req, res) => {
  try {
    // Get tree ID from params or query
    const treeId = req.params.treeId || req.query.treeId;
    const userId = req.user._id || req.user.id; // Handle both formats
    
    // Get member data from request body
    const memberData = req.body;
    
    console.log('Adding member to tree:', treeId);
    console.log('Member data:', memberData);
    console.log('User ID:', userId);
    
    // Determine relationship type
    const relationshipType = memberData.relationshipType || 'child';
    const isPartnerRelationship = ['spouse', 'partner', 'husband', 'wife'].includes(relationshipType);
    const isParentRelationship = ['parent', 'father', 'mother', 'dad', 'mom', 'stepMom', 'stepDad'].includes(relationshipType);
    const isChildRelationship = ['child', 'adopted', 'foster'].includes(relationshipType);
    
    // Get related member ID based on relationship type
    const relatedMemberId = isPartnerRelationship ? memberData.partnerId : 
                           isParentRelationship ? memberData.childId :
                           isChildRelationship ? memberData.parentId : null;
    
    // Find the family tree - use userId instead of user
    const familyTree = await Family.findOne({ 
      _id: treeId,
      userId: userId
    });
    
    if (!familyTree) {
      console.error(`Family tree not found for treeId: ${treeId} and userId: ${userId}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Family tree not found' 
      });
    }
    
    console.log('Found family tree:', familyTree._id);
    
    // Check if this is the first member (root)
    const isFirstMember = familyTree.members.length === 0;
    
    // Transform member data to match schema
    const newMember = {
      firstName: memberData.firstName,
      lastName: memberData.lastName,
      gender: memberData.gender,
      birthDate: memberData.birthDate,
      deathDate: memberData.deathDate,
      isAlive: memberData.isAlive === 'true' || memberData.isAlive === true,
      location: memberData.location,
      occupation: memberData.occupation,
      bio: memberData.bio,
      contactInfo: memberData.contactInfo ? 
        (typeof memberData.contactInfo === 'string' ? 
          JSON.parse(memberData.contactInfo) : memberData.contactInfo) : 
        {},
      relationshipType: relationshipType,
      isRoot: isFirstMember, // Set as root if it's the first member
      parents: [],
      children: [],
      partners: []
    };
    
    // Handle photo upload if provided
    if (req.file) {
      // Upload to S3 or save locally
      newMember.photoURL = `/uploads/${req.file.filename}`;
    }
    
    // Generate a unique ID for the new member
    const memberId = new mongoose.Types.ObjectId();
    newMember._id = memberId;
    
    // Add the new member to the family tree
    familyTree.members.push(newMember);
    
    // If this is a partner relationship, update both members
    if (isPartnerRelationship && relatedMemberId) {
      console.log(`Adding partner relationship between ${relatedMemberId} and ${memberId}`);
      
      // Find the partner in the family tree
      const partnerIndex = familyTree.members.findIndex(
        member => member._id.toString() === relatedMemberId
      );
      
      if (partnerIndex !== -1) {
        // Initialize partners array if it doesn't exist
        if (!familyTree.members[partnerIndex].partners) {
          familyTree.members[partnerIndex].partners = [];
        }
        
        // Add the new member as a partner
        familyTree.members[partnerIndex].partners.push(memberId);
        
        // Add the partner to the new member's partners array
        newMember.partners.push(familyTree.members[partnerIndex]._id);
        
        console.log(`Partner relationship created between ${relatedMemberId} and ${memberId}`);
      } else {
        console.log(`Partner with ID ${relatedMemberId} not found in family tree`);
      }
    }
    // If this is a parent relationship, update the child-parent relationship
    else if (isParentRelationship && relatedMemberId) {
      console.log(`Adding parent relationship between parent ${memberId} and child ${relatedMemberId}`);
      
      // Find the child in the family tree
      const childIndex = familyTree.members.findIndex(
        member => member._id.toString() === relatedMemberId
      );
      
      if (childIndex !== -1) {
        // Initialize parents array if it doesn't exist
        if (!familyTree.members[childIndex].parents) {
          familyTree.members[childIndex].parents = [];
        }
        
        // Add the new member as a parent
        familyTree.members[childIndex].parents.push(memberId);
        
        // Add the child to the new member's children array
        newMember.children.push(familyTree.members[childIndex]._id);
        
        console.log(`Parent relationship created between parent ${memberId} and child ${relatedMemberId}`);
      } else {
        console.log(`Child with ID ${relatedMemberId} not found in family tree`);
      }
    }
    // If this is a child relationship, update the parent-child relationship
    else if (isChildRelationship && relatedMemberId) {
      console.log(`Adding child relationship between parent ${relatedMemberId} and child ${memberId}`);
      
      // Find the parent in the family tree
      const parentIndex = familyTree.members.findIndex(
        member => member._id.toString() === relatedMemberId
      );
      
      if (parentIndex !== -1) {
        // Initialize children array if it doesn't exist
        if (!familyTree.members[parentIndex].children) {
          familyTree.members[parentIndex].children = [];
        }
        
        // Add the new member as a child
        familyTree.members[parentIndex].children.push(memberId);
        
        // Add the parent to the new member's parents array
        newMember.parents.push(familyTree.members[parentIndex]._id);
        
        console.log(`Child relationship created between parent ${relatedMemberId} and child ${memberId}`);
      } else {
        console.log(`Parent with ID ${relatedMemberId} not found in family tree`);
      }
    }
    
    // Save the updated family tree
    const updatedFamilyTree = await familyTree.save();
    console.log('Family tree updated with new member');
    
    return res.status(201).json({
      success: true,
      data: {
        member: newMember,
        treeId: updatedFamilyTree._id
      }
    });
  } catch (error) {
    console.error('Error adding family member:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// For backward compatibility, keep the addChild function
export const addChild = addFamilyMember;

// ✅ POST: Link two family members as spouses
export const linkSpouses = async (req, res) => {
  try {
    const { member1Id, member2Id, relationshipType } = req.body;
    const { treeId } = req.query;
    
    if (!member1Id || !member2Id) {
      return res.status(400).json({
        success: false,
        error: 'Both member IDs are required'
      });
    }
    
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
    
    // Find both members in the family tree
    const member1Index = family.children.findIndex(
      child => child._id.toString() === member1Id
    );
    
    const member2Index = family.children.findIndex(
      child => child._id.toString() === member2Id
    );
    
    if (member1Index === -1 || member2Index === -1) {
      return res.status(404).json({
        success: false,
        error: 'One or both members not found in family tree'
      });
    }
    
    // Generate a family unit ID
    const familyUnitId = `family_unit_${Date.now()}`;
    
    // Update member 1
    family.children[member1Index].spouseId = member2Id;
    family.children[member1Index].relationshipType = relationshipType || 'spouse';
    family.children[member1Index].isPartOfFamilyUnit = true;
    family.children[member1Index].familyUnitId = familyUnitId;
    
    // Update member 2 with complementary relationship
    family.children[member2Index].spouseId = member1Id;
    family.children[member2Index].relationshipType = getComplementaryRelationshipType(relationshipType || 'spouse');
    family.children[member2Index].isPartOfFamilyUnit = true;
    family.children[member2Index].familyUnitId = familyUnitId;
    
    // Save the updated family tree
    const updatedFamily = await family.save();
    
    res.status(200).json({
      success: true,
      data: {
        member1: family.children[member1Index],
        member2: family.children[member2Index],
        familyUnitId
      }
    });
  } catch (error) {
    console.error('Link Spouses Error:', error);
    
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
    
    console.log(`Getting members for tree ID: ${treeId}`);
    
    // Validate that the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(treeId)) {
      console.error(`Invalid tree ID format: ${treeId}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid family tree ID'
      });
    }
    
    // Find the family tree by ID
    const family = await Family.findById(treeId);
    
    if (!family) {
      console.error(`Family tree not found with ID: ${treeId}`);
      return res.status(404).json({
        success: false,
        error: 'Family tree not found'
      });
    }
    
    console.log(`Found family tree: ${family.name} with ${family.members ? family.members.length : 0} members`);
    
    // Check if the user has access to this family tree
    const user = await User.findById(req.user._id);
    const hasAccess = user.families.some(f => 
      f.familyId.toString() === treeId && ['view', 'edit', 'admin'].includes(f.access)
    );
    
    if (!hasAccess && family.userId.toString() !== req.user._id.toString()) {
      console.error(`User ${req.user._id} does not have access to family tree ${treeId}`);
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this family tree'
      });
    }
    
    // Format the members data - use family.members instead of family.children
    const members = family.members ? family.members.map(member => ({
      id: member._id,
      name: `${member.firstName || ''} ${member.lastName || ''}`.trim(),
      firstName: member.firstName,
      lastName: member.lastName,
      gender: member.gender,
      birthDate: member.birthDate,
      deathDate: member.deathDate,
      isAlive: member.isAlive,
      relationshipType: member.relationshipType,
      parentId: member.parents && member.parents.length > 0 ? member.parents[0] : null,
      spouses: member.spouses || [],
      children: member.children || [],
      location: member.location,
      occupation: member.occupation,
      bio: member.bio || member.notes,
      photoURL: member.photoURL || member.profilePicture,
      contactInfo: member.contactInfo
    })) : [];
    
    console.log(`Returning ${members.length} members for tree ID: ${treeId}`);
    
    res.status(200).json({
      success: true,
      data: members
    });
  } catch (error) {
    console.error('Get Family Members By Tree ID Error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message
    });
  }
};