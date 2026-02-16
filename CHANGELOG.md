# Changelog

All notable changes to VRSleep will be documented in this file.

## [1.1.0] - 2026-02-16

### Added
- Comprehensive error logging system with file output
- View logs feature accessible from user dropdown menu
- Automatic log rotation (5MB or 10,000 lines)
- User dropdown menu with logout and view log options

### Changed
- Centralized configuration management
- Improved memory management with automatic cleanup
- Enhanced security validations across all API calls
- Optimized settings caching with 1-second TTL

### Fixed
- Memory leaks in sleep mode tracking
- Error handling throughout the application
- Input validation in preload security layer

### Security
- Added comprehensive input sanitization
- Enhanced authentication token handling
- Improved file validation for updates
- Rate limiting with exponential backoff

---

[Full commit history](https://github.com/itsjesski/VRSleep/commits/main)

## [1.0.0] - Previous Release

Initial stable release of VRSleep.
