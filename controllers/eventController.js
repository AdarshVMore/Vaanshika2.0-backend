// File: controllers/eventController.js
// Controller for event functionality

import Event from '../models/Event.js';
import User from '../models/User.js';
import ChatRoom from '../models/ChatRoom.js';
import Notification from '../models/Notification.js';
import { sendNotificationToUser, sendNotificationToRoom } from '../config/socket.js';

/**
 * @desc    Create a new event
 * @route   POST /api/events
 * @access  Private
 */
export const createEvent = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      location, 
      startDate, 
      endDate, 
      familyId, 
      notifiedChatRooms,
      attendees 
    } = req.body;

    if (!title || !startDate || !familyId) {
      return res.status(400).json({
        success: false,
        message: 'Title, start date, and family ID are required'
      });
    }

    // Create new event
    const newEvent = new Event({
      title,
      description: description || '',
      location: location || '',
      startDate,
      endDate: endDate || null,
      createdBy: req.user._id,
      familyId,
      notifiedChatRooms: notifiedChatRooms || [],
      attendees: attendees || [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await newEvent.save();

    // Add event to creator's events array
    await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { events: newEvent._id } }
    );

    // Create notifications for chat rooms if specified
    if (notifiedChatRooms && notifiedChatRooms.length > 0) {
      // Get all members from the specified chat rooms
      const rooms = await ChatRoom.find({ 
        _id: { $in: notifiedChatRooms } 
      });
      
      // Collect unique member IDs from all rooms
      const memberIds = [...new Set(
        rooms.flatMap(room => 
          room.members.map(id => id.toString())
        )
      )];
      
      // Filter out the creator
      const recipientIds = memberIds.filter(
        id => id !== req.user._id.toString()
      );
      
      // Create notifications
      const notifications = recipientIds.map(recipientId => ({
        recipient: recipientId,
        type: 'event',
        title: 'New Event',
        message: `${req.user.name} created a new event: ${title}`,
        relatedId: newEvent._id,
        relatedType: 'Event',
        isRead: false,
        createdAt: new Date()
      }));
      
      if (notifications.length > 0) {
        const createdNotifications = await Notification.insertMany(notifications);
        
        // Send real-time notifications to online users
        const io = req.app.get('io');
        if (io) {
          createdNotifications.forEach(notification => {
            sendNotificationToUser(io, notification.recipient, {
              _id: notification._id,
              type: notification.type,
              title: notification.title,
              message: notification.message,
              eventId: newEvent._id,
              eventTitle: title
            });
          });
          
          // Also send notifications to the chat rooms
          notifiedChatRooms.forEach(roomId => {
            sendNotificationToRoom(io, roomId, {
              type: 'event',
              title: 'New Event',
              message: `${req.user.name} created a new event: ${title}`,
              eventId: newEvent._id,
              eventTitle: title,
              createdBy: {
                _id: req.user._id,
                name: req.user.name
              }
            }, req.user._id);
          });
        }
      }
    }

    res.status(201).json({
      success: true,
      data: newEvent
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get all events for current user
 * @route   GET /api/events
 * @access  Private
 */
export const getEvents = async (req, res) => {
  try {
    // Get query parameters for filtering
    const { familyId, startDate, endDate, status } = req.query;
    
    // Build filter object
    const filter = {};
    
    // Filter by family if provided
    if (familyId) {
      filter.familyId = familyId;
    }
    
    // Filter by date range if provided
    if (startDate || endDate) {
      filter.startDate = {};
      if (startDate) filter.startDate.$gte = new Date(startDate);
      if (endDate) filter.startDate.$lte = new Date(endDate);
    }
    
    // Find events where user is creator or attendee
    const events = await Event.find({
      $or: [
        { createdBy: req.user._id },
        { 'attendees.userId': req.user._id }
      ],
      ...filter
    })
      .populate('createdBy', 'name email profilePicture')
      .populate('attendees.userId', 'name email profilePicture')
      .populate('notifiedChatRooms', 'name')
      .sort({ startDate: 1 });
    
    // Filter by attendance status if provided
    let filteredEvents = events;
    if (status) {
      filteredEvents = events.filter(event => {
        const userAttendance = event.attendees.find(
          a => a.userId._id.toString() === req.user._id.toString()
        );
        return userAttendance && userAttendance.status === status;
      });
    }

    res.json({
      success: true,
      count: filteredEvents.length,
      data: filteredEvents
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get specific event details
 * @route   GET /api/events/:id
 * @access  Private
 */
export const getEventById = async (req, res) => {
  try {
    const eventId = req.params.id;
    
    const event = await Event.findById(eventId)
      .populate('createdBy', 'name email profilePicture')
      .populate('attendees.userId', 'name email profilePicture')
      .populate('notifiedChatRooms', 'name');
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user is creator or attendee
    const isCreator = event.createdBy._id.toString() === req.user._id.toString();
    const isAttendee = event.attendees.some(
      a => a.userId._id.toString() === req.user._id.toString()
    );
    
    if (!isCreator && !isAttendee) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this event'
      });
    }

    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Update an event
 * @route   PUT /api/events/:id
 * @access  Private
 */
export const updateEvent = async (req, res) => {
  try {
    const eventId = req.params.id;
    const { 
      title, 
      description, 
      location, 
      startDate, 
      endDate, 
      notifiedChatRooms 
    } = req.body;
    
    const event = await Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    // Check if user is the creator
    if (event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this event'
      });
    }
    
    // Store original values for comparison
    const originalTitle = event.title;
    const originalStartDate = event.startDate;
    const originalNotifiedRooms = [...event.notifiedChatRooms];
    
    // Update fields
    if (title) event.title = title;
    if (description !== undefined) event.description = description;
    if (location !== undefined) event.location = location;
    if (startDate) event.startDate = startDate;
    if (endDate !== undefined) event.endDate = endDate;
    if (notifiedChatRooms) event.notifiedChatRooms = notifiedChatRooms;
    
    event.updatedAt = new Date();
    
    await event.save();
    
    // Determine if significant changes were made
    const titleChanged = title && title !== originalTitle;
    const dateChanged = startDate && new Date(startDate).getTime() !== new Date(originalStartDate).getTime();
    const significantChange = titleChanged || dateChanged;
    
    // Create notifications for newly added chat rooms
    if (notifiedChatRooms && notifiedChatRooms.length > 0) {
      // Find newly added chat rooms
      const newRoomIds = notifiedChatRooms.filter(
        id => !originalNotifiedRooms.some(origId => origId.toString() === id.toString())
      );
      
      if (newRoomIds.length > 0 || significantChange) {
        // Get members from new rooms
        const rooms = await ChatRoom.find({ 
          _id: { $in: significantChange ? notifiedChatRooms : newRoomIds } 
        });
        
        // Collect unique member IDs
        const memberIds = [...new Set(
          rooms.flatMap(room => 
            room.members.map(id => id.toString())
          )
        )];
        
        // Filter out the creator
        const recipientIds = memberIds.filter(
          id => id !== req.user._id.toString()
        );
        
        // Create notifications
        const notifications = recipientIds.map(recipientId => ({
          recipient: recipientId,
          type: 'event',
          title: 'Event Update',
          message: `${req.user.name} updated an event: ${event.title}`,
          relatedId: event._id,
          relatedType: 'Event',
          isRead: false,
          createdAt: new Date()
        }));
        
        if (notifications.length > 0) {
          const createdNotifications = await Notification.insertMany(notifications);
          
          // Send real-time notifications to online users
          const io = req.app.get('io');
          if (io) {
            createdNotifications.forEach(notification => {
              sendNotificationToUser(io, notification.recipient, {
                _id: notification._id,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                eventId: event._id,
                eventTitle: event.title
              });
            });
            
            // Also send notifications to the chat rooms
            const roomsToNotify = significantChange ? notifiedChatRooms : newRoomIds;
            roomsToNotify.forEach(roomId => {
              sendNotificationToRoom(io, roomId, {
                type: 'event',
                title: 'Event Update',
                message: `${req.user.name} updated an event: ${event.title}`,
                eventId: event._id,
                eventTitle: event.title,
                updatedBy: {
                  _id: req.user._id,
                  name: req.user.name
                }
              }, req.user._id);
            });
          }
        }
      }
    }
    
    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Delete an event
 * @route   DELETE /api/events/:id
 * @access  Private
 */
export const deleteEvent = async (req, res) => {
  try {
    const eventId = req.params.id;
    
    const event = await Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    // Check if user is the creator
    if (event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this event'
      });
    }
    
    // Store event details for notifications
    const eventTitle = event.title;
    const notifiedRooms = [...event.notifiedChatRooms];
    const attendeeIds = event.attendees.map(a => a.userId);
    
    // Remove event from all users' events arrays
    await User.updateMany(
      { events: eventId },
      { $pull: { events: eventId } }
    );
    
    // Delete all notifications related to this event
    await Notification.deleteMany({
      relatedId: eventId,
      relatedType: 'Event'
    });
    
    // Delete the event
    await Event.findByIdAndDelete(eventId);
    
    // Create cancellation notifications for attendees and chat rooms
    const notifications = [];
    
    // Add notifications for attendees
    attendeeIds.forEach(userId => {
      if (userId.toString() !== req.user._id.toString()) {
        notifications.push({
          recipient: userId,
          type: 'event',
          title: 'Event Cancelled',
          message: `${req.user.name} has cancelled the event: ${eventTitle}`,
          isRead: false,
          createdAt: new Date()
        });
      }
    });
    
    if (notifications.length > 0) {
      const createdNotifications = await Notification.insertMany(notifications);
      
      // Send real-time notifications to online users
      const io = req.app.get('io');
      if (io) {
        createdNotifications.forEach(notification => {
          sendNotificationToUser(io, notification.recipient, {
            _id: notification._id,
            type: notification.type,
            title: notification.title,
            message: notification.message
          });
        });
        
        // Also send notifications to the chat rooms
        notifiedRooms.forEach(roomId => {
          sendNotificationToRoom(io, roomId, {
            type: 'event',
            title: 'Event Cancelled',
            message: `${req.user.name} has cancelled the event: ${eventTitle}`,
            cancelledBy: {
              _id: req.user._id,
              name: req.user.name
            }
          }, req.user._id);
        });
      }
    }
    
    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Respond to event invitation (RSVP)
 * @route   POST /api/events/:id/rsvp
 * @access  Private
 */
export const respondToEvent = async (req, res) => {
  try {
    const eventId = req.params.id;
    const { status } = req.body;
    
    if (!status || !['pending', 'attending', 'declined'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status (pending, attending, declined) is required'
      });
    }
    
    const event = await Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    // Check if user is already an attendee
    const attendeeIndex = event.attendees.findIndex(
      a => a.userId.toString() === req.user._id.toString()
    );
    
    if (attendeeIndex >= 0) {
      // Update existing attendee status
      event.attendees[attendeeIndex].status = status;
    } else {
      // Add user as new attendee
      event.attendees.push({
        userId: req.user._id,
        status
      });
      
      // Add event to user's events array
      await User.findByIdAndUpdate(
        req.user._id,
        { $addToSet: { events: eventId } }
      );
    }
    
    event.updatedAt = new Date();
    await event.save();
    
    // Create notification for event creator
    if (event.createdBy.toString() !== req.user._id.toString()) {
      const notification = await Notification.create({
        recipient: event.createdBy,
        type: 'event',
        title: 'Event RSVP',
        message: `${req.user.name} has ${status === 'attending' ? 'accepted' : 'declined'} your event: ${event.title}`,
        relatedId: event._id,
        relatedType: 'Event',
        isRead: false,
        createdAt: new Date()
      });
      
      // Send real-time notification to creator if online
      const io = req.app.get('io');
      if (io) {
        sendNotificationToUser(io, event.createdBy, {
          _id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          eventId: event._id,
          eventTitle: event.title,
          status
        });
      }
    }
    
    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Error responding to event:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get calendar view with all events
 * @route   GET /api/events/calendar
 * @access  Private
 */
export const getCalendarEvents = async (req, res) => {
  try {
    // Get query parameters for filtering
    const { year, month, familyId } = req.query;
    
    // Build date range filter
    let startOfPeriod, endOfPeriod;
    
    if (year && month) {
      // Filter by specific month
      startOfPeriod = new Date(parseInt(year), parseInt(month) - 1, 1);
      endOfPeriod = new Date(parseInt(year), parseInt(month), 0);
    } else if (year) {
      // Filter by specific year
      startOfPeriod = new Date(parseInt(year), 0, 1);
      endOfPeriod = new Date(parseInt(year), 11, 31);
    } else {
      // Default to current month
      const now = new Date();
      startOfPeriod = new Date(now.getFullYear(), now.getMonth(), 1);
      endOfPeriod = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    
    // Build filter object
    const filter = {
      $or: [
        // Events starting within the period
        {
          startDate: {
            $gte: startOfPeriod,
            $lte: endOfPeriod
          }
        },
        // Events ending within the period
        {
          endDate: {
            $gte: startOfPeriod,
            $lte: endOfPeriod
          }
        },
        // Events spanning the entire period
        {
          startDate: { $lte: startOfPeriod },
          endDate: { $gte: endOfPeriod }
        }
      ],
      $and: [
        {
          $or: [
            { createdBy: req.user._id },
            { 'attendees.userId': req.user._id }
          ]
        }
      ]
    };
    
    // Add family filter if provided
    if (familyId) {
      filter.familyId = familyId;
    }
    
    // Find events
    const events = await Event.find(filter)
      .populate('createdBy', 'name email profilePicture')
      .sort({ startDate: 1 });
    
    // Group events by date for calendar view
    const calendarEvents = {};
    
    events.forEach(event => {
      // For multi-day events, add to each day
      let currentDate = new Date(event.startDate);
      const endDate = event.endDate || currentDate;
      
      while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        
        if (!calendarEvents[dateKey]) {
          calendarEvents[dateKey] = [];
        }
        
        calendarEvents[dateKey].push({
          id: event._id,
          title: event.title,
          description: event.description,
          location: event.location,
          startDate: event.startDate,
          endDate: event.endDate,
          isMultiDay: event.endDate ? true : false,
          isCreator: event.createdBy._id.toString() === req.user._id.toString(),
          createdBy: {
            _id: event.createdBy._id,
            name: event.createdBy.name,
            profilePicture: event.createdBy.profilePicture
          }
        });
        
        // Move to next day
        currentDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    
    res.json({
      success: true,
      data: {
        period: {
          start: startOfPeriod,
          end: endOfPeriod
        },
        events: calendarEvents
      }
    });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
}; 