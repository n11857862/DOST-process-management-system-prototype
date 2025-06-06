const jwt = require('jsonwebtoken');
const {User} = require('../../v1/users/user.model.js');

const authenticate = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            req.user = await User.findById(decoded.user.id).select('-password');

            if (!req.user) {
                return res.status(401).json({ message: 'Not authorized, user not found for this token.' });
            }

            if (!req.user.isActive) {
                return res.status(403).json({ message: 'User account is deactivated.' });
            }

            next();
        } catch (error) {
            console.error('Authentication error:', error.message);
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ message: 'Not authorized, token failed (invalid signature or malformed).' });
            }
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Not authorized, token expired.' });
            }
            return res.status(401).json({ message: 'Not authorized, token validation failed.' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token provided.' });
    }
};

module.exports = authenticate;