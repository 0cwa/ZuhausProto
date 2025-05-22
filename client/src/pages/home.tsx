import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Identicon } from "@/components/identicon";
import { ApartmentForm } from "@/components/apartment-form";
import { Home as HomeIcon, Shield } from "lucide-react";

export default function Home() {
  const [apartmentCount, setApartmentCount] = useState<number | null>(null);

  const { data: serverData } = useQuery({
    queryKey: ["/api/public-key"],
  });

  const { data: initialCount } = useQuery({
    queryKey: ["/api/apartments/count"],
    onSuccess: (data) => setApartmentCount(data.count),
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <HomeIcon className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold text-slate-900">Apartment Matcher</h1>
              {apartmentCount !== null && (
                <Badge variant="default" className="bg-primary text-white">
                  {apartmentCount} available apartments
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-slate-600">Server ID</div>
              <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-slate-200">
                <Identicon value={serverData?.hash || "default"} size={40} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Introduction */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-slate-900">
              Find Your Perfect Apartment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 leading-relaxed">
              Tell us about your preferences and we'll match you with compatible apartments and roommates. 
              Your detailed preferences are encrypted for privacy.
            </p>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Alert className="mb-8 border-blue-200 bg-blue-50">
          <Shield className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-700">
            <strong>Data Security:</strong> Your preference data will be encrypted client-side before submission. 
            Only your name and roommate preference will be stored unencrypted.
          </AlertDescription>
        </Alert>

        {/* Apartment Form */}
        <ApartmentForm 
          serverPublicKey={serverData?.publicKey}
          onApartmentCountChange={setApartmentCount}
        />
      </main>
    </div>
  );
}
