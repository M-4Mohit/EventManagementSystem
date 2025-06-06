import User from "../models/User.js";
import UserProfile from "../models/UserProfile.js";
import Registration from "../models/Registration.js";
import Event from "../models/Event.js";
import SavedEvent from "../models/SavedEvent.js";
import ApiResponse from "../utils/apiResponse.js";
import {
  syncUserEvents,
  calculateUserBadges,
} from "../services/userProfileService.js";

// Get user profile
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;

    // Get basic user data
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return ApiResponse.notFound(res, "User not found");
    }

    // Get profile data
    let profile = await UserProfile.findOne({ user: userId });

    // If profile doesn't exist, create one
    if (!profile) {
      profile = await createDefaultProfile(userId, user.name);
    }

    // Sync with registrations (background task)
    syncUserEvents(userId).catch((err) =>
      console.error("Background sync error:", err)
    );

    // Format join date
    const joinDate = new Date(profile.joinDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    });

    // Combine user and profile data
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      location: profile.location || "",
      bio: profile.bio || "",
      website: profile.website || "",
      phone: user.phone || profile.phone || "",
      joinDate,
      eventsAttended: profile.eventsAttended,
      upcomingEvents: profile.upcomingEvents,
      followers: profile.followers,
      following: profile.following,
      interests: profile.interests,
      preferences: profile.preferences,
      attendedEvents: profile.attendedEvents,
      upcomingEventsList: profile.upcomingEventsList,
      badges: profile.badges,
      savedEvents: profile.savedEvents,
      eventPhotos: profile.eventPhotos,
      notificationPreferences: profile.notificationPreferences,
    };

    return ApiResponse.success(
      res,
      "User profile retrieved successfully",
      userData
    );
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return ApiResponse.error(res, "Server error", 500);
  }
};

/**
 * Get a user profile by user ID
 * @route GET /api/v1/profiles/user/:userId
 * @access Public
 */
export const getUserProfileById = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "User ID is required",
      });
    }

    // Find the user profile by user ID
    const userProfile = await UserProfile.findOne({ user: userId }).populate(
      "user",
      "name email profilePicture"
    );

    // If no profile exists, try to get basic user details
    if (!userProfile) {
      console.log("No profile found, fetching basic user details");
      const User = mongoose.model("User");
      const user = await User.findById(userId).select(
        "name email profilePicture createdAt"
      );

      if (!user) {
        console.log("User not found");
        return res.status(404).json({
          status: "error",
          message: "User profile not found",
        });
      }

      // Get attended events count from registrations
      let attendedEventsCount = 0;
      try {
        attendedEventsCount = await Registration.countDocuments({
          user: userId,
          attendanceStatus: true,
        });
      } catch (err) {
        console.warn("Could not count attended events:", err);
      }

      // Return basic user information
      const basicProfile = {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          profilePicture: user.profilePicture || null,
        },
        bio: "",
        location: "",
        joinDate: user.createdAt || new Date(),
        // Default values for missing profile data
        interests: [],
        badges: [],
        eventsAttended: attendedEventsCount,
      };

      console.log("Returning basic profile:", basicProfile);
      return res.status(200).json({
        status: "success",
        data: basicProfile,
      });
    }

    // Return the full user profile
    console.log("Returning full profile");
    res.status(200).json({
      status: "success",
      data: userProfile,
    });
  } catch (error) {
    console.error("Error getting user profile by ID:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to get user profile",
      error: error.message,
    });
  }
};

// Update user profile
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;

    // Only allow users to update their own profile or admin users
    if (
      req.user._id.toString() !== userId.toString() &&
      req.user.role !== "admin"
    ) {
      return ApiResponse.forbidden(
        res,
        "Not authorized to update this profile"
      );
    }

    const updates = req.body;

    // Fields that can be updated in the User model
    const userUpdates = {};
    if (updates.name) userUpdates.name = updates.name;
    if (updates.phone) userUpdates.phone = updates.phone;

    // Update User model if there are changes
    if (Object.keys(userUpdates).length > 0) {
      await User.findByIdAndUpdate(userId, userUpdates);
    }

    // Find or create UserProfile
    let profile = await UserProfile.findOne({ user: userId });
    if (!profile) {
      const user = await User.findById(userId);
      profile = await createDefaultProfile(userId, user.name);
    }

    // Update fields in the UserProfile model
    const profileUpdates = {};

    // Handle simple field updates
    const profileFields = [
      "bio",
      "location",
      "website",
      "interests",
      "preferences",
    ];

    profileFields.forEach((field) => {
      if (updates[field] !== undefined) profileUpdates[field] = updates[field];
    });

    // Handle notification preferences
    if (updates.notificationPreferences) {
      profileUpdates.notificationPreferences = updates.notificationPreferences;
    }

    // Update the profile
    if (Object.keys(profileUpdates).length > 0) {
      profile = await UserProfile.findOneAndUpdate(
        { user: userId },
        { $set: profileUpdates },
        { new: true }
      );
    }

    return ApiResponse.success(res, "Profile updated successfully", profile);
  } catch (error) {
    console.error("Error updating user profile:", error);
    return ApiResponse.error(res, error.message, 500);
  }
};

// Get user events (attended, upcoming, saved)
export const getUserEvents = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    const eventType = req.query.type || "all"; // all, attended, upcoming, saved

    const profile = await UserProfile.findOne({ user: userId });
    if (!profile) {
      return ApiResponse.notFound(res, "User profile not found");
    }

    let events = [];

    switch (eventType) {
      case "attended":
        events = profile.attendedEvents || [];
        break;
      case "upcoming":
        events = profile.upcomingEventsList || [];
        break;
      case "saved":
        // Fetch saved events from the SavedEvent model
        const savedEventDocs = await SavedEvent.find({ user: userId }).populate(
          "event"
        );
        events = savedEventDocs.map((doc) => ({
          id: doc.event._id,
          name: doc.event.title,
          date: new Date(doc.event.startDate).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
          type: doc.event.category,
          image: doc.event.image || "/api/placeholder/80/80",
          location: doc.event.location?.address || "Online",
        }));
        break;
      default:
        // Return all events
        events = {
          attended: profile.attendedEvents || [],
          upcoming: profile.upcomingEventsList || [],
          saved: await getSavedEvents(userId),
        };
    }

    return ApiResponse.success(
      res,
      "User events retrieved successfully",
      events
    );
  } catch (error) {
    console.error("Error fetching user events:", error);
    return ApiResponse.error(res, error.message, 500);
  }
};

// Add or update user review for an event
export const addEventReview = async (req, res) => {
  try {
    const userId = req.user._id;
    const { eventId } = req.params;
    const { rating, review, photos } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return ApiResponse.badRequest(res, "Rating must be between 1 and 5");
    }

    // Verify the user has attended the event
    const registration = await Registration.findOne({
      user: userId,
      event: eventId,
      status: "attended",
    });

    if (!registration) {
      return ApiResponse.badRequest(
        res,
        "You must attend an event before reviewing it"
      );
    }

    // Get event details
    const event = await Event.findById(eventId);
    if (!event) {
      return ApiResponse.notFound(res, "Event not found");
    }

    // Find user profile
    let profile = await UserProfile.findOne({ user: userId });
    if (!profile) {
      const user = await User.findById(userId);
      profile = await createDefaultProfile(userId, user.name);
    }

    // Check if the user has already reviewed this event
    const existingReviewIndex = profile.attendedEvents.findIndex(
      (e) => e.eventId && e.eventId.toString() === eventId
    );

    if (existingReviewIndex >= 0) {
      // Update existing review
      profile.attendedEvents[existingReviewIndex].rating = rating;
      profile.attendedEvents[existingReviewIndex].review = review;
      if (photos && photos.length) {
        profile.attendedEvents[existingReviewIndex].photos = photos;
        // Update photo count
        profile.eventPhotos = (profile.eventPhotos || 0) + photos.length;
      }
    } else {
      // Add new review
      profile.attendedEvents.push({
        eventId,
        name: event.title,
        date: new Date(event.startDate).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
        type: event.category,
        image: event.image || "/api/placeholder/80/80",
        location: event.location?.address || "Online",
        rating,
        review,
        photos: photos || [],
      });

      // Update events attended count
      profile.eventsAttended = (profile.eventsAttended || 0) + 1;

      // Update photo count if photos provided
      if (photos && photos.length) {
        profile.eventPhotos = (profile.eventPhotos || 0) + photos.length;
      }
    }

    await profile.save();

    // Calculate badges after adding review (async background task)
    calculateUserBadges(userId).catch((err) =>
      console.error("Error calculating badges:", err)
    );

    return ApiResponse.success(
      res,
      "Review added successfully",
      profile.attendedEvents[
        existingReviewIndex >= 0
          ? existingReviewIndex
          : profile.attendedEvents.length - 1
      ]
    );
  } catch (error) {
    console.error("Error adding event review:", error);
    return ApiResponse.error(res, error.message, 500);
  }
};

// Update notification preferences
export const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    const { preferences } = req.body;

    if (!Array.isArray(preferences)) {
      return ApiResponse.badRequest(res, "Preferences must be an array");
    }

    let profile = await UserProfile.findOne({ user: userId });
    if (!profile) {
      const user = await User.findById(userId);
      profile = await createDefaultProfile(userId, user.name);
    }

    profile.notificationPreferences = preferences;
    await profile.save();

    return ApiResponse.success(
      res,
      "Notification preferences updated successfully",
      preferences
    );
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    return ApiResponse.error(res, error.message, 500);
  }
};

// Save an event
export const saveEvent = async (req, res) => {
  try {
    const userId = req.user._id;
    const { eventId } = req.params;

    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Check if already saved
    const existingSave = await SavedEvent.findOne({
      user: userId,
      event: eventId,
    });
    if (existingSave) {
      return res.status(200).json({
        success: true,
        message: "Event already saved",
        alreadySaved: true,
      });
    }

    // Save the event
    const savedEvent = new SavedEvent({
      user: userId,
      event: eventId,
    });

    await savedEvent.save();

    // Update profile saved events count
    let profile = await UserProfile.findOne({ user: userId });
    if (profile) {
      profile.savedEvents = (profile.savedEvents || 0) + 1;
      await profile.save();
    }

    return res.status(200).json({
      success: true,
      message: "Event saved successfully",
    });
  } catch (error) {
    console.error("Error saving event:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error saving event",
    });
  }
};

// Unsave an event
export const unsaveEvent = async (req, res) => {
  try {
    const userId = req.user._id;
    const { eventId } = req.params;

    // Remove the saved event
    const result = await SavedEvent.findOneAndDelete({
      user: userId,
      event: eventId,
    });

    if (!result) {
      return res.status(200).json({
        success: true,
        message: "Saved event not found or already removed",
      });
    }

    // Update profile saved events count
    let profile = await UserProfile.findOne({ user: userId });
    if (profile && profile.savedEvents > 0) {
      profile.savedEvents -= 1;
      await profile.save();
    }

    return res.status(200).json({
      success: true,
      message: "Event unsaved successfully",
    });
  } catch (error) {
    console.error("Error unsaving event:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error unsaving event",
    });
  }
};

// Update user badges (admin only)
export const updateUserBadges = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Only admins can update badges
    if (req.user.role !== "admin") {
      return ApiResponse.forbidden(res, "Not authorized to update badges");
    }

    const { badges } = req.body;

    if (!Array.isArray(badges)) {
      return ApiResponse.badRequest(res, "Badges must be an array");
    }

    let profile = await UserProfile.findOne({ user: userId });
    if (!profile) {
      const user = await User.findById(userId);
      if (!user) {
        return ApiResponse.notFound(res, "User not found");
      }
      profile = await createDefaultProfile(userId, user.name);
    }

    profile.badges = badges;
    await profile.save();

    return ApiResponse.success(res, "Badges updated successfully", badges);
  } catch (error) {
    console.error("Error updating user badges:", error);
    return ApiResponse.error(res, error.message, 500);
  }
};

// Create a user profile for the authenticated user
export const createUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if profile already exists
    const existingProfile = await UserProfile.findOne({ user: userId });

    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: "Profile already exists for this user",
        profile: existingProfile,
      });
    }

    // Create a new profile with request data
    const profileData = {
      user: userId,
      ...req.body,
      joinDate: new Date(),
    };

    // Set default notification preferences if not provided
    if (!profileData.notificationPreferences) {
      profileData.notificationPreferences = [
        {
          type: "event_reminder",
          name: "Event Reminders",
          enabled: true,
          description: "Get notified 24 hours before events",
        },
        {
          type: "new_event",
          name: "New Events",
          enabled: true,
          description: "Get notified when new events match your interests",
        },
        {
          type: "event_notification",
          name: "Friends' Activities",
          enabled: false,
          description: "Get notified when friends register for events",
        },
        {
          type: "admin_notification",
          name: "Promotions",
          enabled: true,
          description: "Get notified about discounts and special offers",
        },
      ];
    }

    const newProfile = new UserProfile(profileData);
    await newProfile.save();

    // Get user data to include in response
    const user = await User.findById(userId).select("-password");

    res.status(201).json({
      success: true,
      message: "User profile created successfully",
      profile: newProfile,
      user,
    });
  } catch (error) {
    console.error("Error creating profile:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Invalid profile data",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create user profile",
      error: error.message,
    });
  }
};

// Get user dashboard data
export const getUserDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get basic user data
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return ApiResponse.notFound(res, "User not found");
    }

    // Get profile data
    let profile = await UserProfile.findOne({ user: userId });

    // If profile doesn't exist, create one
    if (!profile) {
      profile = await createDefaultProfile(userId, user.name);
    }

    // Get upcoming events
    const registrations = await Registration.find({
      user: userId,
      status: { $ne: "cancelled" },
    })
      .populate("event")
      .sort({ "event.startDate": 1 })
      .limit(5);

    const upcomingEvents = registrations.map((reg) => ({
      id: reg.event._id,
      title: reg.event.title,
      date: new Date(reg.event.startDate).toLocaleDateString(),
      location: reg.event.location?.address || "Online",
      image: reg.event.image || "/api/placeholder/event.jpg",
    }));

    // Get recent notifications
    let notifications = [];
    try {
      const Notification = mongoose.model("Notification");
      notifications = await Notification.find({ recipient: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();
    } catch (err) {
      console.log(
        "Notification model not available or other error:",
        err.message
      );
      // Continue without notifications if model doesn't exist
    }

    // Prepare dashboard data
    const dashboardData = {
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture || null,
      },
      stats: {
        eventsAttended: profile.eventsAttended || 0,
        upcomingEvents: upcomingEvents.length,
        notifications: notifications.length,
        favoriteEvents:
          (await SavedEvent.countDocuments({ user: userId })) || 0,
      },
      recentEvents: upcomingEvents,
      upcomingEvents: upcomingEvents,
      notifications: notifications.map((n) => ({
        id: n._id,
        message: n.message,
        date: new Date(n.createdAt).toLocaleDateString(),
        read: n.read,
      })),
    };

    return ApiResponse.success(
      res,
      "Dashboard data retrieved successfully",
      dashboardData
    );
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return ApiResponse.error(res, "Failed to retrieve dashboard data", 500);
  }
};

// Get user's attended events
/**
 * Get user's attended events
 * @route GET /api/v1/profiles/user/:userId/attended-events
 * @access Public
 */
export const getUserAttendedEvents = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "User ID is required",
      });
    }

    console.log(`Fetching attended events for user ID: ${userId}`);

    // Find the user profile
    const userProfile = await UserProfile.findOne({ user: userId });

    if (!userProfile) {
      return res.status(404).json({
        status: "error",
        message: "User profile not found",
      });
    }

    // Get attended events from the profile
    const attendedEvents = userProfile.attendedEvents || [];

    // Return the attended events
    res.status(200).json({
      status: "success",
      data: attendedEvents,
      count: attendedEvents.length,
    });
  } catch (error) {
    console.error("Error getting user attended events:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to get attended events",
      error: error.message,
    });
  }
};

// Helper function to create default profile
const createDefaultProfile = async (userId, userName) => {
  const defaultPreferences = [
    {
      type: "event_reminder",
      name: "Event Reminders",
      enabled: true,
      description: "Get notified 24 hours before events",
    },
    {
      type: "new_event",
      name: "New Events",
      enabled: true,
      description: "Get notified when new events match your interests",
    },
    {
      type: "event_notification",
      name: "Friends' Activities",
      enabled: false,
      description: "Get notified when friends register for events",
    },
    {
      type: "admin_notification",
      name: "Promotions",
      enabled: true,
      description: "Get notified about discounts and special offers",
    },
  ];

  const profile = new UserProfile({
    user: userId,
    bio: "",
    location: "",
    joinDate: new Date(),
    eventsAttended: 0,
    upcomingEvents: 0,
    followers: 0,
    following: 0,
    interests: [],
    preferences: [],
    attendedEvents: [],
    upcomingEventsList: [],
    badges: [],
    savedEvents: 0,
    eventPhotos: 0,
    notificationPreferences: defaultPreferences,
  });

  return await profile.save();
};

// Helper function to get saved events
const getSavedEvents = async (userId) => {
  const savedEventDocs = await SavedEvent.find({ user: userId }).populate(
    "event"
  );
  return savedEventDocs.map((doc) => ({
    id: doc.event._id,
    name: doc.event.title,
    date: new Date(doc.event.startDate).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    type: doc.event.category,
    image: doc.event.image || "/api/placeholder/80/80",
    location: doc.event.location?.address || "Online",
  }));
};
