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
        [FS] Initialize apartment_data.csv with provided sample data. (WindowDirections are comma-separated).
        [FS] Create an initial people.csv. Headers can be: Name,EncryptedData,AllowRoommates,AssignedRoom,RequiredPayment. The system will generate IDs internally and include an 'ID' column when saving this file.

    Cryptography Setup:
        [BE] Generate a persistent Elliptic Curve (EC) key pair (private/public) for the server. Store the private key securely.
        [BE] Create an endpoint to serve the public EC key (e.g., /api/public-key).
        [FE] Implement client-side JavaScript library for EC encryption (e.g., jose or Web Crypto API wrappers).
        [BE] Implement server-side EC decryption utility function using the private key.

    Identicon Generation:
        [FS] Choose and integrate an Identicon generation library (e.g., jdenticon for JS).

    CSV Handling Utilities:
        [BE] Implement robust CSV parsing functions for apartment_data.csv and people.csv.
        [BE] Implement CSV writing/appending functions for people.csv and updating apartment_data.csv.



Phase 1: Public-Facing Form Page (/)


    Page Structure & Styling:
        [FE] Create basic HTML structure for the main page.
        [FE] Apply basic CSS for layout and styling.

    Identicon Display:
        [FE] Fetch public EC key from /api/public-key on page load.
        [FE] Generate and display Identicon in the top right corner based on the fetched public key.

    Dynamic Apartment Count (Top):
        [BE] Create an API endpoint (e.g., /api/apartments/count) that takes filter criteria and returns the count of matching apartments from apartment_data.csv.
        [FE] Implement JavaScript to display "X available apartments match your current apartment specifications."
        [FE] Update this count dynamically as form fields change by calling the /api/apartments/count endpoint.

    Form Element Generation & Logic:
        [FS] General: For each characteristic, display "X apartments match this specification" next to it. This will require an API endpoint similar to /api/apartments/count but filterable by a single characteristic's current value.
        [FE] Name Input:
            [FE] Text input for "Name".
        [FE] Sq. Meters Slider:
            [FE] Range slider.
            [BE] Backend logic to determine min/max from apartment_data.csv (or provide these stats via an initial data load endpoint).
            [FE] Display current slider value.
        [FE] Number of Windows Slider:
            [FE] Range slider.
            [BE] Backend logic for min/max from apartment_data.csv.
            [FE] Display current slider value.
        [FE] Window Directions Checkboxes:
            [BE] Backend logic to get all unique directions from apartment_data.csv (e.g., "N", "S", "E", "W", "NE", etc. Values are comma-separated in the CSV).
            [FE] Generate checkboxes dynamically based on unique directions.
            [FE] Implement "at least 75% of selected directions must be present in the apartment's window directions" logic for filtering preview counts.
        [FE] Total Window Size Slider:
            [FE] Range slider.
            [BE] Backend logic for min/max from apartment_data.csv.
            [FE] Display current slider value.
        [FE] Number of Bedrooms Slider:
            [FE] Range slider.
            [BE] Backend logic for min/max from apartment_data.csv.
            [FE] Display current slider value.
        [FE] Number of Bathrooms Slider:
            [FE] Range slider.
            [BE] Backend logic for min/max from apartment_data.csv.
            [FE] Display current slider value.
        [FE] Amenity Checkboxes:
            [FE] Checkbox for "Includes Dishwasher".
            [FE] Checkbox for "Includes Washer".
            [FE] Checkbox for "Includes Dryer".
        [FE] Characteristic Worth Inputs:
            [FE] Next to each apartment characteristic field (Sq. Meters, Num Windows, Window Dirs, Total Window Size, Num Bedrooms, Num Bathrooms, Dishwasher, Washer, Dryer), add a number input for "Worth to me".
            [FE] Display helper text: "This amount will be deducted from your bid price for each apartment that doesn't meet this characteristic."
        [FE] Roommate Section:
            [FE] Checkbox "Allow roommates" (default checked).
            [FE] Conditional display logic: If "Allow roommates" is checked, show:
                [FE] Slider for "Maximum number of other roommates (besides yourself)" (Range 1-4).
                [FE] Interpersonal Factors Sliders (0-100):
                    [FE] "Cleanliness in common areas is highly important to me."
                    [FE] "A generally quiet home environment is important to me."
                    [FE] "I am comfortable with housemates having frequent guests and overnight visitors."
                    [FE] "Significant alone time and personal space at home are crucial for me."
                [FE] Sleep/Wake Time Range Inputs:
                    [FE] "I go to sleep around:" (Range input 8pm - 3am, step e.g., 30 mins). Format time nicely.
                    [FE] "I wake up around:" (Range input 4am - 1pm, step e.g., 30 mins). Format time nicely.
        [FE] Bid Input:
            [FE] Number input for "How much would you bid for your optimal location?".

    Form Submission:
        [BE] Create API endpoint for form submission (e.g., POST /api/submit-preferences).
        [FE] On submit:
            [FE] Gather all form data into a JavaScript object.
            [FE] Separate "Name" and "Allow roommates" (boolean) from the rest of the data.
            [FE] Convert the remaining data object to a JSON string.
            [FE] Encrypt the JSON string client-side using the fetched public EC key.
            [FE] Send "Name", "Allow roommates" (unencrypted), and the encrypted data string to the POST /api/submit-preferences endpoint.
        [BE] In POST /api/submit-preferences:
            [BE] Read people.csv.
            [BE] Check if "Name" already exists. If so, return an error (e.g., 409 Conflict).
            [BE] If name is unique, append a new row to people.csv (ensuring an ID column is present/added): ID, Name, EncryptedData, AllowRoommates value, empty AssignedRoom, empty RequiredPayment.
            [BE] Return success/failure message to the client.
        [FE] Display success/error message to the user. Clear form on success.



Phase 2: Admin Panel (/adminsecret)


    Basic Authentication:
        [BE] Implement a simple authentication mechanism for /adminsecret (e.g., basic auth, session-based with a login form, hardcoded token check – decide on simplicity vs. security).

    Admin Panel Frontend Structure:
        [FE] Create HTML structure for the admin panel (/adminsecret).
        [FE] Apply basic CSS for layout and styling.

    Live List of Names:
        [BE] Create an API endpoint (e.g., GET /api/admin/people-status) that reads people.csv and returns ID, Name, AssignedRoom (derived: true if AssignedRoom column is not empty), and AllowRoommates for each person.
        [FE] Fetch data from /api/admin/people-status on admin panel load.
        [FE] Display the list of names, assigned status, and if they allow roommates.
        [FE] Implement polling or WebSockets (if feeling ambitious) to keep this list "live".

    Decryption Ad-Hoc Logic:
        [BE] Ensure that for each admin action requiring decrypted data, the people.csv is read, encrypted data is decrypted in memory, processed, and then the decrypted data is discarded (not stored persistently decrypted).

    Button 1: "Run Matching + Bids"
        [BE] API Endpoint: Create POST /api/admin/run-matching.
        [BE] Decryption: Decrypt EncryptedData for all users from people.csv.
        [BE] Roommate Grouping Logic:
            [BE] Filter users who have "Allow Roommates" set to true.
            [BE] Develop a scoring/compatibility algorithm for interpersonal factors (Cleanliness, Quiet, Guests, Alone Time, Sleep/Wake). Define thresholds for a "good match."
            [BE] Develop logic to form potential roommate groups:
                Consider maximum group size (user's max_other_roommates + 1, up to 5 people total).
                Ensure all members in a potential group have compatible apartment characteristic preferences (sq_meters, windows, bedrooms, bathrooms, amenities).
                Ensure interpersonal factor compatibility within the group.
        [BE] Bidding & Auction Logic:
            [BE] Load apartment_data.csv (current state with Tenants).
            [BE] Define "demand" for an apartment (e.g., number of individuals/groups whose preferences (after characteristic worth deduction) match it and whose bid is > 0).
            [BE] Iterative Auction Process:
                [BE] Select apartment with the most demand that still has Tenants < Number of Bedrooms.
                [BE] Identify all individuals and valid potential groups (group size <= apartment's Number of Bedrooms) that want this apartment.
                [BE] For each individual/group, calculate their "effective bid" for this specific apartment: Initial Bid - SUM(Worth of missing characteristics for this apartment).
                [BE] Auction: Highest effective bid wins.
                [BE] Payment: Second highest effective bid (Vickrey auction style).
                [BE] If a group wins, divide payment among members based on their percentage of the group's total original offered bid (sum of individual initial bids before characteristic deductions for this apartment).
                [BE] Store winning person/group, their assigned apartment, and individual payments temporarily (this state is for display and for the "Assign Rooms" button).
                [BE] Remove assigned person(s) from the pool of bidders and any groups they were part of.
                [BE] Update the temporary Tenants count for the apartment.
                [BE] Repeat until no more apartments available or no more valid bids/matches.
        [BE] Output Generation: Prepare data for the chart: Apartment Name, Assigned People (Names), Individual Required Payment, Total Payment for Apartment, New Tenant Count.
        [FE] When POST /api/admin/run-matching is successful:
            [FE] Receive the chart data.
            [FE] Display the new chart on the admin panel.

    Button 2: "Assign Rooms"
        [BE] API Endpoint: Create POST /api/admin/assign-rooms. This endpoint will expect the assignment data generated by the "Run Matching + Bids" step (or re-run the matching logic if state isn't passed).
        [BE] Decryption (if needed again): Decrypt people.csv data.
        [BE] Update apartment_data.csv:
            [BE] For each assigned apartment, update Tenants with the number of assigned people.
            [BE] For each assigned apartment, update Allow Roommates. Logic: if all people in the assigned group had "Allow Roommates" checked AND Tenants < Number of Bedrooms, set to True. Otherwise False. Simpler: if Tenants == Number of Bedrooms, set apartment Allow Roommates to False. If Tenants < Number of Bedrooms, and the original people.csv entries for the assigned individuals all had Allow Roommates = True, then the apartment's Allow Roommates remains True. Otherwise, it becomes False.
        [BE] Update people.csv:
            [BE] For each assigned person, update their AssignedRoom column with the apartment name.
            [BE] For each assigned person, update their RequiredPayment column with their calculated payment amount.
        [BE] Return a "Data saved successfully" message.
        [FE] When POST /api/admin/assign-rooms is successful:
            [FE] Display "Data saved message".
            [FE] Refresh the "Live List of Names" and the displayed "Assignments Chart" (from previous run or by re-fetching state).

    Button 3: "Clear Assignments"
        [BE] API Endpoint: Create POST /api/admin/clear-assignments.
        [BE] Update people.csv:
            [BE] For every person, set AssignedRoom to empty/null.
            [BE] For every person, set RequiredPayment to empty/null or 0.
        [BE] Update apartment_data.csv:
            [BE] For every apartment, set Tenants to 0.
            [BE] For every apartment, set Allow Roommates to True.
        [BE] Return success message.
        [FE] When POST /api/admin/clear-assignments is successful:
            [FE] Display success message.
            [FE] Refresh the "Live List of Names" and clear/hide the "Assignments Chart".

    Persistent Display of Assignments:
        [BE] Create an API endpoint (e.g., GET /api/admin/current-assignments) that:
            [BE] Reads people.csv and apartment_data.csv.
            [BE] Constructs the assignment chart data (Apartment, Who is assigned, Payment, Tenant count) based on current CSV states.
        [FE] On admin panel load, fetch and display data from /api/admin/current-assignments and /api/admin/people-status.



Phase 3: Refinements, Testing & Deployment


    Error Handling & Validation:
        [FS] Implement comprehensive frontend validation for all form inputs.
        [FS] Implement robust backend validation for all API inputs.
        [FS] Graceful error handling for file I/O, decryption failures, etc.
        [FS] User-friendly error messages.

    UI/UX Polish:
        [UX/FE] Refine styling and user experience.
        [UX/FE] Ensure responsiveness.

    Testing:
        [FS] Unit tests for key backend logic (matching, bidding, CSV operations, crypto).
        [FS] Unit tests for key frontend logic (form validation, dynamic updates).
        [FS] End-to-end testing of user flows:
            User submission.
            Admin login.
            Run Matching -> Assign Rooms flow.
            Clear Assignments flow.
        [FS] Test edge cases (e.g., no matching apartments, no bids, duplicate names, decryption failures).

    Deployment:
        [FS] Choose a hosting platform.
        [FS] Set up deployment scripts/pipeline.
        [FS] Configure environment variables (especially for private key).

    Documentation:
        [FS] Basic README with setup and run instructions.
        [FS] Comments in code for complex logic.
