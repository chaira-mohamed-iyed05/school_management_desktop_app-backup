Build a polished, clickable desktop admin-dashboard mockup for a small private school management application called “[SCHOOL NAME]”.

This is a UI/UX prototype for a future offline Electron desktop application. For this phase, create only the React frontend with realistic mock data. Do not create a backend, database, cloud authentication, API, Supabase integration, or Electron packaging.

## Technology

Use:

* React
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui
* Lucide React icons
* React Router
* Recharts
* React Hook Form
* Zod

Store all mock data in local TypeScript files.

## Main objective

Create a simple, professional school administration system for managing:

* Students
* Teachers
* Courses and groups
* Enrollments
* Attendance using student QR cards
* Payments and revenue
* Basic reports
* Local backup settings

The client wants a basic application, not a complex school ERP.

The interface must feel like a real Windows desktop business application rather than a marketing website.

## Application format

Design primarily for:

* 1440 × 900 desktop screens
* Minimum supported width: 1280 pixels
* Light mode only
* Fixed left sidebar
* Fixed or sticky top header
* Main scrollable content area

Do not create a mobile-first layout.

## Brand and logo

Use “[SCHOOL NAME]” as the wordmark.

Create an original inline SVG logo with the following concept:

* A simple rounded shield made from two abstract open-book pages
* A negative-space checkmark in the centre
* Three small square elements in the upper-right corner suggesting a QR code
* The symbol represents education, student verification, attendance and organisation
* Avoid graduation-cap clip art
* Avoid overly detailed book illustrations
* The mark must remain recognisable at 24 × 24 pixels

Logo palette:

* Primary navy: #0F172A
* Main blue: #2563EB
* Teal accent: #14B8A6
* Background: #F8FAFC
* White: #FFFFFF
* Warning amber: #F59E0B
* Error red: #DC2626
* Success green: #16A34A

Use the logo in:

* Login page
* Sidebar header
* Student-card preview
* Loading screen
* About section

Create both:

1. Full horizontal logo: icon plus “[SCHOOL NAME]”
2. Compact icon-only version for the collapsed sidebar

## Typography

Use Inter or Geist.

Typography rules:

* Page titles: 24–28px, semibold
* Section titles: 16–18px, semibold
* Body text: 14px
* Labels and metadata: 12–13px
* Use strong hierarchy and generous spacing
* Avoid oversized headings

## Overall visual style

Create a modern but practical administrative interface.

Use:

* White content cards
* Very light grey application background
* Subtle borders
* Small soft shadows
* 10–12px border radius
* Clear table rows
* Compact forms
* Professional charts
* Visible status badges
* Consistent spacing based on an 8px grid

Avoid:

* Excessive gradients
* Glassmorphism
* Neon colours
* Huge rounded cards
* Decorative illustrations
* Large empty areas
* Unnecessary animation
* Overly futuristic design

## Navigation

Create a left sidebar containing:

* Dashboard
* Students
* Teachers
* Courses & Groups
* Attendance
* Payments
* Reports
* Settings

At the bottom of the sidebar include:

* Current administrator
* Offline status indicator
* Logout action

Show a green dot with the text “Offline database available” to communicate the future local-first behaviour.

The sidebar should support expanded and collapsed states.

## Top header

The top header should include:

* Current page title
* Global search field
* Current date
* Notification icon
* Administrator avatar
* Profile dropdown

Global search should display mock results for students, teachers and courses.

## Page 1: Login

Create a clean desktop login page.

Include:

* Logo and school name
* “School Administration” subtitle
* Username field
* Password field
* Show/hide password button
* Remember session checkbox
* Sign-in button
* “Application works locally without internet” message
* Application version at the bottom

Use a split layout:

* Left side: understated branded panel with the logo and a short statement
* Right side: compact login form

Use a mock login. Any non-empty username and password should open the dashboard.

## Page 2: Dashboard

Create dashboard summary cards for:

* Active students
* Students present today
* Students absent today
* Revenue this month
* Outstanding payments

Include percentage changes where appropriate.

Add:

1. Attendance overview chart for the last seven days
2. Monthly revenue bar chart
3. Today’s classes
4. Recent attendance scans
5. Recent payments
6. Students with overdue payments
7. Quick-action buttons

Quick actions:

* Add student
* Start attendance
* Record payment
* Create course

The dashboard must be informative but not crowded.

## Page 3: Students

Create a professional student-management table.

Columns:

* Photo
* Student ID
* Full name
* Course/group
* Guardian phone
* Registration date
* Payment status
* Student status
* Actions

Features:

* Search
* Filter by group
* Filter by active/inactive
* Filter by payment status
* Sort columns
* Pagination
* Select rows
* Export button
* Add Student button
* Table and card-view toggle

Actions menu:

* View profile
* Edit
* Print card
* View attendance
* View payments
* Archive

Use at least 16 realistic mock students with Algerian-style names and phone-number formatting.

## Page 4: Add or edit student

Create a full student form divided into clear sections.

Personal information:

* Student number
* First name
* Last name
* Date of birth
* Gender
* Student photo
* Phone
* Address

Guardian information:

* Guardian name
* Relationship
* Guardian phone
* Secondary phone

Academic information:

* Course
* Group
* Registration date
* Agreed monthly fee
* Status

QR information:

* Automatically generated card token
* Regenerate token button
* Small QR preview
* Explanation that the QR contains only a secure identifier

Include:

* Validation messages
* Save button
* Save and print card button
* Cancel button
* Unsaved-changes warning

The form should work using local mock state.

## Page 5: Student profile

Create a student profile with:

* Photo
* Full name
* Student ID
* Active-status badge
* Course and group
* Contact details
* Guardian details
* Registration date
* QR-card status

Add tab navigation:

* Overview
* Attendance
* Payments
* Enrollments
* Notes

Include attendance statistics:

* Present
* Absent
* Late
* Attendance rate

Include payment information:

* Current monthly fee
* Total paid
* Outstanding balance
* Most recent payment

Provide buttons for:

* Edit
* Record payment
* Print student card
* Archive student

## Page 6: Student-card preview

Create a print-ready student identity card.

Front side:

* School logo
* School name
* Student photo
* Full name
* Student number
* Course/group
* QR code
* Academic year

Back side:

* Guardian phone
* School contact information
* Card instructions
* Expiration date
* Small school logo

Use standard card proportions resembling an ID card.

Include:

* Print button
* Download preview button
* Regenerate QR token
* Front/back toggle

The QR can be a visual placeholder generated from the student token.

## Page 7: Teachers

Create a teachers table containing:

* Photo
* Teacher name
* Phone
* Email
* Assigned courses
* Number of groups
* Status
* Actions

Features:

* Search
* Add teacher
* Edit teacher
* View assigned groups
* Activate/deactivate teacher

Create an add/edit teacher modal.

Do not build a complex payroll system.

## Page 8: Courses and groups

Display courses using cards or a clean table.

A course contains:

* Course name
* Description
* Default monthly price
* Number of groups
* Number of enrolled students
* Status

Each course can contain multiple groups.

A group contains:

* Group name
* Teacher
* Room
* Schedule
* Capacity
* Enrolled students
* Monthly fee
* Start and end dates

Create:

* Course list
* Course details
* Group list
* Add course modal
* Add group modal
* Capacity progress bar
* Weekly schedule view

Use examples such as:

* English A1
* English B1
* Mathematics Support
* Computer Basics
* French Communication

## Page 9: QR attendance scanner

This is one of the most important screens.

Create a focused attendance-check-in interface.

At the top, allow the administrator to select:

* Course
* Group
* Session date
* Session start time

Include a large central scanning area with:

* QR scanner icon
* “Scan the student card” message
* Input field that stays focused
* Token input for simulating a USB QR scanner
* “Simulate scan” button

Use example token:

STD-2026-00017

When Enter is pressed or the scan button is clicked:

* Search the local mock students
* Display a large success result when valid
* Display student photo and name
* Display scan time
* Add the attendance to the current list
* Show a green confirmation toast

Create other result states:

* Yellow: student already scanned
* Red: invalid or disabled card
* Orange: student not enrolled in this group

Include sound-toggle and fullscreen buttons.

On the right side, show:

* Present count
* Expected students
* Late count
* Current attendance percentage

Below, show the live attendance list with:

* Student
* Scan time
* Attendance status
* Manual correction action

Add buttons:

* Mark student manually
* End session
* Print attendance
* Export attendance

Make this page usable with a physical USB scanner that behaves like a keyboard in the future.

## Page 10: Attendance history

Create:

* Session history table
* Filters by date, course, group and teacher
* Present/absent/late statistics
* Attendance-rate chart
* Student attendance details
* Export action

Allow opening a session to see all attendance records.

## Page 11: Payments and revenue

Create summary cards:

* Revenue this month
* Payments collected today
* Outstanding amount
* Students with overdue payments

Create a payments table with:

* Receipt number
* Student
* Course/group
* Billing period
* Amount
* Payment method
* Payment date
* Received by
* Status
* Actions

Include:

* Search
* Date filter
* Group filter
* Paid/unpaid filter
* Record Payment button
* Print receipt button

Record Payment modal:

* Student
* Enrollment
* Billing month
* Amount
* Payment method
* Reference
* Notes
* Payment date

After saving, display a receipt preview.

Use only revenue and payments terminology. Do not call this a complete accounting system.

## Page 12: Reports

Create a simple reports page with:

* Student registration report
* Attendance report
* Revenue report
* Outstanding-payment report
* Course-enrollment report

Each report card should include:

* Short description
* Date-range selector
* Filter button
* Preview button
* Export CSV button
* Print button

Add one report preview containing a chart and a data table.

## Page 13: Settings and backups

Create settings sections for:

### School profile

* School name
* Logo
* Phone
* Email
* Address
* Academic year

### Application

* Language
* Date format
* Currency: Algerian dinar, DZD
* Attendance late threshold
* Receipt prefix
* Student-number prefix

### Backup and restore

* Last backup date
* Database location
* Create backup button
* Restore backup button
* Choose backup folder
* Automatic daily backup toggle
* Number of backups to retain
* Recent backups table

### Security

* Change administrator password
* Automatic lock timeout
* Audit-log access

Since this is a mockup, use simulated actions and confirmation dialogs.

## Components

Create reusable components for:

* Application sidebar
* Header
* Page container
* Stat card
* Data table
* Search and filters
* Status badge
* Confirmation dialog
* Empty state
* Loading skeleton
* Toast notification
* QR scan result
* Student avatar
* Payment receipt
* Student card
* Form field
* Date picker
* Course selector

## Interaction requirements

Make the mockup genuinely clickable.

The following must work:

* Sidebar navigation
* Login
* Search and filtering
* Opening profiles
* Add/edit forms
* Modals
* Dropdown menus
* Tabs
* QR-scan simulation
* Recording a mock payment
* Printing-preview dialogs
* Toast notifications
* Sidebar collapse
* Confirmation dialogs
* Pagination

Use React state and mock data. Changes can reset after refreshing the browser.

## Data

Create realistic mock data for:

* 16–20 students
* 5–7 teachers
* 5 courses
* 8 groups
* Several attendance sessions
* At least 25 payment records

Use consistent relations between students, groups, teachers, attendance and payments.

Do not use “John Doe” repeatedly.

## Quality requirements

* Use strict TypeScript types
* Avoid any TypeScript errors
* Avoid broken routes
* Avoid empty placeholder pages
* Avoid buttons that do nothing
* Keep components reasonably modular
* Use semantic HTML
* Include keyboard focus states
* Maintain sufficient text contrast
* Use tooltips for icon-only actions
* Use realistic empty, loading and error states

## Final result

Deliver a complete clickable frontend prototype that can be shown to the school client.

The prototype should communicate:

* Simplicity
* Reliability
* Local offline operation
* Fast student management
* Fast QR attendance
* Clear payment tracking

Do not add unrelated modules such as online learning, examinations, homework, parent portals, messaging, human resources, inventory or advanced payroll.


## for the logo name use Edupilot DZ
and the design  :
Two book pages
      +
Shield outline
      +
Central checkmark
      +
Three subtle QR squares