# Vaanshika Backend

Backend for the Vaanshika family tree management application with chat and event features.

## Features

### Authentication
- Firebase authentication integration
- User registration and login
- Password reset functionality

### Family Tree Management
- Create and manage family trees
- Add, update, and delete family members
- Share family trees with other users

### Chat System
- Real-time messaging using Socket.io
- Chat rooms for family discussions
- Message read receipts
- Support for text messages and file attachments
- Typing indicators

### Event Management
- Create and manage family events
- Calendar integration with date filtering
- RSVP functionality for event attendance
- Event notifications to chat rooms

### Notifications
- Real-time notifications using Socket.io
- Notification types: chat, event, invite
- Mark notifications as read/unread
- Delete notifications

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login a user
- `POST /api/auth/logout` - Logout a user
- `POST /api/auth/forgot-password` - Request password reset

### Family
- `POST /api/family` - Create a new family tree
- `GET /api/family` - Get family tree by user ID
- `POST /api/family/addChild` - Add a child to the family tree
- `PATCH /api/family/updateChild` - Update a family member
- `DELETE /api/family/deleteChild` - Delete a family member
- `DELETE /api/family/deleteTree` - Delete a family tree

### Chat
- `POST /api/chat/rooms` - Create a new chat room
- `GET /api/chat/rooms` - Get all chat rooms for current user
- `GET /api/chat/rooms/:id` - Get specific chat room and messages
- `POST /api/chat/messages` - Send a new message
- `PUT /api/chat/messages/:id/read` - Mark message as read
- `GET /api/chat/unread` - Get unread message count

### Events
- `POST /api/events` - Create a new event
- `GET /api/events` - Get all events for current user
- `GET /api/events/:id` - Get specific event details
- `PUT /api/events/:id` - Update an event
- `DELETE /api/events/:id` - Delete an event
- `POST /api/events/:id/rsvp` - Respond to event invitation
- `GET /api/events/calendar` - Get calendar view with all events

### Notifications
- `GET /api/notifications` - Get user's notifications
- `GET /api/notifications/unread-count` - Get unread notification count
- `PUT /api/notifications/read-all` - Mark all notifications as read
- `PUT /api/notifications/:id/read` - Mark notification as read
- `DELETE /api/notifications/:id` - Delete notification

## Socket.io Events

### Connection
- `connection` - User connects to the socket server
- `disconnect` - User disconnects from the socket server

### Chat
- `send_message` - User sends a message
- `new_message` - New message received
- `typing` - User is typing
- `stop_typing` - User stopped typing
- `mark_read` - User read a message
- `message_read` - Message was read by a user
- `join_room` - User joins a chat room
- `leave_room` - User leaves a chat room

### Notifications
- `notification` - New notification
- `notification_read` - Notification was read
- `notification_deleted` - Notification was deleted
- `all_notifications_read` - All notifications were read

## Technologies Used

- Node.js
- Express.js
- MongoDB with Mongoose
- Socket.io for real-time features
- Firebase Authentication
- AWS S3 for file storage

## Setup and Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with the following variables:
   ```
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   FIREBASE_API_KEY=your_firebase_api_key
   AWS_ACCESS_KEY_ID=your_aws_access_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret_key
   AWS_REGION=your_aws_region
   AWS_BUCKET_NAME=your_s3_bucket_name
   ```
4. Start the server: `npm start`

## Development

For development with auto-restart:
```
npm run dev
``` 