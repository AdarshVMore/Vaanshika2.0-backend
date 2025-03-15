// File: routes/eventRoutes.js
// Routes for event functionality

import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';

// Import controllers (to be implemented)
import { 
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  respondToEvent,
  getCalendarEvents
} from '../controllers/eventController.js';

const router = express.Router();

// Apply auth middleware to all event routes
router.use(protect);

// Event routes
router.post('/', createEvent);
router.get('/', getEvents);
router.get('/calendar', getCalendarEvents);
router.get('/:id', getEventById);
router.put('/:id', updateEvent);
router.delete('/:id', deleteEvent);
router.post('/:id/rsvp', respondToEvent);

export default router; 