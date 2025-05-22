import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RoommateSectionProps {
  form: any;
  watchedValues: any;
  formatTime: (minutes: number) => string;
}

export function RoommateSection({ form, watchedValues, formatTime }: RoommateSectionProps) {
  const sleepTimeOptions = [];
  for (let i = 480; i <= 180 + 1440; i += 30) { // 8 PM to 3 AM
    const actualTime = i > 1440 ? i - 1440 : i;
    sleepTimeOptions.push({
      value: actualTime,
      label: formatTime(actualTime),
    });
  }

  const wakeTimeOptions = [];
  for (let i = 240; i <= 780; i += 30) { // 4 AM to 1 PM
    wakeTimeOptions.push({
      value: i,
      label: formatTime(i),
    });
  }

  return (
    <div className="space-y-6">
      {/* Allow Roommates Toggle */}
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
        <div>
          <Label htmlFor="allowRoommates" className="text-sm font-medium">Allow roommates</Label>
          <p className="text-xs text-slate-500">Enable sharing apartments with compatible people</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <Checkbox
            checked={watchedValues.allowRoommates}
            onCheckedChange={(checked) => form.setValue("allowRoommates", checked)}
            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
        </label>
      </div>

      {/* Roommate Details */}
      {watchedValues.allowRoommates && (
        <div className="space-y-6 pl-6 border-l-2 border-slate-200">
          {/* Max Roommates */}
          <div className="space-y-3">
            <Label>Maximum other roommates (besides yourself)</Label>
            <div className="space-y-2">
              <Slider
                value={[watchedValues.maxRoommates || 2]}
                onValueChange={(value) => form.setValue("maxRoommates", value[0])}
                min={1}
                max={4}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>1 person</span>
                <span className="font-medium text-slate-700">{watchedValues.maxRoommates || 2} people</span>
                <span>4 people</span>
              </div>
            </div>
          </div>

          {/* Interpersonal Factors */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">Interpersonal Compatibility Factors</h4>
              <p className="text-xs text-slate-500 mb-4">Rate how important each factor is to you (0 = not important, 100 = extremely important)</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { key: "cleanliness", label: "Cleanliness in common areas" },
                { key: "quietness", label: "Quiet home environment" },
                { key: "guests", label: "Comfortable with frequent guests" },
                { key: "personalSpace", label: "Need for personal space" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <Label className="text-sm">{label}</Label>
                  <Slider
                    value={[watchedValues[key] || 50]}
                    onValueChange={(value) => form.setValue(key, value[0])}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Not Important</span>
                    <span className="font-medium text-slate-700">{watchedValues[key] || 50}</span>
                    <span>Very Important</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sleep Schedule */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-slate-700">Sleep Schedule</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>I go to sleep around</Label>
                <Select 
                  value={watchedValues.sleepTime?.toString()} 
                  onValueChange={(value) => form.setValue("sleepTime", parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {sleepTimeOptions.map(({ value, label }) => (
                      <SelectItem key={value} value={value.toString()}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>I wake up around</Label>
                <Select 
                  value={watchedValues.wakeTime?.toString()} 
                  onValueChange={(value) => form.setValue("wakeTime", parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {wakeTimeOptions.map(({ value, label }) => (
                      <SelectItem key={value} value={value.toString()}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
