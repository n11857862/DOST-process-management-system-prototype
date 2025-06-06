import React, { useState } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import {
  Home,
  Settings,
  Waypoints,
  Users,
  Menu,
  X,
  LogOut,
  ShieldCheck,
  Loader2,
  ListOrdered,
  Database,
  AlertCircle as IssueIcon,
  ListChecks as MyWorkflowsIcon,
  CheckSquare as MyTasksIcon,
} from 'lucide-react';

import CreateWorkflowPage from './features/Workflows/CreateWorkflowPage.jsx';
import { DashboardPage } from './features/Dashboard/DashboardPage.jsx';
import { RolesPage } from './features/Admin/RolesPage.jsx';
import SettingsPage from './features/Settings/SettingsPage.jsx';
import { AdminDataManagementPage } from './features/Admin/AdminDataManagementPage.jsx';
import { IssueManagementPage } from './features/Admin/IssueManagementPage.jsx';
import { MyInstancesPage } from './features/MyWorkflows/MyInstancesPage';
import { MyTasksPage } from './features/Tasks/MyTasksPage';
import InstanceDetailsPage from './features/Admin/Instances/InstanceDetailsPage.jsx';
import AdminInstancesListPage from './features/Admin/Instances/AdminInstancesListPage.jsx';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import dostLogo from './assets/dost-logo.png';
import LoginPage from './features/Auth/LoginPage.jsx';
import RegisterPage from './features/Auth/RegisterPage.jsx';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


const cn = (...classes) => classes.filter(Boolean).join(' ');

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const { isAuthenticated, user, logout, isLoading: isAuthLoading } = useAuth();


  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
        <div className="bg-white p-8 rounded-xl shadow-2xl flex items-center animate-fade-in">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
          <p className="ml-4 text-xl font-medium text-gray-700">Authenticating...</p>
        </div>
      </div>
    );
  }

  const allNavItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Home, roles: ['staff', 'manager', 'admin'] },
    { path: '/my-tasks', label: 'My Tasks', icon: MyTasksIcon, roles: ['staff', 'manager', 'admin'] },
    { 
      path: '/my-workflows', 
      label: (user) => user?.role === 'staff' ? 'My Workflow Tasks' : 'My Workflows', 
      icon: MyWorkflowsIcon, 
      roles: ['staff', 'manager'] 
    },
    { path: '/designer', label: 'Workflow Designer', icon: Waypoints, roles: ['manager', 'admin'] },
    { path: '/admin/instances', label: 'All Instances', icon: ListOrdered, roles: ['admin'] },
    { path: '/admin/issues', label: 'Issue Reports', icon: IssueIcon, roles: ['manager', 'admin'] },
    { path: '/admin/roles', label: 'User Management', icon: ShieldCheck, roles: ['admin'] },
    { path: '/admin/data', label: 'Data Management', icon: Database, roles: ['admin'] },
    { path: '/settings', label: 'Settings', icon: Settings, roles: ['staff', 'manager', 'admin'] },
  ];

  const protectedNavItems = isAuthenticated && user ? allNavItems.filter((item) => item.roles.includes(user.role)) : [];

  const handleLogout = () => logout();


  const AppLogo = ({ size = 'normal' }) => {
    const dimensions = size === 'small' ? 'h-8 w-8' : 'h-10 w-10';
    return <img src={dostLogo} alt="DOST Logo" className={cn(dimensions, 'object-contain select-none')} />;
  };

  const AppTitle = ({ showLogo = true, logoSize = 'normal' }) => (
    <div className="flex items-center gap-3">
      {showLogo && <AppLogo size={logoSize} />}
      <div className="leading-tight">
        <span className="block font-semibold text-lg">DOST Process</span>
        <span className="block text-xs text-gray-600">Management System</span>
      </div>
    </div>
  );

  return (
    <>
      <ToastContainer 
        position="top-right" 
        autoClose={3000}
        hideProgressBar={false} 
        newestOnTop={false} 
        closeOnClick 
        rtl={false} 
        pauseOnFocusLoss 
        draggable 
        pauseOnHover 
        theme="colored"
      />
      
      <div className="flex h-screen bg-gradient-to-br from-indigo-50 to-blue-100 font-inter selection:bg-indigo-200">

        {isAuthenticated && user && (
          <aside
            className={cn(
              'bg-gradient-to-b from-gray-900 to-indigo-900 text-gray-100 flex flex-col drop-shadow-xl transition-all duration-300 ease-in-out flex-shrink-0',
              isSidebarOpen ? 'w-64' : 'w-20'
            )}
          >

            <div className="flex items-center justify-between h-20 border-b border-gray-700/50 px-5 flex-shrink-0">
                              {!isSidebarOpen ? (
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-1 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md"
                  title="Open Sidebar"
                  aria-label="Open Sidebar"
                >
                  <AppLogo size="small" />
                </button>
                              ) : (
                <>
                  <AppTitle />
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md"
                    title="Close Sidebar"
                    aria-label="Close Sidebar"
                  >
                    <X size={20} />
                  </button>
                </>
              )}
            </div>

            
            {isSidebarOpen && (
              <div className="px-5 py-4 border-b border-gray-700/50 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="truncate">
                  <div className="font-medium leading-tight truncate" title={user.name || 'User'}>
                    {user.name || 'User'}
                  </div>
                  <div className="text-xs text-gray-400 truncate" title={user.email || ''}>
                    {user.email || ''}
                  </div>
                </div>
              </div>
            )}

            
            <nav className="flex-grow overflow-y-auto mt-4 px-3 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
              <ul className="space-y-1">
                {protectedNavItems.map((item) => {
                  const isActive =
                    location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                  
                  const itemLabel = typeof item.label === 'function' ? item.label(user) : item.label;

                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        title={itemLabel}
                        aria-label={itemLabel}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex items-center rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer',
                          isSidebarOpen ? 'px-4 py-3' : 'p-3 justify-center',
                          isActive
                            ? 'bg-indigo-700/70 text-white shadow-md'
                            : 'text-gray-300 hover:bg-indigo-800/40 hover:text-white'
                        )}
                      >
                        <item.icon
                          size={20}
                          className={cn('flex-shrink-0 transition-colors duration-200', isSidebarOpen && 'mr-3',
                            isActive ? 'text-indigo-200' : 'text-gray-400')}
                        />
                        {isSidebarOpen && <span className="truncate">{itemLabel}</span>}
                        {isActive && isSidebarOpen && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 ml-auto" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              
              <div className="mt-8 mb-4 border-t border-gray-700/30 pt-4">
                <button
                  onClick={handleLogout}
                  title="Logout"
                  aria-label="Logout"
                  className={cn(
                    'w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 text-gray-300 hover:bg-red-900/20 hover:text-white',
                    isSidebarOpen ? 'px-4 py-3' : 'p-3 justify-center'
                  )}
                >
                  <LogOut size={20} className={cn('flex-shrink-0 text-gray-400', isSidebarOpen && 'mr-3')} />
                  {isSidebarOpen && <span>Logout</span>}
                </button>
              </div>
            </nav>
          </aside>
        )}

        <main className="flex-1 flex flex-col overflow-hidden">
          {isAuthenticated && (
            <header className="bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-gray-200 h-20 flex items-center px-6 flex-shrink-0 shadow-sm sticky top-0 z-20">
              {!isSidebarOpen && (
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="mr-4 text-gray-500 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md"
                  title="Open Sidebar"
                  aria-label="Open Sidebar"
                >
                  <Menu size={24} />
                </button>
              )}

              <h1 className="text-xl font-semibold text-gray-800 truncate">
                {(() => {
                  const currentItem = protectedNavItems.find((item) =>
                    location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))
                  );
                  if (currentItem) {
                    return typeof currentItem.label === 'function' ? currentItem.label(user) : currentItem.label;
                  }
                  return 'Dashboard';
                })()}
              </h1>

              <div className="ml-auto flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 truncate max-w-xs" title={user?.name || 'User'}>
                  {user?.name || 'User'}
                </span>
              </div>
            </header>
          )}

          <div className="flex-1 overflow-y-auto p-6 animate-fade-in-fast">
            <Routes>
              <Route
                path="/login"
                element={
                  <div className="flex min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
                    <div className="m-auto w-full max-w-md">
                      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
                        <div className="px-6 py-8">
                          <div className="flex justify-center mb-6">
                            <AppLogo />
                          </div>
                          <h2 className="text-2xl font-bold text-center text-gray-800 mb-8 tracking-tight">
                            DOST Process Management System
                          </h2>
                          {isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
                        </div>
                      </div>
                    </div>
                  </div>
                }
              />
              <Route
                path="/register"
                element={
                  <div className="flex min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
                    <div className="m-auto w-full max-w-md">
                      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
                        <div className="px-6 py-8">
                          <div className="flex justify-center mb-6">
                            <AppLogo />
                          </div>
                          <h2 className="text-2xl font-bold text-center text-gray-800 mb-8 tracking-tight">
                            DOST Process Management System
                          </h2>
                          {isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />}
                        </div>
                      </div>
                    </div>
                  </div>
                }
              />

              <Route path="/dashboard" element={<ProtectedRoute roles={['staff', 'manager', 'admin']}><DashboardPage /></ProtectedRoute>} />
              <Route path="/my-tasks" element={<ProtectedRoute roles={['staff', 'manager', 'admin']}><MyTasksPage /></ProtectedRoute>} />
              <Route path="/my-workflows" element={<ProtectedRoute roles={['staff', 'manager']}><MyInstancesPage /></ProtectedRoute>} />
              <Route path="/my-workflows/:instanceId" element={<ProtectedRoute roles={['staff', 'manager', 'admin']}><InstanceDetailsPage /></ProtectedRoute>} />
              <Route path="/admin/data" element={<ProtectedRoute roles={['admin']}><AdminDataManagementPage /></ProtectedRoute>} />
              <Route path="/admin/instances" element={<ProtectedRoute roles={['admin']}><AdminInstancesListPage /></ProtectedRoute>} />
              <Route path="/admin/instances/:instanceId" element={<ProtectedRoute roles={['admin']}><InstanceDetailsPage /></ProtectedRoute>} />
              <Route path="/admin/issues" element={<ProtectedRoute roles={['manager', 'admin']}><IssueManagementPage /></ProtectedRoute>} />
              <Route path="/designer" element={<ProtectedRoute roles={['manager', 'admin']}><CreateWorkflowPage /></ProtectedRoute>} />
              <Route path="/designer/:workflowId" element={<ProtectedRoute roles={['manager', 'admin']}><CreateWorkflowPage /></ProtectedRoute>} />
              <Route path="/admin/roles" element={<ProtectedRoute roles={['admin']}><RolesPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute roles={['staff', 'manager', 'admin']}><SettingsPage /></ProtectedRoute>} />

              <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
              
              <Route
                path="*"
                element={
                  <div className="flex flex-col items-center justify-center h-full animate-fade-in-fast text-center">
                    <span className="text-7xl font-extrabold text-indigo-200 mb-4 select-none">404</span>
                    <h2 className="text-2xl font-semibold text-gray-700 mb-2">Page Not Found</h2>
                    <p className="text-gray-500 mb-6 max-w-md">The page you are looking for doesn't exist or has been moved.</p>
                    <Link
                      to="/"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <Home size={18} />
                      Return to Dashboard
                    </Link>
                  </div>
                }
              />
            </Routes>
          </div>
        </main>
      </div>
    </>
  );
}

export default App;