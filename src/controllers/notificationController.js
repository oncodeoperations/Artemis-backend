const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Get notifications for the current user
 * GET /api/notifications?page=1&limit=20&unreadOnly=false
 */
const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const unreadOnly = req.query.unreadOnly === 'true';

    const result = await notificationService.getForUser(userId, { page, limit, unreadOnly });

    res.status(200).json(result);
  } catch (error) {
    logger.error('Get notifications error', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch notifications',
      message: 'An error occurred while retrieving notifications.',
    });
  }
};

/**
 * Get unread notification count
 * GET /api/notifications/unread-count
 */
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const count = await notificationService.getUnreadCount(userId);

    res.status(200).json({ count });
  } catch (error) {
    logger.error('Get unread count error', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch unread count',
      message: 'An error occurred while retrieving unread count.',
    });
  }
};

/**
 * Mark a single notification as read
 * PATCH /api/notifications/:id/read
 */
const markAsRead = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { id } = req.params;

    const notification = await notificationService.markAsRead(id, userId);

    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found',
        message: 'The notification does not exist or does not belong to you.',
      });
    }

    res.status(200).json({ message: 'Notification marked as read', notification });
  } catch (error) {
    logger.error('Mark as read error', { error: error.message });
    res.status(500).json({
      error: 'Failed to mark notification as read',
      message: 'An error occurred.',
    });
  }
};

/**
 * Mark all notifications as read
 * PATCH /api/notifications/read-all
 */
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const count = await notificationService.markAllAsRead(userId);

    res.status(200).json({ message: `${count} notifications marked as read`, count });
  } catch (error) {
    logger.error('Mark all read error', { error: error.message });
    res.status(500).json({
      error: 'Failed to mark all notifications as read',
      message: 'An error occurred.',
    });
  }
};

/**
 * Delete a notification
 * DELETE /api/notifications/:id
 */
const deleteNotification = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { id } = req.params;

    const notification = await notificationService.deleteNotification(id, userId);

    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found',
        message: 'The notification does not exist or does not belong to you.',
      });
    }

    res.status(200).json({ message: 'Notification deleted' });
  } catch (error) {
    logger.error('Delete notification error', { error: error.message });
    res.status(500).json({
      error: 'Failed to delete notification',
      message: 'An error occurred.',
    });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
