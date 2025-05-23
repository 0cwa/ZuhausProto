import { Apartment, Person, PersonPreferences, MatchingResult } from '@shared/schema';
import { euclideanDistance } from './utils'; // Assuming a utils file for math operations

// Define types for internal use, mirroring Python classes
interface DecodedPerson extends Person {
  socialVector: number[];
}

interface RoommateGroup {
  members: DecodedPerson[];
  compatibility: number;
  maxSize: number; // Max number of people in this group (including self)
}

interface ApartmentBid {
  apartment: Apartment;
  bidder: RoommateGroup; // Bidder is always a group (even if size 1)
  totalGroupBid: number;
  individualAdjustedBids: { [personId: string]: number };
  groupMembersNames: string[];
}

// Social preference keys and their normalization factor (max value for 0-1 scaling)
const SOCIAL_PREF_KEY_NORMS: { [key: string]: number } = {
  "cleanliness": 100.0,
  "quietness": 100.0,
  "guests": 100.0,
  "personalSpace": 100.0,
  "sleepTime_mid": 1440.0, // Midpoint of sleepTime range (minutes)
  "wakeTime_mid": 1440.0   // Midpoint of wakeTime range (minutes)
};

export class MatchingEngine {

  // This method now just adds the social vector to the Person object
  private preparePersonForMatching(person: Person): DecodedPerson {
    const preferences = person.preferences;
    const socialVector: number[] = [];

    // Handle time preferences by taking midpoints
    const sleepTimeRange = preferences.sleepTime || [0, 0];
    const wakeTimeRange = preferences.wakeTime || [0, 0];
    const midSleepTime = (sleepTimeRange[0] + sleepTimeRange[1]) / 2.0;
    const midWakeTime = (wakeTimeRange[0] + wakeTimeRange[1]) / 2.0;

    const tempPrefs = {
      ...preferences,
      sleepTime_mid: midSleepTime,
      wakeTime_mid: midWakeTime
    };

    for (const key in SOCIAL_PREF_KEY_NORMS) {
      const value = tempPrefs[key as keyof typeof tempPrefs] !== undefined ? tempPrefs[key as keyof typeof tempPrefs] : 0;
      const normFactor = SOCIAL_PREF_KEY_NORMS[key];
      socialVector.push(typeof value === 'number' ? (value / normFactor) : 0);
    }

    return { ...person, socialVector };
  }

  private calculateSocialCompatibility(person1: DecodedPerson, person2: DecodedPerson): number {
    // Euclidean distance on normalized social vectors
    const dist = euclideanDistance(person1.socialVector, person2.socialVector);
    // Convert distance to similarity: higher score is better, so -dist
    return -dist;
  }

  private generatePotentialGroups(unassignedPeople: DecodedPerson[]): RoommateGroup[] {
    const potentialGroupsSet = new Set<string>(); // To store stringified sorted person IDs for uniqueness
    const groups: RoommateGroup[] = [];

    for (const pAnchor of unassignedPeople) {
      // Group of 1 (person themselves)
      const singleGroupIds = [pAnchor.id].sort();
      const singleGroupKey = JSON.stringify(singleGroupIds);
      if (!potentialGroupsSet.has(singleGroupKey)) {
        potentialGroupsSet.add(singleGroupKey);
        groups.push({
          members: [pAnchor],
          compatibility: 100, // Single person is perfectly compatible with themselves
          maxSize: 1, // A single person group has a max size of 1
        });
      }

      // Groups with roommates
      const roommateCandidates = unassignedPeople.filter(p => p.id !== pAnchor.id);

      // Iterate from 1 up to pAnchor's max_roommates
      for (let numRoommates = 1; numRoommates <= (pAnchor.preferences.maxRoommates || 0); numRoommates++) {
        if (numRoommates > roommateCandidates.length) {
          continue;
        }

        // Score candidates based on compatibility with pAnchor
        const scoredCandidates = roommateCandidates
          .map(candidate => ({
            score: this.calculateSocialCompatibility(pAnchor, candidate),
            person: candidate
          }))
          .sort((a, b) => b.score - a.score); // Sort descending by score

        // Generate combinations of roommates
        const combinations = this.getCombinations(scoredCandidates, numRoommates);

        for (const combo of combinations) {
          const currentGroupMembers = [pAnchor, ...combo.map(c => c.person)];
          
          // Check if all members in the potential group allow roommates and are willing to be in a group of this size
          const allAllowRoommates = currentGroupMembers.every(p => p.allowRoommates);
          const allWillingSize = currentGroupMembers.every(p => (p.preferences.maxRoommates || 0) >= (currentGroupMembers.length - 1));

          if (!allAllowRoommates || !allWillingSize) {
            continue;
          }

          // Calculate average compatibility for the group
          let totalCompatibility = 0;
          let pairCount = 0;
          for (let i = 0; i < currentGroupMembers.length; i++) {
            for (let j = i + 1; j < currentGroupMembers.length; j++) {
              totalCompatibility += this.calculateSocialCompatibility(currentGroupMembers[i], currentGroupMembers[j]);
              pairCount++;
            }
          }
          const avgCompatibility = pairCount > 0 ? totalCompatibility / pairCount : 100; // If only one person, compatibility is 100

          // Only add if compatibility is above a threshold (e.g., 60, similar to Python's implicit threshold)
          const compatibilityThreshold = -100; // A negative threshold for negative distance scores
          if (avgCompatibility >= compatibilityThreshold) {
            const groupIds = currentGroupMembers.map(p => p.id).sort();
            const groupKey = JSON.stringify(groupIds);

            if (!potentialGroupsSet.has(groupKey)) {
              potentialGroupsSet.add(groupKey);
              groups.push({
                members: currentGroupMembers,
                compatibility: avgCompatibility,
                maxSize: currentGroupMembers.reduce((min, p) => Math.min(min, (p.preferences.maxRoommates || 0) + 1), Infinity),
              });
            }
          }
        }
      }
    }
    return groups.sort((a, b) => b.compatibility - a.compatibility);
  }

  private getCombinations<T>(arr: T[], k: number): T[][] {
    const result: T[][] = [];
    function backtrack(start: number, currentCombination: T[]) {
      if (currentCombination.length === k) {
        result.push([...currentCombination]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        currentCombination.push(arr[i]);
        backtrack(i + 1, currentCombination);
        currentCombination.pop();
      }
    }
    backtrack(0, []);
    return result;
  }

  private calculateAdjustedBid(person: DecodedPerson, apartment: Apartment, groupSize: number): number {
    let baseBid = person.preferences.bidAmount;
    let deduction = 0;
    const prefs = person.preferences;

    const checkRange = (value: number, prefRange: [number, number] | undefined, worth: number | undefined) => {
      if (prefRange && prefRange.length === 2) {
        const [minPref, maxPref] = prefRange;
        if (value < minPref || value > maxPref) {
          deduction += worth || 0;
        }
      }
    };

    // Sq. Meters
    checkRange(apartment.sqMeters, prefs.sqMeters, prefs.sqMetersWorth);

    // Number of Windows
    checkRange(apartment.numWindows, prefs.numWindows, prefs.numWindowsWorth);

    // Window Directions
    const prefWDirs = new Set(prefs.windowDirections || []);
    if (prefWDirs.size > 0) {
      const intersection = [...prefWDirs].filter(dir => apartment.windowDirections.has(dir));
      if (intersection.length === 0) { // If none of the preferred directions are present
        deduction += prefs.windowDirectionsWorth || 0;
      }
    }

    // Total Window Size
    checkRange(apartment.totalWindowSize, prefs.totalWindowSize, prefs.totalWindowSizeWorth);

    // Number of Bedrooms
    checkRange(apartment.numBedrooms, prefs.numBedrooms, prefs.numBedroomsWorth);

    // Number of Bathrooms
    checkRange(apartment.numBathrooms, prefs.numBathrooms, prefs.numBathroomsWorth);

    // Boolean amenities
    if (prefs.hasDishwasher && !apartment.hasDishwasher) {
      deduction += prefs.dishwasherWorth || 0;
    }
    if (prefs.hasWasher && !apartment.hasWasher) {
      deduction += prefs.washerWorth || 0;
    }
    if (prefs.hasDryer && !apartment.hasDryer) {
      deduction += prefs.dryerWorth || 0;
    }

    return baseBid - deduction;
  }

  async runMatching(people: Person[], apartments: Apartment[]): Promise<MatchingResult[]> {
    const decodedPeople: DecodedPerson[] = people.map(person => this.preparePersonForMatching(person));

    let unassignedPeople = [...decodedPeople];
    let availableApartments = [...apartments];

    const assignmentsLog: any[] = []; // To store detailed assignment info for CSV output

    let iterationCount = 0;
    while (unassignedPeople.length > 0 && availableApartments.length > 0 && iterationCount < 100) { // Add iteration limit to prevent infinite loops
      iterationCount++;
      // console.log(`\n--- Iteration ${iterationCount} ---`);
      // console.log(`Unassigned people: ${unassignedPeople.length}, Available apartments: ${availableApartments.length}`);

      // 1. Generate potential groups from UNASSIGNED people
      const potentialGroups = this.generatePotentialGroups(unassignedPeople);
      if (potentialGroups.length === 0) {
        // console.log("No more potential groups can be formed.");
        break;
      }
      // console.log(`Generated ${potentialGroups.length} potential groups.`);

      // 2. Determine which apartment to focus on (based on aggregate demand)
      let bestAptToConsiderThisRound: Apartment | null = null;
      let highestPotentialWinningBidForApt = -1.0;

      const bidsForApartments = new Map<string, ApartmentBid[]>(); // aptId -> list of bids for this apt

      for (const apt of availableApartments) {
        const currentAptBids: ApartmentBid[] = [];
        
        for (const group of potentialGroups) {
          const groupSize = group.members.length;

          // Check if any member of this group is already assigned
          if (group.members.some(member => !unassignedPeople.some(p => p.id === member.id))) {
            continue;
          }

          // Capacity Check: Group size vs Apartment bedrooms
          if (groupSize > apt.numBedrooms) {
            continue;
          }

          // Mutual agreement on roommates (apartment allows it if group > 1)
          if (groupSize > 1 && !apt.allowRoommates) {
            continue;
          }

          let totalGroupBid = 0.0;
          const individualAdjustedBids: { [personId: string]: number } = {};
          let validGroupForThisBid = true;

          for (const personObj of group.members) {
            // Person must also generally allow roommates if in a group > 1
            if (groupSize > 1 && !personObj.allowRoommates) { // Use person.allowRoommates from schema
              validGroupForThisBid = false;
              break;
            }

            const adjBid = this.calculateAdjustedBid(personObj, apt, groupSize);
            if (adjBid < 0) { // Person values this apartment negatively
              validGroupForThisBid = false;
              break;
            }
            individualAdjustedBids[personObj.id] = adjBid;
            totalGroupBid += adjBid;
          }

          if (validGroupForThisBid && totalGroupBid > 0) {
            currentAptBids.push({
              apartment: apt,
              bidder: group,
              totalGroupBid: totalGroupBid,
              individualAdjustedBids: individualAdjustedBids,
              groupMembersNames: group.members.map(m => m.name)
            });
          }
        }

        if (currentAptBids.length > 0) {
          currentAptBids.sort((a, b) => b.totalGroupBid - a.totalGroupBid);
          bidsForApartments.set(apt.id, currentAptBids);

          if (currentAptBids[0].totalGroupBid > highestPotentialWinningBidForApt) {
            highestPotentialWinningBidForApt = currentAptBids[0].totalGroupBid;
            bestAptToConsiderThisRound = apt;
          }
        }
      }

      if (!bestAptToConsiderThisRound) {
        // console.log("No apartment received any valid bids in this round. Ending.");
        break;
      }

      // console.log(`Apartment selected for assignment: ${bestAptToConsiderThisRound.name} (ID: ${bestAptToConsiderThisRound.id}) with potential top bid ${highestPotentialWinningBidForApt}`);

      // 3. Assign the 'bestAptToConsiderThisRound'
      const winningBidListForChosenApt = bidsForApartments.get(bestAptToConsiderThisRound.id);
      if (!winningBidListForChosenApt || winningBidListForChosenApt.length === 0) {
        // This should ideally not happen if bestAptToConsiderThisRound was selected
        continue;
      }

      const topBidEvent = winningBidListForChosenApt[0];
      const winningGroup = topBidEvent.bidder;
      const winningTotalBid = topBidEvent.totalGroupBid;

      let secondHighestTotalBidForApt = 0.0;
      if (winningBidListForChosenApt.length > 1) {
        secondHighestTotalBidForApt = winningBidListForChosenApt[1].totalGroupBid;
      }

      // 4. Calculate Payments
      const paymentsForWinningGroup: { [personId: string]: number } = {};
      if (winningTotalBid > 0) {
        for (const pObj of winningGroup.members) {
          const personIndividualAdjustedBid = topBidEvent.individualAdjustedBids[pObj.id];
          // Payment = (Second Highest Group Bid / Winning Group Bid) * Person's Adjusted Bid
          const personPayment = secondHighestTotalBidForApt * (personIndividualAdjustedBid / winningTotalBid);
          paymentsForWinningGroup[pObj.id] = personPayment;
        }
      } else {
        // console.warn(`Warning: Winning bid for ${bestAptToConsiderThisRound.name} is <= 0. Skipping assignment.`);
        availableApartments = availableApartments.filter(a => a.id !== bestAptToConsiderThisRound!.id);
        continue;
      }

      // Log/Store assignment details for CSV output
      for (const pObj of winningGroup.members) {
        assignmentsLog.push({
          apartment_name: bestAptToConsiderThisRound.name,
          person_id: pObj.id,
          person_name: pObj.name,
          expected_payment: paymentsForWinningGroup[pObj.id],
          adjusted_bid: topBidEvent.individualAdjustedBids[pObj.id],
          group_winning_bid: winningTotalBid,
          second_highest_bid_for_apt: secondHighestTotalBidForApt,
          group_members_in_winning_bid: winningGroup.members.map(m => m.name).join(", ")
        });
      }
      // console.log(`Assigned Apt '${bestAptToConsiderThisRound.name}' to Group: ${winningGroup.members.map(p => p.name).join(', ')}. Winning Bid: ${winningTotalBid.toFixed(2)}. Payment based on 2nd highest bid: ${secondHighestTotalBidForApt.toFixed(2)}`);
      // for (const paymentInfo of winningGroup.members) {
      //   console.log(`  - ${paymentInfo.name}: Pays ${paymentsForWinningGroup[paymentInfo.id].toFixed(2)} (their bid was ${topBidEvent.individualAdjustedBids[paymentInfo.id].toFixed(2)})`);
      // }

      // 5. Update lists: remove assigned people and apartment
      const idsOfAssignedPeople = new Set(winningGroup.members.map(p => p.id));
      unassignedPeople = unassignedPeople.filter(p => !idsOfAssignedPeople.has(p.id));
      availableApartments = availableApartments.filter(a => a.id !== bestAptToConsiderThisRound!.id);
    }

    // Convert assignmentsLog to MatchingResult[] format for the API response
    const finalMatchingResultsMap = new Map<string, MatchingResult>();

    assignmentsLog.forEach(logEntry => {
      let result = finalMatchingResultsMap.get(logEntry.apartment_name);
      if (!result) {
        const apt = apartments.find(a => a.name === logEntry.apartment_name);
        if (!apt) {
          console.warn(`Apartment ${logEntry.apartment_name} not found in original list.`);
          return;
        }
        result = {
          apartmentId: apt.id,
          apartmentName: apt.name,
          assignedPeople: [],
          totalPayment: logEntry.group_winning_bid,
          tenants: 0,
          capacity: apt.numBedrooms,
        };
        finalMatchingResultsMap.set(logEntry.apartment_name, result);
      }
      result.assignedPeople.push({
        id: logEntry.person_id,
        name: logEntry.person_name,
        payment: logEntry.expected_payment,
      });
      result.tenants++;
      result.totalPayment = logEntry.group_winning_bid; // Ensure total payment is the group winning bid
    });

    return Array.from(finalMatchingResultsMap.values());
  }
}

export const matchingEngine = new MatchingEngine();
