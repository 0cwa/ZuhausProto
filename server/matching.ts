import { Apartment, Person, PersonPreferences, MatchingResult } from '@shared/schema';
import { serverKeyPair } from './crypto';

interface DecodedPerson extends Person {
  preferences: PersonPreferences;
}

interface RoommateGroup {
  members: DecodedPerson[];
  compatibility: number;
  maxSize: number;
}

interface ApartmentBid {
  apartment: Apartment;
  bidder: DecodedPerson | RoommateGroup;
  effectiveBid: number;
  isGroup: boolean;
}

export class MatchingEngine {
  private decryptPersonData(person: Person): DecodedPerson {
    try {
      const decryptedData = serverKeyPair.decrypt(person.encryptedData);
      const preferences = JSON.parse(decryptedData) as PersonPreferences;
      return { ...person, preferences };
    } catch (error) {
      throw new Error(`Failed to decrypt data for person ${person.name}`);
    }
  }

  private calculateInterpersonalCompatibility(person1: DecodedPerson, person2: DecodedPerson): number {
    const factors = ['cleanliness', 'quietness', 'guests', 'personalSpace'] as const;
    let totalScore = 0;
    let validFactors = 0;

    for (const factor of factors) {
      const val1 = person1.preferences[factor];
      const val2 = person2.preferences[factor];
      
      if (val1 !== undefined && val2 !== undefined) {
        // Calculate similarity score (0-100)
        const difference = Math.abs(val1 - val2);
        const similarity = Math.max(0, 100 - difference);
        totalScore += similarity;
        validFactors++;
      }
    }

    // Check sleep schedule compatibility
    const sleep1 = person1.preferences.sleepTime;
    const sleep2 = person2.preferences.sleepTime;
    const wake1 = person1.preferences.wakeTime;
    const wake2 = person2.preferences.wakeTime;

    if (sleep1 && sleep2 && wake1 && wake2) {
      const sleepDiff = Math.abs(sleep1 - sleep2);
      const wakeDiff = Math.abs(wake1 - wake2);
      const scheduleCompatibility = Math.max(0, 100 - (sleepDiff + wakeDiff) / 2);
      totalScore += scheduleCompatibility;
      validFactors++;
    }

    return validFactors > 0 ? totalScore / validFactors : 0;
  }

  private canShareApartment(people: DecodedPerson[], apartment: Apartment): boolean {
    if (people.length > apartment.numBedrooms) return false;
    
    // Check if all people allow roommates (except for single occupancy)
    if (people.length > 1 && !people.every(p => p.allowRoommates)) return false;
    
    return true;
  }

  private formRoommateGroups(people: DecodedPerson[]): RoommateGroup[] {
    const groups: RoommateGroup[] = [];
    const compatibilityThreshold = 60; // Minimum compatibility score

    // Add individuals as single-person groups
    people.forEach(person => {
      groups.push({
        members: [person],
        compatibility: 100,
        maxSize: 1,
      });
    });

    // Form pairs
    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        const person1 = people[i];
        const person2 = people[j];
        
        if (!person1.allowRoommates || !person2.allowRoommates) continue;
        
        const compatibility = this.calculateInterpersonalCompatibility(person1, person2);
        if (compatibility >= compatibilityThreshold) {
          const maxRoommates1 = person1.preferences.maxRoommates || 1;
          const maxRoommates2 = person2.preferences.maxRoommates || 1;
          
          if (maxRoommates1 >= 1 && maxRoommates2 >= 1) {
            groups.push({
              members: [person1, person2],
              compatibility,
              maxSize: Math.min(maxRoommates1 + 1, maxRoommates2 + 1),
            });
          }
        }
      }
    }

    // Form larger groups (3-5 people)
    const allowRoommatesPeople = people.filter(p => p.allowRoommates);
    
    for (let size = 3; size <= 5; size++) {
      this.generateCombinations(allowRoommatesPeople, size).forEach(combination => {
        let totalCompatibility = 0;
        let pairCount = 0;
        let canFormGroup = true;
        let minMaxSize = size;

        // Check all pairs within the group
        for (let i = 0; i < combination.length && canFormGroup; i++) {
          const maxRoommates = combination[i].preferences.maxRoommates || 1;
          minMaxSize = Math.min(minMaxSize, maxRoommates + 1);
          
          if (maxRoommates < size - 1) {
            canFormGroup = false;
            break;
          }
          
          for (let j = i + 1; j < combination.length; j++) {
            const compatibility = this.calculateInterpersonalCompatibility(combination[i], combination[j]);
            if (compatibility < compatibilityThreshold) {
              canFormGroup = false;
              break;
            }
            totalCompatibility += compatibility;
            pairCount++;
          }
        }

        if (canFormGroup && pairCount > 0) {
          groups.push({
            members: combination,
            compatibility: totalCompatibility / pairCount,
            maxSize: minMaxSize,
          });
        }
      });
    }

    return groups.sort((a, b) => b.compatibility - a.compatibility);
  }

  private generateCombinations<T>(array: T[], size: number): T[][] {
    if (size === 1) return array.map(item => [item]);
    if (size > array.length) return [];
    
    const combinations: T[][] = [];
    for (let i = 0; i <= array.length - size; i++) {
      const smaller = this.generateCombinations(array.slice(i + 1), size - 1);
      smaller.forEach(combination => {
        combinations.push([array[i], ...combination]);
      });
    }
    return combinations;
  }

  private calculateEffectiveBid(
    bidder: DecodedPerson | RoommateGroup,
    apartment: Apartment,
    isGroup: boolean
  ): number {
    if (isGroup) {
      const group = bidder as RoommateGroup;
      let totalBid = 0;
      let totalDeduction = 0;

      group.members.forEach(person => {
        totalBid += person.preferences.bidAmount;
        totalDeduction += this.calculateCharacteristicDeduction(person.preferences, apartment);
      });

      return Math.max(0, totalBid - totalDeduction);
    } else {
      const person = bidder as DecodedPerson;
      const deduction = this.calculateCharacteristicDeduction(person.preferences, apartment);
      return Math.max(0, person.preferences.bidAmount - deduction);
    }
  }

  private calculateCharacteristicDeduction(preferences: PersonPreferences, apartment: Apartment): number {
    let deduction = 0;

    // Square meters
    if (apartment.sqMeters < preferences.sqMeters) {
      deduction += preferences.sqMetersWorth || 0;
    }

    // Number of windows
    if (apartment.numWindows < preferences.numWindows) {
      deduction += preferences.numWindowsWorth || 0;
    }

    // Window directions (AND logic)
    const hasAllDirections = preferences.windowDirections.every(dir => 
      apartment.windowDirections.includes(dir)
    );
    if (!hasAllDirections) {
      deduction += preferences.windowDirectionsWorth || 0;
    }

    // Total window size
    if (apartment.totalWindowSize < preferences.totalWindowSize) {
      deduction += preferences.totalWindowSizeWorth || 0;
    }

    // Number of bedrooms
    if (apartment.numBedrooms < preferences.numBedrooms) {
      deduction += preferences.numBedroomsWorth || 0;
    }

    // Number of bathrooms
    if (apartment.numBathrooms < preferences.numBathrooms) {
      deduction += preferences.numBathroomsWorth || 0;
    }

    // Amenities
    if (preferences.hasDishwasher && !apartment.hasDishwasher) {
      deduction += preferences.dishwasherWorth || 0;
    }
    if (preferences.hasWasher && !apartment.hasWasher) {
      deduction += preferences.washerWorth || 0;
    }
    if (preferences.hasDryer && !apartment.hasDryer) {
      deduction += preferences.dryerWorth || 0;
    }

    return deduction;
  }

  async runMatching(people: Person[], apartments: Apartment[]): Promise<MatchingResult[]> {
    // Decrypt all person data
    const decodedPeople = people.map(person => this.decryptPersonData(person));
    
    // Form roommate groups
    const groups = this.formRoommateGroups(decodedPeople);
    
    // Create a copy of apartments to track availability
    const availableApartments = apartments.map(apt => ({ ...apt }));
    const results: MatchingResult[] = [];
    const assignedPeople = new Set<string>();

    // Create bids for all apartment-bidder combinations
    const allBids: ApartmentBid[] = [];
    
    availableApartments.forEach(apartment => {
      groups.forEach(group => {
        // Skip if group members are already assigned
        if (group.members.some(member => assignedPeople.has(member.id))) return;
        
        // Check if group can fit in apartment
        if (!this.canShareApartment(group.members, apartment)) return;
        
        // Check if apartment has space
        if (apartment.tenants + group.members.length > apartment.numBedrooms) return;
        
        const effectiveBid = this.calculateEffectiveBid(group, apartment, group.members.length > 1);
        
        if (effectiveBid > 0) {
          allBids.push({
            apartment,
            bidder: group,
            effectiveBid,
            isGroup: group.members.length > 1,
          });
        }
      });
    });

    // Sort bids by effective bid amount (highest first)
    allBids.sort((a, b) => b.effectiveBid - a.effectiveBid);

    // Process bids in order
    while (allBids.length > 0) {
      // Find apartment with highest demand
      const apartmentDemand = new Map<string, ApartmentBid[]>();
      
      allBids.forEach(bid => {
        const aptId = bid.apartment.id;
        if (!apartmentDemand.has(aptId)) {
          apartmentDemand.set(aptId, []);
        }
        apartmentDemand.get(aptId)!.push(bid);
      });

      // Find apartment with most demand that still has space
      let selectedApartment: string | null = null;
      let maxDemand = 0;

      for (const [aptId, bids] of apartmentDemand.entries()) {
        const apartment = availableApartments.find(apt => apt.id === aptId);
        if (apartment && apartment.tenants < apartment.numBedrooms && bids.length > maxDemand) {
          maxDemand = bids.length;
          selectedApartment = aptId;
        }
      }

      if (!selectedApartment) break;

      // Get bids for selected apartment
      const apartmentBids = apartmentDemand.get(selectedApartment)!;
      
      // Filter out bids from already assigned people
      const validBids = apartmentBids.filter(bid => {
        const group = bid.bidder as RoommateGroup;
        return !group.members.some(member => assignedPeople.has(member.id));
      });

      if (validBids.length === 0) {
        // Remove all bids for this apartment and continue
        allBids.splice(0, allBids.length, ...allBids.filter(bid => bid.apartment.id !== selectedApartment));
        continue;
      }

      // Sort valid bids by effective bid (highest first)
      validBids.sort((a, b) => b.effectiveBid - a.effectiveBid);

      const winningBid = validBids[0];
      const secondHighestBid = validBids[1];
      const paymentAmount = secondHighestBid ? secondHighestBid.effectiveBid : winningBid.effectiveBid;

      // Assign the apartment
      const group = winningBid.bidder as RoommateGroup;
      const apartment = availableApartments.find(apt => apt.id === selectedApartment)!;

      // Calculate individual payments
      const assignedPeopleInfo = group.members.map(member => {
        let individualPayment: number;
        
        if (group.members.length === 1) {
          individualPayment = paymentAmount;
        } else {
          // Distribute payment based on proportion of original bid
          const totalOriginalBid = group.members.reduce((sum, m) => sum + m.preferences.bidAmount, 0);
          const memberProportion = member.preferences.bidAmount / totalOriginalBid;
          individualPayment = Math.round(paymentAmount * memberProportion);
        }
        
        assignedPeople.add(member.id);
        return {
          id: member.id,
          name: member.name,
          payment: individualPayment,
        };
      });

      // Update apartment occupancy
      apartment.tenants += group.members.length;
      if (apartment.tenants >= apartment.numBedrooms) {
        apartment.allowRoommates = false;
      }

      // Create result
      results.push({
        apartmentId: apartment.id,
        apartmentName: apartment.name,
        assignedPeople: assignedPeopleInfo,
        totalPayment: paymentAmount,
        tenants: apartment.tenants,
        capacity: apartment.numBedrooms,
      });

      // Remove all bids involving assigned people
      allBids.splice(0, allBids.length, ...allBids.filter(bid => {
        const group = bid.bidder as RoommateGroup;
        return !group.members.some(member => assignedPeople.has(member.id));
      }));
    }

    return results;
  }
}

export const matchingEngine = new MatchingEngine();
