const cors = require("cors");
const express = require("express");
const path = require("path");
const app = express();

const workflowRoutes = require('./api/v1/workflows/workflow.routes.js');
const authRoutes = require('./api/v1/auth/auth.routes.js');
const taskRoutes = require('./api/v1/tasks/task.routes.js');
const workflowInstanceRoutes = require('./api/v1/instances/workflowInstance.routes.js');
const fileRoutes = require('./api/v1/files/file.routes.js');
const issueRoutes = require('./api/v1/issues/issue.routes.js'); 
const apiConfigRoutes = require('./api/v1/api-configs/apiConnectionConfig.routes.js');
const userRoutes = require('./api/v1/users/user.routes');
const dashboardRoutes = require('./api/v1/dashboard/dashboard.routes');


const errorHandler = require('./api/core/middlewares/errorHandler.js');

app.use(cors());
app.use(express.json());

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/workflows', workflowRoutes);
app.use('/api/v1/instances', workflowInstanceRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/files', fileRoutes);
app.use('/api/v1/issues', issueRoutes);
app.use('/api/v1/admin/api-configs', apiConfigRoutes);
app.use('/api/v1/api-configs', apiConfigRoutes);
app.use('/api/v1', userRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);


app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP' });
});

app.use(errorHandler);

module.exports = app;