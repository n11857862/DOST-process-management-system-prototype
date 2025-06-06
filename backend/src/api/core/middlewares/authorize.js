const authorize = (roles = []) => {
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ message: 'User not authenticated or role missing.' });
        }

        if (roles.length && !roles.includes(req.user.role)) {
            return res.status(403).json({ 
                message: `Forbidden: User role '${req.user.role}' is not authorized to access this resource.` 
            });
        }

        next();
    };
};

module.exports = authorize;