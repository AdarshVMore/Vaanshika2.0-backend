import express from 'express';
import { 
  addFamily, 
  getFamilyByUserId, 
  updateChild, 
  deleteChild, 
  deleteTree, 
  addChild,
  getFamilyMembers
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
router.patch('/children/:childId', updateChild);
router.delete('/children/:childId', deleteChild);

// Family members route (for sharing, etc.)
router.get('/members', getFamilyMembers);

export default router;