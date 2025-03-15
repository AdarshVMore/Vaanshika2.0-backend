import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// JWT secret key - should be in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || "vaanshika-jwt-secret-key";

// Middleware to protect routes that require authentication
export const protect = async (req, res, next) => {
  let token;

  // Check if token exists in Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);

      // Find user by id (excluding password)
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      next();
    } catch (error) {
      console.error('Auth middleware error:', error.message);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Middleware to check if user is an admin
export const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

// Middleware to check if user is verified
export const verified = (req, res, next) => {
  if (req.user && req.user.isVerified) {
    next();
  } else {
    res.status(403).json({ message: 'Email not verified' });
  }
}; 