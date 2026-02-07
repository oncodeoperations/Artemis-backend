const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth, requireRole, requireVerification } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  updateUserBody,
  userIdParam,
  addSavedDeveloperBody,
  removeSavedDeveloperParam,
  usersQuery,
  browseTalentQuery,
} = require('../schemas/users');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management and saved developers
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users with optional filters
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: role
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated user list
 */
router.get('/', requireAuth, validate({ query: usersQuery }), userController.getAllUsers);

/**
 * @swagger
 * /api/users/dashboard-stats:
 *   get:
 *     summary: Get aggregated dashboard statistics for the current user
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Dashboard stats (contracts, assessments, recent activity)
 */
router.get('/dashboard-stats', requireAuth, userController.getDashboardStats);

/**
 * @swagger
 * /api/users/me/profile:
 *   get:
 *     summary: Get current user's full profile for settings
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: User profile with assessment stats
 */
router.get('/me/profile', requireAuth, userController.getMyProfile);

/**
 * @swagger
 * /api/users/talent:
 *   get:
 *     summary: Browse freelancer talent by profession, skills, and assessment scores
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: profession
 *         schema: { type: string }
 *         description: Filter by profession (e.g. "Software Engineering")
 *       - in: query
 *         name: skills
 *         schema: { type: string }
 *         description: Comma-separated skill filter
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Free-text search across name, profession, role, skills
 *       - in: query
 *         name: minScore
 *         schema: { type: integer }
 *         description: Minimum best assessment score (0-100)
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [score, recent, name] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated talent list with assessment scores
 */
router.get('/talent', requireAuth, requireRole('BusinessOwner'), validate({ query: browseTalentQuery }), userController.browseTalent);

/**
 * @swagger
 * /api/users/talent/{id}:
 *   get:
 *     summary: Get a freelancer's public talent profile with assessment history
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Talent profile with assessment results
 *       404:
 *         description: Freelancer not found
 */
router.get('/talent/:id', requireAuth, requireRole('BusinessOwner'), validate({ params: userIdParam }), userController.getTalentProfile);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 */
router.get('/:id', requireAuth, validate({ params: userIdParam }), userController.getUserById);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update user profile (self only)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               country: { type: string }
 *               companyName: { type: string }
 *               bio: { type: string }
 *               githubUsername: { type: string }
 *               profilePicture: { type: string, format: uri }
 *     responses:
 *       200:
 *         description: User updated
 *       400:
 *         description: Validation error
 */
router.put('/:id', requireAuth, requireVerification, validate({ params: userIdParam, body: updateUserBody }), userController.updateUser);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Deactivate user account (self only)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Account deactivated
 *       403:
 *         description: Not authorized
 */
router.delete('/:id', requireAuth, requireVerification, validate({ params: userIdParam }), userController.deleteUser);

/**
 * @swagger
 * /api/users/saved-developers:
 *   post:
 *     summary: Add developer to saved list (BusinessOwner only)
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username]
 *             properties:
 *               username: { type: string }
 *     responses:
 *       200:
 *         description: Developer saved
 *       400:
 *         description: Validation error
 */
router.post('/saved-developers', requireAuth, requireVerification, requireRole('BusinessOwner'), validate({ body: addSavedDeveloperBody }), userController.addSavedDeveloper);

/**
 * @swagger
 * /api/users/saved-developers/{username}:
 *   delete:
 *     summary: Remove developer from saved list (BusinessOwner only)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Developer removed
 */
router.delete('/saved-developers/:username', requireAuth, requireVerification, requireRole('BusinessOwner'), validate({ params: removeSavedDeveloperParam }), userController.removeSavedDeveloper);

module.exports = router;
