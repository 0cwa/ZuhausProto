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
      console.error(`Failed to decrypt data for person ${person.name}: ${error}`);
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
        const difference = Math.abs(val1 - val2);
        const similarity = Math.max(0, 100 - difference);
        totalScore += similarity;
        validFactors++;
      }
    }

    const sleepRange1 = person1.preferences.sleepTime;
    const sleepRange2 = person2.preferences.sleepTime;
    const wakeRange1 = person1.preferences.wakeTime;
    const wakeRange2 = person2.preferences.wakeTime;

    if (sleepRange1 && sleepRange2 && sleepRange1.length === 2 && sleepRange2.length === 2) {
      const midSleep1 = (sleepRange1[0] + sleepRange1[1]) / 2;
      const midSleep2 = (sleepRange2[0] + sleepRange2[1]) / 2;
      const normMidSleep1 = midSleep1 % 1440;
      const normMidSleep2 = midSleep2 % 1440;
      const sleepDiff = Math.min(Math.abs(normMidSleep1 - normMidSleep2), 1440 - Math.abs(normMidSleep1 - normMidSleep2));
      const sleepCompatibility = Math.max(0, 100 - (sleepDiff / 360) * 100);
      totalScore += sleepCompatibility;
      validFactors++;
    }

    if (wakeRange1 && wakeRange2 && wakeRange1.length === 2 && wakeRange2.length === 2) {
      const midWake1 = (wakeRange1[0] + wakeRange1[1]) / 2;
      const midWake2 = (wakeRange2[0] + wakeRange2[1]) / 2;
      const normMidWake1 = midWake1 % 1440;
      const normMidWake2 = midWake2 % 1440;
      const wakeDiff = Math.min(Math.abs(normMidWake1 - normMidWake2), 1440 - Math.abs(normMidWake1 - normMidWake2));
      const wakeCompatibility = Math.max(0, 100 - (wakeDiff / 360) * 100);
      totalScore += wakeCompatibility;
      validFactors++;
    }

    return validFactors > 0 ? totalScore / validFactors : 0;
  }

  private canShareApartment(people: DecodedPerson[], apartment: Apartment): boolean {
    if (people.length > apartment.numBedrooms) return false;
    if (people.length > 1 && !people.every(p => p.allowRoommates)) return false;
    return true;
  }

  private formRoommateGroups(people: DecodedPerson[]): RoommateGroup[] {
    const groups: RoommateGroup[] = [];
    const compatibilityThreshold = 60; 

    people.forEach(person => {
      groups.push({
        members: [person],
        compatibility: 100,
        maxSize: 1,
      });
    });

    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        const person1 = people[i];
        const person2 = people[j];
        
        if (!person1.allowRoommates || !person2.allowRoommates) continue;
        
        const compatibility = this.calculateInterpersonalCompatibility(person1, person2);
        if (compatibility >= compatibilityThreshold) {
          const maxRoommates1 = person1.preferences.maxRoommates === undefined ? 1 : person1.preferences.maxRoommates;
          const maxRoommates2 = person2.preferences.maxRoommates === undefined ? 1 : person2.preferences.maxRoommates;
          
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
    
    const allowRoommatesPeople = people.filter(p => p.allowRoommates);
    for (let size = 3; size <= 5; size++) {
      this.generateCombinations(allowRoommatesPeople, size).forEach(combination => {
        let totalCompatibility = 0;
        let pairCount = 0;
        let canFormGroup = true;
        let minMaxSize = size;

        for (let i = 0; i < combination.length && canFormGroup; i++) {
          const maxRoommates = combination[i].preferences.maxRoommates === undefined ? 1 : combination[i].preferences.maxRoommates;
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
    if (size === 0) return [[]];
    if (size < 0 || size > array.length) return [];
    if (size === array.length) return [array];
    if (size === 1) return array.map(item => [item]);
    
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

    const checkRange = (value: number, prefRange: [number, number] | undefined, worth: number | undefined) => {
      if (prefRange && prefRange.length === 2) {
        const [minPref, maxPref] = prefRange;
        if (value < minPref || value > maxPref) {
          deduction += worth || 0;
        }
      }
    };

    checkRange(apartment.sqMeters, preferences.sqMeters, preferences.sqMetersWorth);
    checkRange(apartment.numWindows, preferences.numWindows, preferences.numWindowsWorth);
    checkRange(apartment.totalWindowSize, preferences.totalWindowSize, preferences.totalWindowSizeWorth);
    checkRange(apartment.numBedrooms, preferences.numBedrooms, preferences.numBedroomsWorth);
    checkRange(apartment.numBathrooms, preferences.numBathrooms, preferences.numBathroomsWorth);

    if (preferences.windowDirections && preferences.windowDirections.length > 0) {
      const selectedDirections = preferences.windowDirections;
      const requiredMatches = Math.ceil(selectedDirections.length * 0.75);
      const matchCount = selectedDirections.filter(dir => apartment.windowDirections.includes(dir)).length;
      
      if (matchCount < requiredMatches) {
        deduction += preferences.windowDirectionsWorth || 0;
      }
    }

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
    const decodedPeople = people.map(person => this.decryptPersonData(person));
    const groups = this.formRoommateGroups(decodedPeople);
    
    const availableApartments = apartments.map(apt => ({ ...apt, currentTenants: apt.tenants })); 
    const results: MatchingResult[] = [];
    const assignedPeopleIds = new Set<string>();

    const allBids: ApartmentBid[] = [];
    
    availableApartments.forEach(apartment => {
      groups.forEach(group => {
        if (group.members.some(member => assignedPeopleIds.has(member.id))) return;
        if (!this.canShareApartment(group.members, apartment)) return;
        if (apartment.currentTenants + group.members.length > apartment.numBedrooms) return; 
        if (group.members.length > group.maxSize) return;

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

    allBids.sort((a, b) => b.effectiveBid - a.effectiveBid);

    while (allBids.length > 0) {
      const highestBid = allBids.shift(); 
      if (!highestBid) break;

      const { apartment: targetApartment, bidder, effectiveBid } = highestBid;
      const group = bidder as RoommateGroup;

      const apartmentInSystem = availableApartments.find(a => a.id === targetApartment.id);
      if (!apartmentInSystem || apartmentInSystem.currentTenants + group.members.length > apartmentInSystem.numBedrooms) {
        continue; 
      }
      if (group.members.some(member => assignedPeopleIds.has(member.id))) {
        continue; 
      }
       if (group.members.length > group.maxSize) {
        continue; 
      }

      const paymentAmount = effectiveBid; 

      const assignedPeopleInfo = group.members.map(member => {
        let individualPayment: number;
        if (group.members.length === 1) {
          individualPayment = paymentAmount;
        } else {
          const totalOriginalBid = group.members.reduce((sum, m) => sum + m.preferences.bidAmount, 0);
          if (totalOriginalBid === 0) { 
             individualPayment = Math.round(paymentAmount / group.members.length);
          } else {
            const memberProportion = member.preferences.bidAmount / totalOriginalBid;
            individualPayment = Math.round(paymentAmount * memberProportion);
          }
        }
        
        assignedPeopleIds.add(member.id);
        return {
          id: member.id,
          name: member.name,
          payment: individualPayment,
        };
      });

      apartmentInSystem.currentTenants += group.members.length;

      results.push({
        apartmentId: apartmentInSystem.id,
        apartmentName: apartmentInSystem.name,
        assignedPeople: assignedPeopleInfo,
        totalPayment: paymentAmount, 
        tenants: apartmentInSystem.currentTenants,
        capacity: apartmentInSystem.numBedrooms, 
      });

      for (let i = allBids.length - 1; i >= 0; i--) {
        const currentBidGroup = allBids[i].bidder as RoommateGroup;
        if (currentBidGroup.members.some(m => assignedPeopleIds.has(m.id))) {
          allBids.splice(i, 1);
        }
      }
    }
    return results;
  }
}

export const matchingEngine = new MatchingEngine();
