/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loginOrganizer, checkProfileCompletion } from '../../redux/user/organizer';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaGoogle, FaTwitter } from 'react-icons/fa';
import { fixPersistenceIssues } from '../../utils/persistFix';

const OrgLogin = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  // Get auth state from Redux
  const { loading, error, token } = useSelector(state => state.organizer);
  const { token: userToken } = useSelector(state => state.auth);

  // Check for redirection after login
  const redirectTo = location.state?.from || '/organizer/dashboard';

  useEffect(() => {
    // Fix persistence issues
    fixPersistenceIssues();

    // If already logged in, redirect
    if (token) {
      toast.info("You're already logged in as an organizer");
      navigate(redirectTo);
    } else if (userToken) {
      toast.info("You're already logged in as a user");
      navigate('/dashboard');
    }
  }, [token, userToken, navigate, redirectTo]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Quick validation
    if (!formData.email || !formData.password) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const resultAction = await dispatch(loginOrganizer(formData));

      // Check if login was successful
      if (loginOrganizer.fulfilled.match(resultAction)) {
        const loginData = resultAction.payload;

        // Extract organizer ID with better handling
        const getOrganizerIdFromLogin = (userData) => {
          if (!userData) return null;

          // Handle different response structures
          if (userData._id) return userData._id;
          if (userData.id) return userData.id;
          if (userData.user?._id) return userData.user._id;
          if (userData.user?.id) return userData.user.id;
          if (userData._doc?._id) return userData._doc._id;

          return null;
        };

        const organizerId = getOrganizerIdFromLogin(loginData);

        if (organizerId) {
          // Check if profile is complete with a small delay to ensure state is updated
          setTimeout(async () => {
            try {
              const profileCheck = await dispatch(checkProfileCompletion(organizerId));

              if (checkProfileCompletion.fulfilled.match(profileCheck)) {
                const isProfileComplete = profileCheck.payload.isComplete;

                if (isProfileComplete) {
                  toast.success('Welcome back, organizer!');
                  navigate('/organizer/dashboard');
                } else {
                  toast.success('Welcome! Please complete your profile to continue.');
                  navigate('/organizer/details');
                }
              } else {
                // If profile check fails, redirect to details form as safe fallback
                toast.success('Welcome! Please complete your profile setup.');
                navigate('/organizer/details');
              }
            } catch (error) {
              console.error('Profile check error:', error);
              toast.success('Welcome! Please complete your profile setup.');
              navigate('/organizer/details');
            }
          }, 500);
        } else {
          // Fallback: redirect to profile setup
          toast.success('Welcome! Please complete your profile setup.');
          navigate('/organizer/details');
        }
      } else if (loginOrganizer.rejected.match(resultAction)) {
        const error = resultAction.payload;

        // Handle verification-specific errors
        if (error.includes("pending approval") || error.includes("verification")) {
          toast.error("Your account is pending approval. Please wait for admin verification.");
        } else {
          toast.error(error || 'Login failed');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      toast.error('An unexpected error occurred. Please try again.');
    }
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h1 className="text-3xl font-extrabold text-white">Organizer Login</h1>
          <p className="mt-2 text-gray-400">Sign in to manage your events</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-gray-900 rounded-xl shadow-xl overflow-hidden"
        >
          {error && (
            <div className="bg-red-500/10 border-l-4 border-red-500 p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="p-8">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-400">
                  Email Address
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaEnvelope className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-700 rounded-md bg-gray-800 placeholder-gray-500 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 focus:z-10 sm:text-sm"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-400">
                  Password
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaLock className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="appearance-none block w-full pl-10 pr-10 py-2 border border-gray-700 rounded-md bg-gray-800 placeholder-gray-500 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 focus:z-10 sm:text-sm"
                    placeholder="••••••••"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className="text-gray-500 hover:text-gray-400 focus:outline-none"
                    >
                      {showPassword ? (
                        <FaEyeSlash className="h-5 w-5" />
                      ) : (
                        <FaEye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember_me"
                    name="remember_me"
                    type="checkbox"
                    className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-600 rounded bg-gray-800"
                  />
                  <label htmlFor="remember_me" className="ml-2 block text-sm text-gray-400">
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <Link to="/auth/forgot-password" className="font-medium text-cyan-400 hover:text-cyan-300">
                    Forgot your password?
                  </Link>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className={`group relative w-full flex justify-center py-2 px-4 border border-transparent rounded-md text-black font-medium cursor-pointer ${loading
                    ? "bg-cyan-700 cursor-not-allowed"
                    : "bg-cyan-600 hover:bg-black hover:border hover:border-cyan-500 hover:text-cyan-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
                    }`}
                >
                  {loading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    "Sign in as Organizer"
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-900 text-gray-400">Or continue with</span>
                </div>
              </div>

              <div className="mt-6">
                <Link
                  to="/auth/login"
                  className="w-full flex justify-center py-2 px-4 border border-cyan-700 rounded-md shadow-sm text-sm font-medium text-cyan-400 bg-gray-800 hover:bg-gray-700"
                >
                  Sign in as a regular user
                </Link>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="text-center mt-4">
          <p className="text-gray-400">
            Don't have an organizer account?{" "}
            <Link to="/auth/organizer-register" className="font-medium text-cyan-400 hover:text-cyan-300">
              Register as organizer
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrgLogin;