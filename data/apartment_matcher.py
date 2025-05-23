import pandas as pd
import json
import numpy as np
from collections import defaultdict

# --- Configuration ---
PERSON_PREFERENCES_FILE = 'peoplec.csv' # Placeholder for your input file name
APARTMENT_DATA_FILE = 'apartment_data.csv'
OUTPUT_FILE = 'bidding_assignments.csv'

# Social preference keys and their normalization factor (max value for 0-1 scaling)
SOCIAL_PREF_KEYS_ soziale_NORM = {
    "cleanliness": 100.0,
    "quietness": 100.0,
    "guests": 100.0,
    "personalSpace": 100.0,
    "sleepTime_mid": 1440.0, # Midpoint of sleepTime range
    "wakeTime_mid": 1440.0   # Midpoint of wakeTime range
}

# --- Helper Functions & Classes ---

class Person:
    def __init__(self, data_row):
        self.id = data_row['ID']
        self.name = data_row['Name']
        self.allow_roommates_pref = data_row['AllowRoommates'] # Person's general pref
        try:
            self.preferences = json.loads(data_row['Preferences'])
        except json.JSONDecodeError:
            print(f"Error decoding JSON for person ID {self.id}")
            self.preferences = {}

        self.max_roommates = self.preferences.get('maxRoommates', 0)
        self.base_bid_amount = self.preferences.get('bidAmount', 0)
        self.social_vector = self._calculate_social_vector()
        self.is_assigned = False

    def _calculate_social_vector(self):
        vector = []
        prefs = self.preferences

        # Handle time preferences by taking midpoints
        sleep_time_range = prefs.get('sleepTime', [0, 0])
        wake_time_range = prefs.get('wakeTime', [0, 0])
        prefs['sleepTime_mid'] = (sleep_time_range[0] + sleep_time_range[1]) / 2.0
        prefs['wakeTime_mid'] = (wake_time_range[0] + wake_time_range[1]) / 2.0

        for key, norm_factor in SOCIAL_PREF_KEYS_ soziale_NORM.items():
            value = prefs.get(key, 0) # Default to 0 if missing
            vector.append(float(value) / norm_factor if norm_factor != 0 else float(value))
        return np.array(vector)

    def __repr__(self):
        return f"<Person ID: {self.id}, Name: {self.name}>"

class Apartment:
    def __init__(self, data_row, apt_id):
        self.apt_id = apt_id
        self.name = data_row['Name of Apartment']
        self.sq_meters = float(data_row['Sq. Meters'])
        self.num_windows = int(data_row['Number of Windows'])
        self.window_directions = set(data_row['Window Directions'].split(';')) if pd.notna(data_row['Window Directions']) else set()
        self.total_window_size = float(data_row['Total Window Size (sq. meters)'])
        self.num_bedrooms = int(data_row['Number of Bedrooms'])
        self.num_bathrooms = float(data_row['Number of Bathrooms']) # Can be 1.5
        self.has_dishwasher = str(data_row['Includes Dishwasher']).lower() == 'true'
        self.has_washer = str(data_row['Includes Washer']).lower() == 'true'
        self.has_dryer = str(data_row['Includes Dryer']).lower() == 'true'
        self.allow_roommates = str(data_row['Allow Roommates']).lower() == 'true'
        # Store all features for easy access if needed
        self.all_features = data_row.to_dict()


    def __repr__(self):
        return f"<Apartment ID: {self.apt_id}, Name: {self.name}, Bedrooms: {self.num_bedrooms}>"


def load_people_data(filepath):
    df = pd.read_csv(filepath)
    # Ensure 'Preferences' is string type before json.loads
    df['Preferences'] = df['Preferences'].astype(str)
    return [Person(row) for _, row in df.iterrows()]

def load_apartment_data(filepath):
    df = pd.read_csv(filepath)
    return [Apartment(row, i) for i, row in df.iterrows()]

def calculate_social_compatibility(person1, person2):
    """ Calculates social compatibility. Higher score is better. """
    # Euclidean distance on normalized social vectors
    dist = np.linalg.norm(person1.social_vector - person2.social_vector)
    # Convert distance to similarity: 1 / (1 + dist) or exp(-dist)
    # For simplicity, let's use negative distance (higher is better)
    return -dist 

def generate_potential_groups(unassigned_people):
    """
    Generates potential groups based on individual preferences.
    For each person P, forms groups (P), (P, R1), (P, R1, R2)...
    where R_i are best social matches for P.
    Returns a list of unique groups, where each group is a list of Person objects.
    """
    potential_groups_set = set() # To store tuples of sorted person IDs

    for p_anchor in unassigned_people:
        # Group of 1 (person themselves)
        group_ids_tuple = tuple(sorted([p_anchor.id]))
        potential_groups_set.add(group_ids_tuple)

        # Groups with roommates
        # Candidates for roommates (must not be p_anchor and must be unassigned)
        roommate_candidates = [p for p in unassigned_people if p.id != p_anchor.id]

        for num_roommates in range(1, p_anchor.max_roommates + 1):
            if num_roommates > len(roommate_candidates):
                continue # Not enough candidates

            # Score candidates based on compatibility with p_anchor
            scored_candidates = []
            for candidate in roommate_candidates:
                # Check if candidate also allows roommates or is fine with this group size
                # This check could be more sophisticated (mutual max_roommates agreement)
                if candidate.max_roommates >= num_roommates: # Candidate should be willing to be in a group of this size
                    score = calculate_social_compatibility(p_anchor, candidate)
                    scored_candidates.append((score, candidate))

            # Sort by score (descending)
            scored_candidates.sort(key=lambda x: x[0], reverse=True)

            if len(scored_candidates) >= num_roommates:
                chosen_roommates = [sc[1] for sc in scored_candidates[:num_roommates]]
                current_group_members = [p_anchor] + chosen_roommates
                group_ids_tuple = tuple(sorted([p.id for p in current_group_members]))
                potential_groups_set.add(group_ids_tuple)

    # Convert set of ID tuples back to list of groups of Person objects
    final_groups = []
    person_map = {p.id: p for p in unassigned_people}
    for id_tuple in potential_groups_set:
        group = [person_map[pid] for pid in id_tuple if pid in person_map]
        if len(group) == len(id_tuple): # Ensure all persons were found
             final_groups.append(group)
    return final_groups


def calculate_adjusted_bid(person, apartment, group_size):
    base_bid = person.base_bid_amount
    deduction = 0
    prefs = person.preferences

    # Sq. Meters
    # Effective sqMeters per person: apartment.sq_meters / group_size
    # But person's preference 'sqMeters' is for the whole unit they might be part of,
    # or their share. The example implies it's for their ideal *unit* size.
    # Let's assume "sqMeters" in preference is for the whole unit.
    pref_sqm_range = prefs.get("sqMeters", [0, float('inf')])
    if not (pref_sqm_range[0] <= apartment.sq_meters <= pref_sqm_range[1]):
        deduction += prefs.get("sqMetersWorth", 0)

    # Number of Windows (assume total for unit)
    pref_windows_range = prefs.get("numWindows", [0, float('inf')])
    if not (pref_windows_range[0] <= apartment.num_windows <= pref_windows_range[1]):
        deduction += prefs.get("numWindowsWorth", 0)

    # Window Directions
    pref_wdirs = set(prefs.get("windowDirections", []))
    if pref_wdirs and not pref_wdirs.intersection(apartment.window_directions):
        deduction += prefs.get("windowDirectionsWorth", 0)

    # Total Window Size
    pref_twin_size_range = prefs.get("totalWindowSize", [0, float('inf')])
    if not (pref_twin_size_range[0] <= apartment.total_window_size <= pref_twin_size_range[1]):
        deduction += prefs.get("totalWindowSizeWorth", 0)

    # Number of Bedrooms (unit) - A person might want a unit of a certain size
    pref_bedrooms_range = prefs.get("numBedrooms", [1, float('inf')]) # Min 1 bedroom usually
    if not (pref_bedrooms_range[0] <= apartment.num_bedrooms <= pref_bedrooms_range[1]):
        deduction += prefs.get("numBedroomsWorth", 0)

    # Number of Bathrooms (unit)
    pref_bathrooms_range = prefs.get("numBathrooms", [1, float('inf')])
    if not (pref_bathrooms_range[0] <= apartment.num_bathrooms <= pref_bathrooms_range[1]):
        deduction += prefs.get("numBathroomsWorth", 0)

    # Boolean amenities
    if prefs.get("hasDishwasher", False) and not apartment.has_dishwasher:
        deduction += prefs.get("dishwasherWorth", 0)
    if prefs.get("hasWasher", False) and not apartment.has_washer:
        deduction += prefs.get("washerWorth", 0)
    if prefs.get("hasDryer", False) and not apartment.has_dryer:
        deduction += prefs.get("dryerWorth", 0)

    return base_bid - deduction

# --- Main Execution Logic ---
def run_matching_algorithm():
    all_people_objects = load_people_data(PERSON_PREFERENCES_FILE)
    all_apartment_objects = load_apartment_data(APARTMENT_DATA_FILE)

    unassigned_people = [p for p in all_people_objects if not p.is_assigned]
    available_apartments = list(all_apartment_objects)

    assignments_log = []
    iteration_count = 0

    while len(unassigned_people) > 0 and len(available_apartments) > 0:
        iteration_count += 1
        print(f"\n--- Iteration {iteration_count} ---")
        print(f"Unassigned people: {len(unassigned_people)}, Available apartments: {len(available_apartments)}")

        # 1. Generate potential groups from UNASSIGNED people
        potential_groups_of_objects = generate_potential_groups(unassigned_people)
        if not potential_groups_of_objects:
            print("No more potential groups can be formed.")
            break
        print(f"Generated {len(potential_groups_of_objects)} potential groups.")

        # 2. Determine which apartment to focus on (based on aggregate demand)
        #    Aggregate demand = apartment that could fetch the highest winning bid.
        best_apt_to_consider_this_round = None
        highest_potential_winning_bid_for_apt = -1.0

        # Store all bids for all apartments to select the best one and then use its bids.
        # Structure: {apt_id: [list of bid_details sorted by total_bid desc]}
        # bid_details: {"group_objects": group_obj_list, "total_bid": X, "individual_bids": {pid: Y}, "group_size": N}
        bids_for_all_apts = defaultdict(list)

        for apt in available_apartments:
            if not apt.allow_roommates and any(len(g) > 1 for g in potential_groups_of_objects):
                 # If apartment doesn't allow roommates, only consider groups of 1
                 eligible_groups_for_apt = [g for g in potential_groups_of_objects if len(g) == 1]
            else:
                 eligible_groups_for_apt = potential_groups_of_objects

            current_apt_bids = []
            for group_obj_list in eligible_groups_for_apt:
                group_size = len(group_obj_list)

                # Capacity Check: Group size vs Apartment bedrooms
                # Assumes an apartment with N bedrooms can house a group of up to N people.
                if group_size > apt.num_bedrooms:
                    continue

                # Mutual agreement on roommates (apartment allows it if group > 1)
                if group_size > 1 and not apt.allow_roommates:
                    continue

                total_group_bid = 0.0
                individual_bids_map = {}
                valid_group_for_this_bid = True

                for person_obj in group_obj_list:
                    # Person must also generally allow roommates if in a group > 1
                    if group_size > 1 and not person_obj.allow_roommates_pref:
                        valid_group_for_this_bid = False
                        break

                    adj_bid = calculate_adjusted_bid(person_obj, apt, group_size)
                    if adj_bid < 0: # Person values this apartment negatively
                        valid_group_for_this_bid = False
                        break
                    individual_bids_map[person_obj.id] = adj_bid
                    total_group_bid += adj_bid

                if valid_group_for_this_bid and total_group_bid > 0:
                    current_apt_bids.append({
                        "group_objects": group_obj_list,
                        "total_bid": total_group_bid,
                        "individual_bids": individual_bids_map,
                        "group_size": group_size
                    })

            if current_apt_bids:
                current_apt_bids.sort(key=lambda x: x["total_bid"], reverse=True)
                bids_for_all_apts[apt.apt_id] = current_apt_bids

                # Check if this apartment's top bid is better than current best
                if current_apt_bids[0]["total_bid"] > highest_potential_winning_bid_for_apt:
                    highest_potential_winning_bid_for_apt = current_apt_bids[0]["total_bid"]
                    best_apt_to_consider_this_round = apt

        if best_apt_to_consider_this_round is None:
            print("No apartment received any valid bids in this round. Ending.")
            break

        print(f"Apartment selected for assignment: {best_apt_to_consider_this_round.name} (ID: {best_apt_to_consider_this_round.apt_id}) with potential top bid {highest_potential_winning_bid_for_apt}")

        # 3. Assign the 'best_apt_to_consider_this_round'
        winning_bid_list_for_chosen_apt = bids_for_all_apts[best_apt_to_consider_this_round.apt_id]

        top_bid_event = winning_bid_list_for_chosen_apt[0]
        winning_group_objects = top_bid_event["group_objects"]
        winning_total_bid = top_bid_event["total_bid"]

        second_highest_total_bid_for_apt = 0.0
        if len(winning_bid_list_for_chosen_apt) > 1:
            second_highest_total_bid_for_apt = winning_bid_list_for_chosen_apt[1]["total_bid"]

        # 4. Calculate Payments
        payments_for_winning_group = {}
        if winning_total_bid > 0: # Ensure no division by zero
            for p_obj in winning_group_objects:
                person_individual_adjusted_bid = top_bid_event["individual_bids"][p_obj.id]
                # Payment = (Next Highest Group Bid / Winning Group Bid) * Person's Adjusted Bid
                # This is equivalent to: Next Highest Group Bid * (Person's Adjusted Bid / Winning Group Bid)
                person_payment = second_highest_total_bid_for_apt * (person_individual_adjusted_bid / winning_total_bid)
                payments_for_winning_group[p_obj.id] = person_payment
        else: # Should not happen if bids > 0 filter worked
             print(f"Warning: Winning bid for {best_apt_to_consider_this_round.name} is <= 0. Skipping assignment.")
             available_apartments = [a for a in available_apartments if a.apt_id != best_apt_to_consider_this_round.apt_id]
             continue


        # Log/Store assignment
        assignment_details = {
            "apartment_name": best_apt_to_consider_this_round.name,
            "apartment_id": best_apt_to_consider_this_round.apt_id,
            "group_member_ids": [p.id for p in winning_group_objects],
            "group_member_names": [p.name for p in winning_group_objects],
            "winning_total_bid": winning_total_bid,
            "second_highest_bid_for_apt": second_highest_total_bid_for_apt,
            "payments": []
        }
        for p_obj in winning_group_objects:
            assignment_details["payments"].append({
                "person_id": p_obj.id,
                "person_name": p_obj.name,
                "expected_payment": payments_for_winning_group.get(p_obj.id, 0.0),
                "their_adjusted_bid_in_group": top_bid_event["individual_bids"][p_obj.id]
            })
        assignments_log.append(assignment_details)
        print(f"Assigned Apt '{best_apt_to_consider_this_round.name}' to Group: {[p.name for p in winning_group_objects]}. Winning Bid: {winning_total_bid:.2f}. Payment based on 2nd highest bid: {second_highest_total_bid_for_apt:.2f}")
        for payment_info in assignment_details["payments"]:
            print(f"  - {payment_info['person_name']}: Pays {payment_info['expected_payment']:.2f} (their bid was {payment_info['their_adjusted_bid_in_group']:.2f})")


        # 5. Update lists: remove assigned people and apartment
        ids_of_assigned_people = [p.id for p in winning_group_objects]
        for p_obj in unassigned_people:
            if p_obj.id in ids_of_assigned_people:
                p_obj.is_assigned = True

        unassigned_people = [p for p in unassigned_people if not p.is_assigned]
        available_apartments = [a for a in available_apartments if a.apt_id != best_apt_to_consider_this_round.apt_id]

    # 6. Output results
    print("\n--- Final Assignments ---")
    if not assignments_log:
        print("No assignments were made.")
    else:
        # Convert to DataFrame for easy CSV output
        output_rows = []
        for an_assignment in assignments_log:
            apt_name = an_assignment['apartment_name']
            for payment_info in an_assignment['payments']:
                output_rows.append({
                    'ApartmentName': apt_name,
                    'PersonID': payment_info['person_id'],
                    'PersonName': payment_info['person_name'],
                    'ExpectedPayment': round(payment_info['expected_payment'], 2),
                    'AdjustedBid': round(payment_info['their_adjusted_bid_in_group'], 2),
                    'GroupWinningBid': round(an_assignment['winning_total_bid'], 2),
                    'SecondHighestBidForApt': round(an_assignment['second_highest_bid_for_apt'], 2),
                    'GroupMembersInWinningBid': ", ".join(an_assignment['group_member_names'])
                })

        output_df = pd.DataFrame(output_rows)
        output_df.to_csv(OUTPUT_FILE, index=False)
        print(f"\nAssignment results saved to {OUTPUT_FILE}")
        print(output_df)

    return assignments_log


if __name__ == "__main__":
    # Create a dummy people_data.csv if it doesn't exist for testing
    try:
        pd.read_csv(PERSON_PREFERENCES_FILE)
    except FileNotFoundError:
        print(f"Warning: {PERSON_PREFERENCES_FILE} not found. Creating a dummy file.")
        dummy_people_data = {
            'ID': [1, 2, 3, 4],
            'Name': ['Alice', 'Bob', 'Charlie', 'David'],
            'AllowRoommates': [True, True, False, True],
            'AssignedRoom': ['', '', '', ''],
            'RequiredPayment': [0, 0, 0, 0],
            'Preferences': [
                json.dumps({"sqMeters":[50,100],"sqMetersWorth":50,"numBedrooms":[2,3],"numBedroomsWorth":100,"bidAmount":1000,"maxRoommates":1,"cleanliness":80,"quietness":70,"guests":20,"personalSpace":90,"sleepTime":[1380,1440],"wakeTime":[420,540]}),
                json.dumps({"sqMeters":[60,120],"sqMetersWorth":60,"numBedrooms":[2,2],"numBedroomsWorth":80,"bidAmount":1200,"maxRoommates":2,"cleanliness":70,"quietness":80,"guests":50,"personalSpace":70,"sleepTime":[0,120],"wakeTime":[480,600],"hasDishwasher":True,"dishwasherWorth":20}),
                json.dumps({"sqMeters":[40,80],"sqMetersWorth":0,"numBedrooms":[1,1],"numBedroomsWorth":0,"bidAmount":800,"maxRoommates":0,"cleanliness":90,"quietness":90,"guests":10,"personalSpace":100,"sleepTime":[60,180],"wakeTime":[540,660]}),
                json.dumps({"sqMeters":[100,200],"sqMetersWorth":100,"numBedrooms":[3,5],"numBedroomsWorth":200,"bidAmount":2000,"maxRoommates":3,"cleanliness":50,"quietness":50,"guests":80,"personalSpace":50,"sleepTime":[120,240],"wakeTime":[600,720],"hasWasher":True,"washerWorth":30}),
            ]
        }
        pd.DataFrame(dummy_people_data).to_csv(PERSON_PREFERENCES_FILE, index=False)
        print(f"Dummy {PERSON_PREFERENCES_FILE} created. Please replace with your actual data.")

    # Assume apartment_data.csv is present from the prompt
    if not os.path.exists(APARTMENT_DATA_FILE):
        print(f"ERROR: {APARTMENT_DATA_FILE} not found. Please ensure it is in the same directory.")
    else:
        run_matching_algorithm()

