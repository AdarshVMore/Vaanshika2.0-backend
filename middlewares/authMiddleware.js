// File: middlewares/authMiddleware.js
// Middleware for JWT authentication

// Comment out Firebase Admin import
// import admin from '../config/firebaseAdmin.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';

// JWT secret key - should be in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || "vaanshika-jwt-secret-key";

// Middleware to protect routes
export const protect = async (req, res, next) => {
  try {
    // Retrieve token from Authorization header
    const token = (req.headers.authorization?.startsWith('Bearer ') && req.headers.authorization.split(' ')[1]);

    if (!token) {
      return res.status(401).json({ message: 'Not authorized. Token missing.' });
    }

    // Verify the JWT token
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    // Find the user in MongoDB using the decoded user ID
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Attach user info to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error.message);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token. Please log in again.' });
    }

    res.status(500).json({ message: 'Authentication failed. Please log in again.' });
  }
};