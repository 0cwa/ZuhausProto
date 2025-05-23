To make this runnable, you'd need:

Input Files:
Place apartment_data.csv (as provided) in the same directory.
Create a people_data.csv file with the format you described. I've added a small dummy file creation logic if people_data.csv is missing, so you can see it run. You'll need to replace this dummy file with your actual, larger dataset. The column names in your example are ID,Name,AllowRoommates,AssignedRoom,RequiredPayment,Preferences. My dummy data and Person class constructor use these names.

Install pandas: If you don't have it, pip install pandas numpy.

Run: Execute python apartment_matcher.py from your terminal in that directory.

Key Implementation Details and Adaptations:


Social Compatibility: The calculate_social_compatibility uses normalized social preference vectors and Euclidean distance. A more negative distance (closer to 0) means better compatibility, so -dist is used as a score.

Group Generation (Step 1):
generate_potential_groups: For each unassigned person (p_anchor), it tries to form groups of size 1 up to their max_roommates + 1.
Roommates are chosen by their social compatibility with p_anchor.
It uses a set of sorted person IDs to ensure unique groups are considered.

Apartment Focus (Step 2):
The apartment chosen for assignment in each round is the one that could potentially receive the highest winning bid from any valid group. This addresses "focus on the apartment which matches most with aggregate demand."

Bid Calculation (Step 3):
calculate_adjusted_bid: Deducts Worth if an apartment feature is outside the person's preferred range (for ranged preferences) or if a boolean desired feature is missing.

Payment Calculation (Step 4):
Implemented as described: (Next Highest Group Bid / Winning Group Bid) * Person's Adjusted Bid in Winning Group.

Recalculation (Step 5):
The main while loop and the fact that generate_potential_groups only considers unassigned_people inherently handle the recalculation after each assignment.

Output (Step 6):
Prints a summary to the console and saves detailed assignments to bidding_assignments.csv.

This program structure should implement the logic you've described. Remember that the quality of matches will heavily depend on the Worth values people assign and how well the social compatibility metric captures true preferences. You might need to fine-tune the social compatibility function or the bid adjustment logic based on observed results.