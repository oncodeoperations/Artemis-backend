const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { paginationQuery } = require('../schemas/common');

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin-only user management and statistics
 */

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Get user statistics including verification status
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Aggregate statistics
 *       403:
 *         description: Admin role required
 */
router.get('/stats', requireAuth, requireRole('Admin'), adminController.getUserStats);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users with verification status (paginated)
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated user list with verification status
 */
router.get('/users', requireAuth, requireRole('Admin'), validate({ query: paginationQuery }), adminController.getAllUsersWithStatus);

/**
 * @swagger
 * /api/admin/users/unverified:
 *   get:
 *     summary: Get all unverified users
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated list of unverified users
 */
router.get('/users/unverified', requireAuth, requireRole('Admin'), validate({ query: paginationQuery }), adminController.getUnverifiedUsers);

/**
 * @swagger
 * /api/admin/users/verified:
 *   get:
 *     summary: Get all verified users
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated list of verified users
 */
router.get('/users/verified', requireAuth, requireRole('Admin'), validate({ query: paginationQuery }), adminController.getVerifiedUsers);

/**
 * @swagger
 * /api/admin/broadcast:
 *   post:
 *     summary: Send a system announcement to all users (or a filtered subset)
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, message]
 *             properties:
 *               title: { type: string, maxLength: 200 }
 *               message: { type: string, maxLength: 2000 }
 *               targetRole: { type: string, enum: [all, BusinessOwner, Freelancer] }
 *     responses:
 *       200:
 *         description: Broadcast sent successfully
 */
router.post('/broadcast', requireAuth, requireRole('Admin'), adminController.broadcastAnnouncement);

module.exports = router;
