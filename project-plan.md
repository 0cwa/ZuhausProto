Here's an implementation plan structured as a Markdown checklist. This plan assumes a standard web stack (e.g., Node.js/Express or Python/Flask for the backend, and HTML/CSS/JavaScript for the frontend).

Legend for Team Members (Example - Assign as needed):


    [FE] - Frontend Developer

    [BE] - Backend Developer

    [FS] - Full-Stack Developer

    [UX] - UX/UI Designer (if applicable, for style refinement)



Project: Apartment Matching & Bidding System - Implementation Plan

Phase 0: Setup & Core Infrastructure


    Project Initialization:
        [FS] Set up project repository (e.g., Git).
        [FS] Choose backend framework (e.g., Node.js/Express, Python/Flask).
        [FS] Set up basic project structure (folders for frontend, backend, assets, data).
        [FS] Initialize apartment_data.csv with provided sample data. (WindowDirections are semicolon-separated).
        [FS] Create an initial people.csv. Headers: ID,Name,EncryptedData,AllowRoommates,AssignedRoom,RequiredPayment. This file is intended for encrypted preference data.
        [FS] Create an initial peoplec.csv (cleartext preferences). Headers: ID,Name,AllowRoommates,AssignedRoom,RequiredPayment,Preferences (JSON string). For debugging, computations and admin display will use peoplec.csv.

    Cryptography Setup:
        [BE] Generate a persistent Elliptic Curve (EC) key pair (private/public) for the server. Store the private key securely (e.g., in keys/.private_key.pem and keys/.public_key.pem).
        [BE] Create an endpoint to serve the public EC key (e.g., /api/public-key). (Currently bypassed for debugging).
        [FE] Implement client-side JavaScript library for EC encryption (e.g., Web Crypto API wrappers). (Currently bypassed, uses base64 encoding for debugging).
        [BE] Implement server-side EC decryption utility function using the private key. (Currently bypassed, expects base64 encoded JSON for debugging).

    Identicon Generation:
        [FS] Choose and integrate an Identicon generation library.

    CSV Handling Utilities:
        [BE] Implement robust CSV parsing functions for apartment_data.csv, people.csv, and peoplec.csv.
        [BE] Implement CSV writing/appending functions for these files.



Phase 1: Public-Facing Form Page (/)


    Page Structure & Styling:
        [FE] Create basic HTML structure for the main page.
        [FE] Apply basic CSS for layout and styling.

    Identicon Display:
        [FE] Fetch public EC key from /api/public-key on page load (or use dummy for debugging).
        [FE] Generate and display Identicon in the top right corner.

    Dynamic Apartment Count (Top):
        [BE] Create an API endpoint (e.g., /api/apartments/count) that takes filter criteria and returns the count of matching apartments from apartment_data.csv.
        [FE] Implement JavaScript to display "X available apartments match your current apartment specifications."
        [FE] Update this count dynamically as form fields change.

    Form Element Generation & Logic:
        [FS] General: For each characteristic, display "X apartments match this specification" next to it.
        [FE] Name Input: Text input for "Name".
        [FE] Sq. Meters Slider: Range slider.
        [FE] Number of Windows Slider: Range slider.
        [FE] Window Directions Checkboxes:
            [BE] Backend logic to get all unique directions from apartment_data.csv.
            [FE] Generate checkboxes dynamically.
            [FE] Implement "at least one selected direction must be present" (OR logic) for filtering preview counts.
        [FE] Total Window Size Slider: Range slider.
        [FE] Number of Bedrooms Slider: Range slider.
        [FE] Number of Bathrooms Slider: Range slider (step 0.5).
        [FE] Amenity Checkboxes: Dishwasher, Washer, Dryer.
        [FE] Characteristic Worth Inputs: For each apartment characteristic.
        [FE] Roommate Section:
            [FE] Checkbox "Allow roommates".
            [FE] Conditional display for: Max other roommates, Interpersonal Factors Sliders, Sleep/Wake Time Range Sliders.
        [FE] Bid Input: Number input for bid amount.

    Form Submission:
        [BE] Create API endpoint for form submission (e.g., POST /api/submit-preferences).
        [FE] On submit:
            [FE] Gather form data.
            [FE] Separate "Name" and "Allow roommates".
            [FE] Convert preferences to JSON string.
            [FE] "Encrypt" (base64 encode for debugging) the JSON string.
            [FE] Send "Name", "Allow roommates", and "encrypted" data.
        [BE] In POST /api/submit-preferences:
            [BE] Read peoplec.csv to check for duplicate names. Return 409 if duplicate.
            [BE] If unique, generate ID.
            [BE] Save to people.csv: ID, Name, Base64(PreferencesJSON), AllowRoommates, etc.
            [BE] Save to peoplec.csv: ID, Name, AllowRoommates, etc., Preferences (as JSON string).
            [BE] Return success/failure message.
        [FE] Display success/error message (handle 409 for duplicates specifically). Clear form on success.



Phase 2: Admin Panel (/adminsecret)


    Basic Authentication:
        [BE] Implement simple authentication for /adminsecret.

    Admin Panel Frontend Structure:
        [FE] Create HTML structure and apply styling.

    Live List of Names:
        [BE] Create API endpoint (e.g., GET /api/admin/people-status) that reads peoplec.csv and returns ID, Name, AssignedRoom, AllowRoommates.
        [FE] Fetch and display this list. Implement refresh.

    Decryption Ad-Hoc Logic:
        [BE] For debugging, "decryption" means parsing the JSON string of preferences from the 'encryptedData' field (which itself was populated from peoplec.csv).

    Button 1: "Run Matching + Bids"
        [BE] API Endpoint: POST /api/admin/run-matching.
        [BE] "Decryption": Load people data (from peoplec.csv for debugging, parse preferences JSON).
        [BE] Roommate Grouping Logic: Based on preferences.
        [BE] Bidding & Auction Logic: Based on preferences and apartment data.
        [BE] Output Generation: Prepare chart data.
        [FE] Display chart data on success.

    Button 2: "Assign Rooms"
        [BE] API Endpoint: POST /api/admin/assign-rooms.
        [BE] Update apartment_data.csv: Tenants, AllowRoommates.
        [BE] Update peoplec.csv: AssignedRoom, RequiredPayment.
        [BE] Update people.csv: (for consistency, though not primary source for matching in debug mode) AssignedRoom, RequiredPayment.
        [BE] Return success message.
        [FE] Display success message and refresh data.

    Button 3: "Clear Assignments" (Not yet implemented, future task)
        [BE] API Endpoint: POST /api/admin/clear-assignments.
        [BE] Update people.csv and peoplec.csv: Clear AssignedRoom, RequiredPayment.
        [BE] Update apartment_data.csv: Reset Tenants, AllowRoommates.
        [FE] Refresh UI.

    Persistent Display of Assignments:
        [BE] Create GET /api/admin/current-assignments (or use existing matching results logic).
        [FE] Fetch and display on admin panel load.



Phase 3: Refinements, Testing & Deployment


    Error Handling & Validation:
        [FS] Comprehensive frontend and backend validation.
        [FS] Graceful error handling.

    UI/UX Polish:
        [UX/FE] Refine styling, responsiveness.

    Testing:
        [FS] Unit and end-to-end tests.

    Deployment:
        [FS] Choose platform, setup CI/CD.

    Documentation:
        [FS] README, code comments.

    Future: Re-enable Full Encryption
        [FS] Transition from peoplec.csv back to using people.csv with actual encryption/decryption.
        [BE] Re-enable /api/public-key.
        [FE] Use real client-side encryption.
        [BE] Use real server-side decryption.
