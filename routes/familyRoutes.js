import express from 'express';
import { 
  addFamily, 
  getFamilyByUserId, 
  updateChild, 
  deleteChild, 
  deleteTree, 
  addChild,
  getFamilyMembers,
  getAllFamilyTrees,
  getFamilyById,
  getFamilyMembersByTreeId
} from '../controllers/familyController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply protect middleware to all routes
router.use(protect);

// Family tree routes
router.post('/', addFamily);
router.get('/', getFamilyByUserId);
router.delete('/', deleteTree); // Legacy route for backward compatibility
router.delete('/:treeId', deleteTree); // New route for deleting a specific tree

// Get all family trees for a user
router.get('/all', getAllFamilyTrees);

// Get a specific family tree by ID
router.get('/:treeId', getFamilyById);

// Get members of a specific family tree
router.get('/:treeId/members', getFamilyMembersByTreeId);

// Child routes - support both with and without treeId
router.post('/children', addChild);
router.post('/:treeId/children', addChild);
router.patch('/children/:childId', updateChild);
router.patch('/:treeId/children/:childId', updateChild);
router.delete('/children/:childId', deleteChild);
router.delete('/:treeId/children/:childId', deleteChild);

// Family members route (for sharing, etc.)
router.get('/members', getFamilyMembers);
// Add POST route for members to match frontend API call
router.post('/members', addChild);
router.post('/:treeId/members', addChild);

export default router;