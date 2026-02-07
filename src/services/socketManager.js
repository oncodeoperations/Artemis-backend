const { Server } = require('socket.io');
const { clerkClient } = require('@clerk/clerk-sdk-node');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Socket.io Manager
 * Initializes the Socket.io server, handles authentication,
 * maps users to rooms, and wires up the notification service.
 */

let io = null;

/**
 * Initialize Socket.io on the given HTTP server
 * @param {http.Server} httpServer - The Node.js HTTP server instance
 * @returns {Server} Socket.io server instance
 */
function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: config.allowedOrigins,
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware — verify Clerk token on connection
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      // Verify Clerk session token
      const sessionClaims = await clerkClient.verifyToken(token);
      const clerkUserId = sessionClaims.sub;

      // Look up MongoDB user
      const user = await User.findOne({ clerkId: clerkUserId }).lean();

      if (!user || !user.isActive) {
        return next(new Error('User not found or inactive'));
      }

      // Attach user to socket
      socket.userId = user._id.toString();
      socket.userRole = user.role;
      socket.userName = `${user.firstName} ${user.lastName}`;

      next();
    } catch (error) {
      logger.error('Socket authentication failed', { error: error.message });
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    const { userId, userName } = socket;

    // Join user's personal room (room name = MongoDB _id)
    socket.join(userId);
    logger.info(`Socket connected: ${userName} (${userId}) — socket ${socket.id}`);

    // ── Client events ──────────────────────────

    // Client requests their unread count (e.g. on reconnect)
    socket.on('notification:getUnreadCount', async (callback) => {
      try {
        const count = await notificationService.getUnreadCount(userId);
        if (typeof callback === 'function') callback({ count });
      } catch (error) {
        logger.error('Error getting unread count', error);
        if (typeof callback === 'function') callback({ count: 0 });
      }
    });

    // Client marks a notification as read
    socket.on('notification:markRead', async ({ notificationId }, callback) => {
      try {
        await notificationService.markAsRead(notificationId, userId);
        if (typeof callback === 'function') callback({ success: true });
      } catch (error) {
        logger.error('Error marking notification read', error);
        if (typeof callback === 'function') callback({ success: false });
      }
    });

    // Client marks all notifications as read
    socket.on('notification:markAllRead', async (callback) => {
      try {
        const count = await notificationService.markAllAsRead(userId);
        if (typeof callback === 'function') callback({ success: true, count });
      } catch (error) {
        logger.error('Error marking all read', error);
        if (typeof callback === 'function') callback({ success: false });
      }
    });

    // Disconnect
    socket.on('disconnect', (reason) => {
      logger.debug(`Socket disconnected: ${userName} (${userId}) — ${reason}`);
    });
  });

  // Give the notification service the io instance
  notificationService.setIO(io);

  logger.info('Socket.io initialized');
  return io;
}

/**
 * Get the current io instance (for use in other modules if needed)
 */
function getIO() {
  return io;
}

module.exports = { initializeSocket, getIO };
