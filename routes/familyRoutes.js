import express from 'express';
import { 
  addFamily, 
  getFamilyByUserId, 
  updateChild, 
  deleteChild, 
  deleteTree, 
  addChild,
  addFamilyMember,
  getFamilyMembers,
  getAllFamilyTrees,
  getFamilyById,
  getFamilyMembersByTreeId,
  linkSpouses
} from '../controllers/familyController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply protect middleware to all routes
router.use(protect);

// Family tree routes
router.post('/', addFamily);
router.get('/', getFamilyByUserId);
router.delete('/', deleteTree);

// Child routes
router.post('/children', addChild);
// Get all family trees for a user
router.get('/all', getAllFamilyTrees);

// Get a specific family tree by ID
router.get('/:treeId', getFamilyById);

// Get members of a specific family tree
router.get('/:treeId/members', getFamilyMembersByTreeId);

// Family member routes - support both with and without treeId
router.post('/members', addFamilyMember);
router.post('/:treeId/members', addFamilyMember);

// Child routes - for backward compatibility
router.post('/children', addFamilyMember);
router.post('/:treeId/children', addFamilyMember);

// Parent routes
router.post('/parents', addFamilyMember);
router.post('/:treeId/parents', addFamilyMember);

// Partner routes
router.post('/partners', addFamilyMember);
router.post('/:treeId/partners', addFamilyMember);

// Update and delete routes
router.patch('/members/:memberId', updateChild);
router.patch('/:treeId/members/:memberId', updateChild);
router.delete('/members/:memberId', deleteChild);
router.delete('/:treeId/members/:memberId', deleteChild);

// Legacy routes for backward compatibility
router.patch('/children/:childId', updateChild);
router.delete('/children/:childId', deleteChild);

// Spouse relationship routes
router.post('/spouses', linkSpouses);
router.post('/:treeId/spouses', linkSpouses);

// Family members route (for sharing, etc.)
router.get('/members', getFamilyMembers);

export default router;