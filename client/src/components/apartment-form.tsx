import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { RoommateSection } from "./roommate-section";
import { encryptData } from "@/lib/crypto";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Send, User, Home, Users, DollarSign } from "lucide-react";

// Min/max for sleep time slider (linear minutes, 7 PM to 5 AM next day)
const SLEEP_TIME_SLIDER_MIN = 19 * 60; // 7 PM
const SLEEP_TIME_SLIDER_MAX = (24 + 5) * 60; // 5 AM (next day) = 29 * 60

// Min/max for wake time slider (linear minutes, e.g., 4 AM to 1 PM)
const WAKE_TIME_SLIDER_MIN = 4 * 60; // 4 AM
const WAKE_TIME_SLIDER_MAX = 13 * 60; // 1 PM

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sqMeters: z.tuple([z.number().min(20).max(150), z.number().min(20).max(150)])
    .refine(data => data[0] <= data[1], { message: "Min sq meters must be less than or equal to max" }),
  sqMetersWorth: z.number().min(0).optional(),
  numWindows: z.tuple([z.number().min(1).max(12), z.number().min(1).max(12)])
    .refine(data => data[0] <= data[1], { message: "Min windows must be less than or equal to max" }),
  numWindowsWorth: z.number().min(0).optional(),
  windowDirections: z.array(z.string()),
  windowDirectionsWorth: z.number().min(0).optional(),
  totalWindowSize: z.tuple([z.number().min(2).max(25), z.number().min(2).max(25)])
    .refine(data => data[0] <= data[1], { message: "Min window size must be less than or equal to max" }),
  totalWindowSizeWorth: z.number().min(0).optional(),
  numBedrooms: z.tuple([z.number().min(1).max(5), z.number().min(1).max(5)])
    .refine(data => data[0] <= data[1], { message: "Min bedrooms must be less than or equal to max" }),
  numBedroomsWorth: z.number().min(0).optional(),
  numBathrooms: z.tuple([z.number().min(1).max(4), z.number().min(1).max(4)])
    .refine(data => data[0] <= data[1], { message: "Min bathrooms must be less than or equal to max" }),
  numBathroomsWorth: z.number().min(0).optional(),
  hasDishwasher: z.boolean(),
  dishwasherWorth: z.number().min(0).optional(),
  hasWasher: z.boolean(),
  washerWorth: z.number().optional(),
  hasDryer: z.boolean(),
  dryerWorth: z.number().optional(),
  bidAmount: z.number().min(0),
  allowRoommates: z.boolean(),
  maxRoommates: z.number().min(1).max(4).optional(),
  cleanliness: z.number().min(0).max(100).optional(),
  quietness: z.number().min(0).max(100).optional(),
  guests: z.number().min(0).max(100).optional(),
  personalSpace: z.number().min(0).max(100).optional(),
  sleepTime: z.tuple([z.number().min(SLEEP_TIME_SLIDER_MIN).max(SLEEP_TIME_SLIDER_MAX), z.number().min(SLEEP_TIME_SLIDER_MIN).max(SLEEP_TIME_SLIDER_MAX)])
    .refine(data => data[0] <= data[1], { message: "Min sleep time must be less than or equal to max" }).optional(),
  wakeTime: z.tuple([z.number().min(WAKE_TIME_SLIDER_MIN).max(WAKE_TIME_SLIDER_MAX), z.number().min(WAKE_TIME_SLIDER_MIN).max(WAKE_TIME_SLIDER_MAX)])
    .refine(data => data[0] <= data[1], { message: "Min wake time must be less than or equal to max" }).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ApartmentFormProps {
  serverPublicKey?: string;
  onApartmentCountChange: (count: number) => void;
}

const windowDirectionsOptions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

interface IndividualCountState {
  sqMeters: number | null;
  numWindows: number | null;
  windowDirections: number | null;
  totalWindowSize: number | null;
  numBedrooms: number | null;
  numBathrooms: number | null;
  hasDishwasher: number | null;
  hasWasher: number | null;
  hasDryer: number | null;
}

export function ApartmentForm({ serverPublicKey, onApartmentCountChange }: ApartmentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [individualCounts, setIndividualCounts] = useState<IndividualCountState>({
    sqMeters: null,
    numWindows: null,
    windowDirections: null,
    totalWindowSize: null,
    numBedrooms: null,
    numBathrooms: null,
    hasDishwasher: null,
    hasWasher: null,
    hasDryer: null,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      sqMeters: [50, 100],
      sqMetersWorth: 0,
      numWindows: [2, 6],
      numWindowsWorth: 0,
      windowDirections: [],
      windowDirectionsWorth: 0,
      totalWindowSize: [8, 15],
      totalWindowSizeWorth: 0,
      numBedrooms: [1, 3],
      numBedroomsWorth: 0,
      numBathrooms: [1, 2],
      numBathroomsWorth: 0,
      hasDishwasher: false,
      dishwasherWorth: 0,
      hasWasher: false,
      washerWorth: 0,
      hasDryer: false,
      dryerWorth: 0,
      bidAmount: 1000,
      allowRoommates: true,
      maxRoommates: 2,
      cleanliness: 75,
      quietness: 60,
      guests: 40,
      personalSpace: 80,
      sleepTime: [22 * 60, (24 + 0) * 60], // 10 PM - 12 AM (midnight)
      wakeTime: [6 * 60, 8 * 60], // 6 AM - 8 AM
    },
  });

  const watchedValues = form.watch();

  const fetchIndividualCount = useCallback(async (field: keyof IndividualCountState, params: URLSearchParams) => {
    try {
      params.set('_cb', new Date().getTime().toString());
      const response = await fetch(`/api/apartments/count?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setIndividualCounts(prev => ({ ...prev, [field]: data.count }));
    } catch (error) {
      console.error(`Error fetching count for ${field}:`, error);
      setIndividualCounts(prev => ({ ...prev, [field]: null }));
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('sqMetersMin', watchedValues.sqMeters[0].toString());
    params.set('sqMetersMax', watchedValues.sqMeters[1].toString());
    fetchIndividualCount('sqMeters', params);
  }, [watchedValues.sqMeters, fetchIndividualCount]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('numWindowsMin', watchedValues.numWindows[0].toString());
    params.set('numWindowsMax', watchedValues.numWindows[1].toString());
    fetchIndividualCount('numWindows', params);
  }, [watchedValues.numWindows, fetchIndividualCount]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (watchedValues.windowDirections.length > 0) {
      params.set('windowDirections', watchedValues.windowDirections.join(','));
    }
    fetchIndividualCount('windowDirections', params);
  }, [watchedValues.windowDirections, fetchIndividualCount]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('totalWindowSizeMin', watchedValues.totalWindowSize[0].toString());
    params.set('totalWindowSizeMax', watchedValues.totalWindowSize[1].toString());
    fetchIndividualCount('totalWindowSize', params);
  }, [watchedValues.totalWindowSize, fetchIndividualCount]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('numBedroomsMin', watchedValues.numBedrooms[0].toString());
    params.set('numBedroomsMax', watchedValues.numBedrooms[1].toString());
    fetchIndividualCount('numBedrooms', params);
  }, [watchedValues.numBedrooms, fetchIndividualCount]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('numBathroomsMin', watchedValues.numBathrooms[0].toString());
    params.set('numBathroomsMax', watchedValues.numBathrooms[1].toString());
    fetchIndividualCount('numBathrooms', params);
  }, [watchedValues.numBathrooms, fetchIndividualCount]);
  
  useEffect(() => {
    const params = new URLSearchParams();
    if (watchedValues.hasDishwasher) {
        params.set('hasDishwasher', 'true');
    }
    // For individual count, if not checked, we want to show count of apartments *without* it,
    // or more simply, only query when true. The current behavior is to show total if not set.
    // The current issue is likely CSV parsing.
    fetchIndividualCount('hasDishwasher', params);
  }, [watchedValues.hasDishwasher, fetchIndividualCount]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (watchedValues.hasWasher) {
        params.set('hasWasher', 'true');
    }
    fetchIndividualCount('hasWasher', params);
  }, [watchedValues.hasWasher, fetchIndividualCount]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (watchedValues.hasDryer) {
        params.set('hasDryer', 'true');
    }
    fetchIndividualCount('hasDryer', params);
  }, [watchedValues.hasDryer, fetchIndividualCount]);

  useEffect(() => {
    const updateOverallCount = async () => {
      try {
        const params = new URLSearchParams();
        params.set('sqMetersMin', watchedValues.sqMeters[0].toString());
        params.set('sqMetersMax', watchedValues.sqMeters[1].toString());
        params.set('numWindowsMin', watchedValues.numWindows[0].toString());
        params.set('numWindowsMax', watchedValues.numWindows[1].toString());
        params.set('totalWindowSizeMin', watchedValues.totalWindowSize[0].toString());
        params.set('totalWindowSizeMax', watchedValues.totalWindowSize[1].toString());
        params.set('numBedroomsMin', watchedValues.numBedrooms[0].toString());
        params.set('numBedroomsMax', watchedValues.numBedrooms[1].toString());
        params.set('numBathroomsMin', watchedValues.numBathrooms[0].toString());
        params.set('numBathroomsMax', watchedValues.numBathrooms[1].toString());
        
        if (watchedValues.windowDirections.length > 0) {
          params.set('windowDirections', watchedValues.windowDirections.join(','));
        }
        if (watchedValues.hasDishwasher) params.set('hasDishwasher', 'true');
        if (watchedValues.hasWasher) params.set('hasWasher', 'true');
        if (watchedValues.hasDryer) params.set('hasDryer', 'true');
        
        params.set('_cb', new Date().getTime().toString());
        const response = await fetch(`/api/apartments/count?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        onApartmentCountChange(data.count);
      } catch (error) {
        console.error('Error updating overall apartment count:', error);
      }
    };
    updateOverallCount();
  }, [watchedValues, onApartmentCountChange]);

  const onSubmit = async (data: FormData) => {
    if (!serverPublicKey) {
      toast({
        title: "Error",
        description: "Server public key not available",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const { name, allowRoommates, ...preferences } = data;
      const encryptedData = await encryptData(JSON.stringify(preferences), serverPublicKey);
      await apiRequest("POST", "/api/submit-preferences", {
        name,
        allowRoommates,
        encryptedData,
      });
      toast({
        title: "Success",
        description: "Your preferences have been submitted successfully!",
      });
      form.reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit preferences",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (minutes: number) => {
    const normalizedMinutes = minutes % 1440; 
    const hours = Math.floor(normalizedMinutes / 60); 
    const mins = normalizedMinutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
  };

  const renderCountBadge = (count: number | null) => {
    if (count === null) return <Badge variant="outline">Loading...</Badge>;
    return <Badge variant="outline" className="text-green-600 border-green-600">{count} apartments match</Badge>;
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-1 gap-6">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              {...form.register("name")}
              placeholder="Enter your full name"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Apartment Specifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5 text-primary" />
            Apartment Specifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Square Meters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                <Label>Square Meters</Label>
                {renderCountBadge(individualCounts.sqMeters)}
              </div>
              <div className="space-y-2">
                <Slider
                  value={watchedValues.sqMeters}
                  onValueChange={(value) => form.setValue("sqMeters", value as [number, number])}
                  min={20}
                  max={150}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>20m²</span>
                  <span className="font-medium text-slate-700">{watchedValues.sqMeters[0]}m² - {watchedValues.sqMeters[1]}m²</span>
                  <span>150m²</span>
                </div>
                 {form.formState.errors.sqMeters && (
                  <p className="text-sm text-red-600">{(form.formState.errors.sqMeters as any).message || form.formState.errors.sqMeters?.[0]?.message || form.formState.errors.sqMeters?.[1]?.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Worth to me if missing</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400" />
                <Input
                  type="number"
                  {...form.register("sqMetersWorth", { valueAsNumber: true })}
                  className="pl-8 text-sm"
                  placeholder="0"
                  min={0}
                  step={10}
                />
              </div>
            </div>
          </div>

          {/* Number of Windows */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                <Label>Number of Windows</Label>
                {renderCountBadge(individualCounts.numWindows)}
              </div>
              <div className="space-y-2">
                <Slider
                  value={watchedValues.numWindows}
                  onValueChange={(value) => form.setValue("numWindows", value as [number, number])}
                  min={1}
                  max={12}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>1</span>
                  <span className="font-medium text-slate-700">{watchedValues.numWindows[0]} - {watchedValues.numWindows[1]} windows</span>
                  <span>12</span>
                </div>
                {form.formState.errors.numWindows && (
                  <p className="text-sm text-red-600">{(form.formState.errors.numWindows as any).message || form.formState.errors.numWindows?.[0]?.message || form.formState.errors.numWindows?.[1]?.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Worth to me if missing</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400" />
                <Input
                  type="number"
                  {...form.register("numWindowsWorth", { valueAsNumber: true })}
                  className="pl-8 text-sm"
                  placeholder="0"
                  min={0}
                  step={10}
                />
              </div>
            </div>
          </div>

          {/* Window Directions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="md:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                <Label>Window Directions (match if &gt;=75% of selected are present)</Label>
                {renderCountBadge(individualCounts.windowDirections)}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {windowDirectionsOptions.map((direction) => (
                  <label key={direction} className="flex items-center space-x-2 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer has-[:checked]:bg-primary/10 has-[:checked]:border-primary">
                    <Checkbox
                      checked={watchedValues.windowDirections.includes(direction)}
                      onCheckedChange={(checked) => {
                        const current = watchedValues.windowDirections;
                        if (checked) {
                          form.setValue("windowDirections", [...current, direction]);
                        } else {
                          form.setValue("windowDirections", current.filter(d => d !== direction));
                        }
                      }}
                    />
                    <span className="text-sm">{direction}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Worth to me if missing</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400" />
                <Input
                  type="number"
                  {...form.register("windowDirectionsWorth", { valueAsNumber: true })}
                  className="pl-8 text-sm"
                  placeholder="0"
                  min={0}
                  step={10}
                />
              </div>
            </div>
          </div>

          {/* Total Window Size */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                <Label>Total Window Size</Label>
                {renderCountBadge(individualCounts.totalWindowSize)}
              </div>
              <div className="space-y-2">
                <Slider
                  value={watchedValues.totalWindowSize}
                  onValueChange={(value) => form.setValue("totalWindowSize", value as [number, number])}
                  min={2}
                  max={25}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>2m²</span>
                  <span className="font-medium text-slate-700">{watchedValues.totalWindowSize[0]}m² - {watchedValues.totalWindowSize[1]}m²</span>
                  <span>25m²</span>
                </div>
                {form.formState.errors.totalWindowSize && (
                  <p className="text-sm text-red-600">{(form.formState.errors.totalWindowSize as any).message || form.formState.errors.totalWindowSize?.[0]?.message || form.formState.errors.totalWindowSize?.[1]?.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Worth to me if missing</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400" />
                <Input
                  type="number"
                  {...form.register("totalWindowSizeWorth", { valueAsNumber: true })}
                  className="pl-8 text-sm"
                  placeholder="0"
                  min={0}
                  step={10}
                />
              </div>
            </div>
          </div>

          {/* Bedrooms and Bathrooms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
            {/* Number of Bedrooms */}
            <div className="grid grid-cols-3 gap-4 items-end">
                <div className="col-span-2 space-y-4">
                    <div className="flex justify-between items-center">
                        <Label>Number of Bedrooms</Label>
                        {renderCountBadge(individualCounts.numBedrooms)}
                    </div>
                    <div className="space-y-2">
                        <Slider
                            value={watchedValues.numBedrooms}
                            onValueChange={(value) => form.setValue("numBedrooms", value as [number, number])}
                            min={1}
                            max={5}
                            step={1}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>1</span>
                            <span className="font-medium text-slate-700">{watchedValues.numBedrooms[0]} - {watchedValues.numBedrooms[1]}</span>
                            <span>5</span>
                        </div>
                        {form.formState.errors.numBedrooms && (
                          <p className="text-sm text-red-600">{(form.formState.errors.numBedrooms as any).message || form.formState.errors.numBedrooms?.[0]?.message || form.formState.errors.numBedrooms?.[1]?.message}</p>
                        )}
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="text-xs whitespace-nowrap">Worth if missing</Label>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400" />
                        <Input
                            type="number"
                            {...form.register("numBedroomsWorth", { valueAsNumber: true })}
                            className="pl-8 text-sm h-9"
                            placeholder="0"
                            min={0}
                            step={10}
                        />
                    </div>
                </div>
            </div>

            {/* Number of Bathrooms */}
            <div className="grid grid-cols-3 gap-4 items-end">
                <div className="col-span-2 space-y-4">
                    <div className="flex justify-between items-center">
                        <Label>Number of Bathrooms</Label>
                        {renderCountBadge(individualCounts.numBathrooms)}
                    </div>
                    <div className="space-y-2">
                        <Slider
                            value={watchedValues.numBathrooms}
                            onValueChange={(value) => form.setValue("numBathrooms", value as [number, number])}
                            min={1}
                            max={4}
                            step={0.5} 
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>1</span>
                            <span className="font-medium text-slate-700">{watchedValues.numBathrooms[0]} - {watchedValues.numBathrooms[1]}</span>
                            <span>4</span>
                        </div>
                        {form.formState.errors.numBathrooms && (
                          <p className="text-sm text-red-600">{(form.formState.errors.numBathrooms as any).message || form.formState.errors.numBathrooms?.[0]?.message || form.formState.errors.numBathrooms?.[1]?.message}</p>
                        )}
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="text-xs whitespace-nowrap">Worth if missing</Label>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400" />
                        <Input
                            type="number"
                            {...form.register("numBathroomsWorth", { valueAsNumber: true })}
                            className="pl-8 text-sm h-9"
                            placeholder="0"
                            min={0}
                            step={10}
                        />
                    </div>
                </div>
            </div>
          </div>


          {/* Amenities */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Amenities</Label>
            <div className="space-y-4">
              {[
                { key: "hasDishwasher", worthKey: "dishwasherWorth", label: "Includes Dishwasher", count: individualCounts.hasDishwasher },
                { key: "hasWasher", worthKey: "washerWorth", label: "Includes Washer", count: individualCounts.hasWasher },
                { key: "hasDryer", worthKey: "dryerWorth", label: "Includes Dryer", count: individualCounts.hasDryer },
              ].map(({ key, worthKey, label, count }) => (
                <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <div className="md:col-span-2 flex justify-between items-center">
                    <label className="flex items-center space-x-3 cursor-pointer has-[:checked]:text-primary">
                      <Checkbox
                        checked={watchedValues[key as keyof FormData] as boolean}
                        onCheckedChange={(checked) => form.setValue(key as any, checked)}
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                    {renderCountBadge(count)}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs whitespace-nowrap">Worth if missing</Label>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400" />
                        <Input
                        type="number"
                        {...form.register(worthKey as any, { valueAsNumber: true })}
                        className="pl-8 text-sm h-9"
                        placeholder="0"
                        min={0}
                        step={10}
                        />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roommate Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Roommate Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RoommateSection 
            form={form} 
            watchedValues={watchedValues} 
            formatTime={formatTime} 
            sleepTimeSliderMin={SLEEP_TIME_SLIDER_MIN}
            sleepTimeSliderMax={SLEEP_TIME_SLIDER_MAX}
            wakeTimeSliderMin={WAKE_TIME_SLIDER_MIN}
            wakeTimeSliderMax={WAKE_TIME_SLIDER_MAX}
          />
        </CardContent>
      </Card>

      {/* Bid Amount */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Financials
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="bidAmount">Maximum Bid Amount</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="bidAmount"
                type="number"
                {...form.register("bidAmount", { valueAsNumber: true })}
                className="pl-10"
                placeholder="2000"
                min={0}
                step={50}
              />
            </div>
            {form.formState.errors.bidAmount && (
              <p className="text-sm text-red-600">{form.formState.errors.bidAmount.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <Card className="bg-gradient-to-r from-primary to-blue-700 text-white">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <h3 className="text-lg font-semibold mb-1 sm:mb-2">Ready to Submit Your Preferences?</h3>
              <p className="text-blue-100 text-sm">
                Your detailed preferences will be encrypted before submission to protect your privacy.
              </p>
            </div>
            <Button 
              type="submit" 
              disabled={isSubmitting || !form.formState.isValid && form.formState.isSubmitted}
              variant="secondary"
              size="lg"
              className="bg-white text-primary hover:bg-blue-50 w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit Preferences
                </>
              )}
            </Button>
          </div>
           {!form.formState.isValid && form.formState.isSubmitted && (
             <p className="text-sm text-red-200 mt-2 text-center sm:text-right">Please correct the errors above before submitting.</p>
           )}
        </CardContent>
      </Card>
    </form>
  );
}
