# APC UPS Monitoring System - Visual Design

## Design Philosophy

### Color Palette
**Primary Colors:**
- Deep Navy (#1a2332) - Primary background and headers
- Electric Blue (#00d4ff) - Active states, links, and data highlights
- Soft Gray (#f8fafc) - Secondary backgrounds and cards
- Charcoal (#374151) - Text and borders

**Status Colors:**
- Success Green (#10b981) - Online, healthy status
- Warning Amber (#f59e0b) - Alerts and warnings
- Critical Red (#ef4444) - Critical alerts and offline status
- Info Blue (#3b82f6) - Informational states

### Typography
**Primary Font:** Inter (Sans-serif)
- Clean, modern, highly readable
- Excellent for data-heavy interfaces
- Strong numerical clarity for metrics

**Display Font:** JetBrains Mono (Monospace)
- Technical data and IP addresses
- Console output and logs
- Code snippets and configurations

### Visual Language
**Design Principles:**
- **Clarity First**: Every element serves a functional purpose
- **Data-Driven**: Visual hierarchy emphasizes critical information
- **Professional Aesthetic**: Clean, technical, enterprise-grade appearance
- **Responsive Design**: Optimized for various screen sizes and devices

## Visual Effects

### Used Libraries
- **Anime.js**: Smooth micro-interactions and state transitions
- **ECharts.js**: Professional data visualization and real-time charts
- **Pixi.js**: Hardware-accelerated visual effects for dashboard elements
- **Splitting.js**: Advanced text animations for headers and alerts
- **Matter.js**: Physics-based animations for status indicators

### Animation Effects
**Micro-Interactions:**
- Button hover states with subtle scale and glow effects
- Card lift animations on hover with shadow depth
- Status indicator pulse animations for real-time updates
- Loading states with smooth progress indicators

**Data Visualizations:**
- Animated chart transitions when switching time ranges
- Smooth progress bar animations for battery levels
- Real-time data streaming with fade-in effects
- Interactive hover states revealing detailed metrics

### Header Effects
**Navigation Bar:**
- Subtle gradient background with frosted glass effect
- Smooth tab transitions with underline animations
- Real-time status indicator in header showing system health
- Breadcrumb animations for navigation depth

**Dashboard Grid:**
- Masonry-style layout with smooth card positioning
- Animated grid transitions when filtering devices
- Staggered loading animations for device cards
- Responsive reflow animations for different screen sizes

### Background Styling
**Main Background:**
- Subtle gradient from deep navy to slightly lighter navy
- Optional particle system for ambient movement
- Consistent across all pages for unified experience

**Card Backgrounds:**
- Semi-transparent white with subtle border
- Hover states with increased opacity and shadow
- Status-based border colors for visual categorization

### Interactive Elements
**Device Cards:**
- 3D tilt effect on hover using CSS transforms
- Color-coded status borders with smooth transitions
- Expandable details with slide-down animations
- Quick action buttons with icon morphing

**Charts and Graphs:**
- Interactive tooltips with smooth fade-in
- Zoom and pan capabilities for detailed analysis
- Animated data point highlighting on hover
- Smooth transitions between different data views

**Alert System:**
- Sliding alert notifications from top-right
- Color-coded severity with pulse animations
- Dismissible alerts with fade-out effects
- Stacked alert management with smooth positioning

### Responsive Design
**Breakpoints:**
- Desktop: 1200px+ (Full dashboard grid)
- Tablet: 768px-1199px (Condensed grid, collapsible sidebar)
- Mobile: <768px (Stacked layout, touch-optimized controls)

**Adaptive Elements:**
- Collapsible navigation for mobile
- Touch-friendly button sizes
- Optimized chart layouts for smaller screens
- Swipe gestures for mobile navigation

### Accessibility Features
**Visual Accessibility:**
- High contrast ratios (4.5:1 minimum)
- Color-blind friendly status indicators
- Clear focus states for keyboard navigation
- Screen reader compatible labels and descriptions

**Interaction Accessibility:**
- Keyboard navigation support
- Focus management for modal dialogs
- ARIA labels for complex interactive elements
- Reduced motion options for users with vestibular disorders

This design system creates a professional, modern interface that effectively communicates critical UPS monitoring information while providing an engaging and intuitive user experience.