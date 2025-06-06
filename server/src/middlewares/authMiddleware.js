import jwt from "jsonwebtoken";
import { promisify } from "util";
import User from "../models/User.js";
import Organizer from "../models/organizerModel.js";
import { config } from "../config/config.js";

// Helper to extract token from header
const getTokenFromHeader = (req) => {
  // Check for authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Check if it follows Bearer token format
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  // Extract the token
  return authHeader.split(" ")[1];
};

export const authMiddleware = async (req, res, next) => {
  try {
    let token;

    // Check for token in authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Please log in to access this resource",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret);

    // Check if decoded ID is valid
    if (!decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token format",
      });
    }

    // Find user first
    let user = await User.findById(decoded.id);
    if (user) {
      // Set user in request with proper role information
      req.user = {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.role === "admin",
      };
      return next();
    }

    // If not a regular user, try to find organizer
    let organizer = await Organizer.findById(decoded.id);
    if (organizer) {
      // Set organizer in request - keep existing structure
      req.organizer = organizer;
      req.user = {
        _id: organizer._id,
        id: organizer._id,
        role: "organizer",
        name: organizer.name,
        email: organizer.email,
      };
      return next();
    }

    // If no user or organizer found
    return res.status(401).json({
      success: false,
      message: "User not found",
    });
  } catch (error) {
    console.error("Authentication error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
};

// Specific middleware for organizer routes - keep existing implementation
export const verifyOrganizerToken = async (req, res, next) => {
  try {
    // Get token from header
    const token = getTokenFromHeader(req);

    if (!token) {
      return res.status(401).json({
        message: "No token provided",
        code: "NO_TOKEN",
      });
    }

    // Verify the token
    const decoded = jwt.verify(
      token,
      config.jwtSecret || process.env.JWT_SECRET
    );

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        message: "Invalid token",
        code: "INVALID_TOKEN",
      });
    }

    // Check if organizer exists
    const organizer = await Organizer.findById(decoded.id).select("-password");

    if (!organizer) {
      return res.status(401).json({
        message: "Organizer not found or you don't have organizer privileges",
        code: "ORGANIZER_NOT_FOUND",
      });
    }

    // Attach organizer to request
    req.user = organizer;
    req.organizer = organizer;
    req.userType = "organizer";
    next();
  } catch (error) {
    console.error("Organizer auth middleware error:", error);

    // Provide more specific error messages
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        message: "Invalid token format",
        code: "INVALID_TOKEN_FORMAT",
        error: error.message,
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expired",
        code: "TOKEN_EXPIRED",
        error: error.message,
      });
    }

    return res.status(401).json({
      message: "Organizer authentication failed",
      code: "AUTH_FAILED",
      error: error.message,
    });
  }
};

// Add admin-specific middleware that only works for regular users
export const adminMiddleware = async (req, res, next) => {
  try {
    // First run regular auth middleware
    await new Promise((resolve, reject) => {
      authMiddleware(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Check if it's a regular user (not organizer) with admin role
    if (!req.user || req.user.role === "organizer") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    if (req.user.role !== "admin" && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Authorization error",
    });
  }
};

/**
 * Optional authentication middleware
 * This middleware will attempt to authenticate the user but won't error if no token
 * or invalid token is provided. Instead, it will set req.user to null and continue.
 */
export const optionalAuth = async (req, res, next) => {
  try {
    // Get token from header
    let token = req.headers.authorization;

    if (!token || !token.startsWith("Bearer ")) {
      // No token found, continue as unauthenticated
      req.user = null;
      req.organizer = null;
      return next();
    }

    // Extract token
    token = token.split(" ")[1];

    try {
      // Verify token
      const decoded = await promisify(jwt.verify)(
        token,
        config.jwtSecret || process.env.JWT_SECRET
      );

      // Check if user exists in our database
      const currentUser = await User.findById(decoded.id).select("-password");

      if (currentUser) {
        req.user = currentUser;
        req.organizer = null;
      } else {
        // Check if it's an organizer
        const currentOrganizer = await Organizer.findById(decoded.id);

        if (currentOrganizer) {
          req.organizer = currentOrganizer;
          req.user = null;
        } else {
          // User no longer exists
          req.user = null;
          req.organizer = null;
        }
      }
    } catch (err) {
      // Token verification failed, continue as unauthenticated
      req.user = null;
      req.organizer = null;
    }

    next();
  } catch (error) {
    // In case of other errors, continue as unauthenticated
    console.error("Optional auth error:", error);
    req.user = null;
    req.organizer = null;
    next();
  }
};

/**
 * Middleware to verify organizer authentication
 * Only allows authenticated organizers to proceed
 */
export const organizerAuthMiddleware = async (req, res, next) => {
  try {
    // Check for authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Unauthorized - No token provided" });
    }

    // Extract token
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized - Invalid token format" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.id) {
      return res.status(401).json({ message: "Unauthorized - Invalid token" });
    }

    // Find organizer
    const organizer = await Organizer.findById(decoded.id);

    if (!organizer) {
      return res
        .status(401)
        .json({ message: "Unauthorized - Organizer not found" });
    }

    // Set organizer in request object
    req.organizer = organizer;

    // Continue to the next middleware
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Unauthorized - Invalid token" });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Unauthorized - Token expired" });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
};

// Create a middleware that accepts either user or organizer
export const anyAuthMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const token = getTokenFromHeader(req);

    if (!token) {
      return res.status(401).json({
        message: "No token provided",
        code: "NO_TOKEN",
      });
    }

    // Verify the token
    const decoded = jwt.verify(
      token,
      config.jwtSecret || process.env.JWT_SECRET
    );

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        message: "Invalid token",
        code: "INVALID_TOKEN",
      });
    }

    // First try to find as a user
    let user = await User.findById(decoded.id).select("-password");
    let userType = "user";

    // If not found as user, try organizer
    if (!user) {
      user = await Organizer.findById(decoded.id).select("-password");
      userType = "organizer";
    }

    if (!user) {
      return res.status(401).json({
        message: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    // Attach user to request
    req.user = user;
    req.userType = userType;

    // For backward compatibility
    if (userType === "organizer") {
      req.organizer = user;
    }

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        message: "Invalid token format",
        code: "INVALID_TOKEN_FORMAT",
        error: error.message,
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expired",
        code: "TOKEN_EXPIRED",
        error: error.message,
      });
    }

    return res.status(401).json({
      message: "Authentication failed",
      code: "AUTH_FAILED",
      error: error.message,
    });
  }
};

// Add a combined middleware that can handle both user and admin authentication
export const userOrAdminMiddleware = async (req, res, next) => {
  try {
    // Get token from header first to validate format
    const token = getTokenFromHeader(req);

    // Check for missing or empty token
    if (!token || typeof token !== "string" || token.trim() === "") {
      return res.status(401).json({
        success: false,
        message: "Please log in to access this resource",
      });
    }

    // Verify token format and decode
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (error) {
      console.error("JWT verification error:", error);

      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Invalid token format",
        });
      }

      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expired",
        });
      }

      return res.status(401).json({
        success: false,
        message: "Authentication failed",
      });
    }

    // Check if decoded ID is valid
    if (!decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token format",
      });
    }

    // Find user first
    let user = await User.findById(decoded.id);
    if (user) {
      // Set user in request with proper role information
      req.user = {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.role === "admin",
      };

      // Allow both regular users and admins, but not organizers
      if (user.role === "user" || user.role === "admin") {
        return next();
      } else {
        return res.status(403).json({
          success: false,
          message: "Access denied. User or admin privileges required.",
        });
      }
    }

    // If not a regular user, check if it's an organizer (which we don't allow)
    let organizer = await Organizer.findById(decoded.id);
    if (organizer) {
      return res.status(403).json({
        success: false,
        message: "Access denied. User or admin privileges required.",
      });
    }

    // If no user or organizer found
    return res.status(401).json({
      success: false,
      message: "User not found",
    });
  } catch (error) {
    console.error("Authorization error:", error);
    return res.status(500).json({
      success: false,
      message: "Authorization error",
    });
  }
};

// Export all middleware functions
export default {
  authMiddleware,
  adminMiddleware,
  verifyOrganizerToken,
  anyAuthMiddleware,
  organizerAuthMiddleware,
  userOrAdminMiddleware,
  optionalAuth,
  getTokenFromHeader,
};
