import { useState, useEffect } from "react";
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

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sqMeters: z.number().min(20).max(150),
  sqMetersWorth: z.number().min(0).optional(),
  numWindows: z.number().min(1).max(12),
  numWindowsWorth: z.number().min(0).optional(),
  windowDirections: z.array(z.string()),
  windowDirectionsWorth: z.number().min(0).optional(),
  totalWindowSize: z.number().min(2).max(25),
  totalWindowSizeWorth: z.number().min(0).optional(),
  numBedrooms: z.number().min(1).max(5),
  numBedroomsWorth: z.number().min(0).optional(),
  numBathrooms: z.number().min(1).max(4),
  numBathroomsWorth: z.number().min(0).optional(),
  hasDishwasher: z.boolean(),
  dishwasherWorth: z.number().min(0).optional(),
  hasWasher: z.boolean(),
  washerWorth: z.number().min(0).optional(),
  hasDryer: z.boolean(),
  dryerWorth: z.number().min(0).optional(),
  bidAmount: z.number().min(0),
  allowRoommates: z.boolean(),
  maxRoommates: z.number().min(1).max(4).optional(),
  cleanliness: z.number().min(0).max(100).optional(),
  quietness: z.number().min(0).max(100).optional(),
  guests: z.number().min(0).max(100).optional(),
  personalSpace: z.number().min(0).max(100).optional(),
  sleepTime: z.number().min(480).max(180).optional(),
  wakeTime: z.number().min(240).max(780).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ApartmentFormProps {
  serverPublicKey?: string;
  onApartmentCountChange: (count: number) => void;
}

const windowDirections = ["N", "S", "E", "W"];

export function ApartmentForm({ serverPublicKey, onApartmentCountChange }: ApartmentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apartmentCounts, setApartmentCounts] = useState<Record<string, number>>({});
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      sqMeters: 75,
      sqMetersWorth: 0,
      numWindows: 4,
      numWindowsWorth: 0,
      windowDirections: [],
      windowDirectionsWorth: 0,
      totalWindowSize: 12,
      totalWindowSizeWorth: 0,
      numBedrooms: 2,
      numBedroomsWorth: 0,
      numBathrooms: 1,
      numBathroomsWorth: 0,
      hasDishwasher: false,
      dishwasherWorth: 0,
      hasWasher: false,
      washerWorth: 0,
      hasDryer: false,
      dryerWorth: 0,
      bidAmount: 0,
      allowRoommates: true,
      maxRoommates: 2,
      cleanliness: 75,
      quietness: 60,
      guests: 40,
      personalSpace: 80,
      sleepTime: 660, // 11:00 PM
      wakeTime: 420, // 7:00 AM
    },
  });

  const watchedValues = form.watch();

  // Update apartment counts when form values change
  useEffect(() => {
    const updateCounts = async () => {
      try {
        const params = new URLSearchParams();
        params.set('sqMeters', watchedValues.sqMeters.toString());
        params.set('numWindows', watchedValues.numWindows.toString());
        params.set('totalWindowSize', watchedValues.totalWindowSize.toString());
        params.set('numBedrooms', watchedValues.numBedrooms.toString());
        params.set('numBathrooms', watchedValues.numBathrooms.toString());
        
        if (watchedValues.windowDirections.length > 0) {
          params.set('windowDirections', watchedValues.windowDirections.join(','));
        }
        
        if (watchedValues.hasDishwasher) {
          params.set('hasDishwasher', 'true');
        }
        
        if (watchedValues.hasWasher) {
          params.set('hasWasher', 'true');
        }
        
        if (watchedValues.hasDryer) {
          params.set('hasDryer', 'true');
        }

        const response = await fetch(`/api/apartments/count?${params}`);
        const data = await response.json();
        
        onApartmentCountChange(data.count);
        
        // Update individual counts for display
        setApartmentCounts(prev => ({
          ...prev,
          overall: data.count,
        }));
      } catch (error) {
        console.error('Error updating apartment counts:', error);
      }
    };

    updateCounts();
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
      // Separate name and allowRoommates from the rest of the data
      const { name, allowRoommates, ...preferences } = data;
      
      // Encrypt the preferences
      const encryptedData = await encryptData(JSON.stringify(preferences), serverPublicKey);
      
      // Submit to server
      await apiRequest("POST", "/api/submit-preferences", {
        name,
        allowRoommates,
        encryptedData,
      });

      toast({
        title: "Success",
        description: "Your preferences have been submitted successfully!",
      });

      // Reset form
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
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
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
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <Badge variant="outline" className="text-green-600 border-green-600">
                  {apartmentCounts.overall || 0} apartments match
                </Badge>
              </div>
              <div className="space-y-2">
                <Slider
                  value={[watchedValues.sqMeters]}
                  onValueChange={(value) => form.setValue("sqMeters", value[0])}
                  min={20}
                  max={150}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>20m²</span>
                  <span className="font-medium text-slate-700">{watchedValues.sqMeters}m²</span>
                  <span>150m²</span>
                </div>
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
              <Label>Number of Windows</Label>
              <div className="space-y-2">
                <Slider
                  value={[watchedValues.numWindows]}
                  onValueChange={(value) => form.setValue("numWindows", value[0])}
                  min={1}
                  max={12}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>1</span>
                  <span className="font-medium text-slate-700">{watchedValues.numWindows} windows</span>
                  <span>12</span>
                </div>
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
              <Label>Window Directions (AND contains)</Label>
              <div className="grid grid-cols-4 gap-3">
                {windowDirections.map((direction) => (
                  <label key={direction} className="flex items-center space-x-2 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
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
              <Label>Total Window Size</Label>
              <div className="space-y-2">
                <Slider
                  value={[watchedValues.totalWindowSize]}
                  onValueChange={(value) => form.setValue("totalWindowSize", value[0])}
                  min={2}
                  max={25}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>2m²</span>
                  <span className="font-medium text-slate-700">{watchedValues.totalWindowSize}m²</span>
                  <span>25m²</span>
                </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="grid grid-cols-3 gap-4 items-end">
              <div className="col-span-2 space-y-4">
                <Label>Number of Bedrooms</Label>
                <div className="space-y-2">
                  <Slider
                    value={[watchedValues.numBedrooms]}
                    onValueChange={(value) => form.setValue("numBedrooms", value[0])}
                    min={1}
                    max={5}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>1</span>
                    <span className="font-medium text-slate-700">{watchedValues.numBedrooms}</span>
                    <span>5</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400" />
                  <Input
                    type="number"
                    {...form.register("numBedroomsWorth", { valueAsNumber: true })}
                    className="pl-8 text-sm"
                    placeholder="0"
                    min={0}
                    step={10}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 items-end">
              <div className="col-span-2 space-y-4">
                <Label>Number of Bathrooms</Label>
                <div className="space-y-2">
                  <Slider
                    value={[watchedValues.numBathrooms]}
                    onValueChange={(value) => form.setValue("numBathrooms", value[0])}
                    min={1}
                    max={4}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>1</span>
                    <span className="font-medium text-slate-700">{watchedValues.numBathrooms}</span>
                    <span>4</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400" />
                  <Input
                    type="number"
                    {...form.register("numBathroomsWorth", { valueAsNumber: true })}
                    className="pl-8 text-sm"
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
                { key: "hasDishwasher", worthKey: "dishwasherWorth", label: "Includes Dishwasher" },
                { key: "hasWasher", worthKey: "washerWorth", label: "Includes Washer" },
                { key: "hasDryer", worthKey: "dryerWorth", label: "Includes Dryer" },
              ].map(({ key, worthKey, label }) => (
                <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <div className="md:col-span-2">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <Checkbox
                        checked={watchedValues[key as keyof FormData] as boolean}
                        onCheckedChange={(checked) => form.setValue(key as any, checked)}
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  </div>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400" />
                    <Input
                      type="number"
                      {...form.register(worthKey as any, { valueAsNumber: true })}
                      className="pl-8 text-sm"
                      placeholder="0"
                      min={0}
                      step={10}
                    />
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
          <RoommateSection form={form} watchedValues={watchedValues} formatTime={formatTime} />
        </CardContent>
      </Card>

      {/* Submit Button */}
      <Card className="bg-gradient-to-r from-primary to-blue-700 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-2">Ready to Submit Your Preferences?</h3>
              <p className="text-blue-100 text-sm">
                Your detailed preferences will be encrypted before submission to protect your privacy.
              </p>
            </div>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              variant="secondary"
              size="lg"
              className="bg-white text-primary hover:bg-blue-50"
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
        </CardContent>
      </Card>
    </form>
  );
}
