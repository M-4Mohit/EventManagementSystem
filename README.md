## 🎉 Event Management System

A comprehensive event management platform built with modern web technologies to streamline event creation, management, and attendance tracking.

![Event Management System](https://via.placeholder.com/1200x600?text=Event+Management+System+Screenshot)

## 🌟 Features

- **User Authentication**: Secure login/signup for users and organizers
- **Event Management**: Create, edit, and manage events with rich details
- **Attendance Tracking**: Monitor event participation and engagement
- **Admin Dashboard**: Comprehensive system administration tools
- **Organizer Tools**: Specialized features for event organizers
- **Responsive UI**: Beautiful interface built with Tailwind CSS
- **Real-time Updates**: Dynamic content loading and updates

## 🚀 Technologies

**Frontend:**
- React.js with Vite
- Tailwind CSS
- Redux for state management
- React Router for navigation
- Axios for API calls

**Backend:**
- Node.js with Express
- MongoDB (with Mongoose ODM)
- Redis for caching
- Cloudinary for media storage
- JWT for authentication

## 📂 Directory Structure

```
📦 EventManagementSystem
├── 📂 client
│   ├── 📂 public
│   └── 📂 src
│       ├── 📂 api
│       ├── 📂 assets
│       │   ├── 📂 cursor
│       │   ├── 📂 freelance
│       │   ├── 📂 loginSignUp
│       │   └── 📂 team
│       ├── 📂 components
│       │   ├── 📂 Admin
│       │   ├── 📂 Attendance
│       │   ├── 📂 Events
│       │   │   └── 📂 CreateEvent
│       │   ├── 📂 Footer
│       │   ├── 📂 Header
│       │   ├── 📂 Home
│       │   ├── 📂 UI
│       │   └── 📂 User
│       │       └── 📂 Dashboard
│       ├── 📂 config
│       ├── 📂 context
│       ├── 📂 debug
│       ├── 📂 hooks
│       ├── 📂 layout
│       ├── 📂 pages
│       │   ├── 📂 Admin
│       │   ├── 📂 Auth
│       │   ├── 📂 common
│       │   ├── 📂 Events
│       │   ├── 📂 Home
│       │   ├── 📂 Organizer
│       │   └── 📂 User
│       ├── 📂 redux
│       │   └── 📂 user
│       ├── 📂 routes
│       ├── 📂 services
│       └── 📂 utils
└── 📂 server
    ├── 📂 public
    │   ├── 📂 keep
    │   └── 📂 uploads
    │       └── 📂 temp
    └── 📂 src
        ├── 📂 config
        ├── 📂 controllers
        ├── 📂 middlewares
        ├── 📂 models
        ├── 📂 routes
        ├── 📂 services
        └── 📂 utils
```

## 🛠️ Setup & Installation

### Prerequisites
- Node.js (v16 or higher)
- MongoDB
- Redis (optional for caching)
- Cloudinary account (for media storage)

### Client Setup
```bash
cd client
npm install
npm run dev
```

### Server Setup
```bash
cd server
npm install
npm start
```

## 🌐 Environment Variables

Create `.env` files in both `client` and `server` directories with appropriate values:

**Client:**
```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_preset
```

**Server:**
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/eventmgmt
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=90d
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request



## ✨ Acknowledgments

- Inspiration
- etc.

---

Made with ❤️ by [Mohit](https://github.com/M-4Mohit)
