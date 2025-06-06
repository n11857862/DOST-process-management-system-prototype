import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const RegisterPage = () => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff');
  const [touched, setTouched] = useState({
    name: false,
    username: false,
    email: false,
    password: false
  });

  const { register, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    setTouched({
      name: true,
      username: true,
      email: true,
      password: true
    });

    if (!name || !username || !password) {
      return;
    }
    if (email && !/\S+@\S+\.\S+/.test(email)) {
        return;
    }

    const userData = { name, username, password, role };
    if (email) {
        userData.email = email;
    }

    const result = await register(userData);

    if (result.success) {
      setName('');
      setUsername('');
      setEmail('');
      setPassword('');
      setTouched({
        name: false,
        username: false,
        email: false,
        password: false
      });
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    }
  };

  const getFieldError = (field, value) => {
    if (!touched[field]) return '';
    
    switch (field) {
      case 'name':
        return !value ? 'Name is required' : '';
      case 'username':
        return !value ? 'Username is required' : '';
      case 'email':
        return value && !/\S+@\S+\.\S+/.test(value) ? 'Invalid email format' : '';
      case 'password':
        return !value ? 'Password is required' : 
               value.length < 6 ? 'Password should be at least 6 characters' : '';
      default:
        return '';
    }
  };

  const handleBlur = (field) => {
    setTouched({ ...touched, [field]: true });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .splash-animate {
            animation: fadeIn 0.7s ease-out forwards;
          }
        `}
      </style>
      <div className="w-full max-w-md p-8 space-y-6 bg-white shadow-xl rounded-lg border border-gray-200">
        <div className="text-center mb-6 splash-animate">
          <h1 className="text-3xl font-bold text-gray-800">Join Us!</h1>
          <p className="mt-2 text-sm text-gray-600">Create an account to get started with our platform.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="text-sm font-medium text-gray-700 flex items-center justify-between">
              Name
              {touched.name && !name && <span className="text-red-500 text-xs">Required</span>}
            </label>
            <input 
              id="name" 
              type="text" 
              required 
              className={`mt-1 block w-full px-3 py-2 border ${getFieldError('name', name) ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 transition-colors`} 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              onBlur={() => handleBlur('name')}
              disabled={isLoading} 
              placeholder="Your full name"
            />
            {getFieldError('name', name) && <p className="mt-1 text-xs text-red-500">{getFieldError('name', name)}</p>}
          </div>
          
          <div>
            <label htmlFor="username" className="text-sm font-medium text-gray-700 flex items-center justify-between">
              Username
              {touched.username && !username && <span className="text-red-500 text-xs">Required</span>}
            </label>
            <input 
              id="username" 
              type="text" 
              required 
              className={`mt-1 block w-full px-3 py-2 border ${getFieldError('username', username) ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 transition-colors`} 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              onBlur={() => handleBlur('username')}
              disabled={isLoading} 
              placeholder="Choose a unique username"
            />
            {getFieldError('username', username) && <p className="mt-1 text-xs text-red-500">{getFieldError('username', username)}</p>}
          </div>
          
          <div>
            <label htmlFor="email" className="text-sm font-medium text-gray-700 flex items-center justify-between">
              Email <span className="text-gray-400 text-xs">(Optional)</span>
              {touched.email && email && getFieldError('email', email) && <span className="text-red-500 text-xs">Invalid format</span>}
            </label>
            <input 
              id="email" 
              type="email" 
              className={`mt-1 block w-full px-3 py-2 border ${getFieldError('email', email) ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 transition-colors`} 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              onBlur={() => handleBlur('email')}
              disabled={isLoading}
              placeholder="your.email@example.com"
            />
            {getFieldError('email', email) && <p className="mt-1 text-xs text-red-500">{getFieldError('email', email)}</p>}
          </div>
          
          <div>
            <label htmlFor="password" className="text-sm font-medium text-gray-700 flex items-center justify-between">
              Password
              {touched.password && !password && <span className="text-red-500 text-xs">Required</span>}
            </label>
            <input 
              id="password" 
              type="password" 
              required 
              className={`mt-1 block w-full px-3 py-2 border ${getFieldError('password', password) ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 transition-colors`} 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              onBlur={() => handleBlur('password')}
              disabled={isLoading}
              placeholder="Create a secure password"
            />
            {getFieldError('password', password) && <p className="mt-1 text-xs text-red-500">{getFieldError('password', password)}</p>}
            <p className="mt-1 text-xs text-gray-500">Password should be at least 6 characters long</p>
          </div>
          
<div>
  <label htmlFor="role" className="text-sm font-medium text-gray-700">Role</label>
  <div className="relative">
    <select 
      id="role" 
      value={role} 
      onChange={(e) => setRole(e.target.value)} 
      disabled={isLoading} 
      className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 appearance-none cursor-pointer text-gray-800"
      style={{ 
        backgroundColor: "white",
        "-moz-appearance": "none",
        "text-indent": "0.01px",
        "text-overflow": ""
      }}
    >
      <option value="staff" style={{backgroundColor: "white", color: "black"}}>Staff</option>
      <option value="manager" style={{backgroundColor: "white", color: "black"}}>Manager</option>
      <option value="admin" style={{backgroundColor: "white", color: "black"}}>Admin</option>
    </select>
    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
      <svg className="h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    </div>
  </div>
  <p className="mt-1 text-xs text-gray-500">Select your role in the organization</p>
</div>

          <div className="pt-2">
            <button 
              type="submit" 
              disabled={isLoading} 
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Registering...
                </span>
              ) : 'Create Account'}
            </button>
          </div>
        </form>
        
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="px-2 bg-white text-gray-500">or</span>
          </div>
        </div>
        
        <p className="text-sm text-center text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;