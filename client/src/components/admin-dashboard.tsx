import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Shield, 
  Users, 
  CheckCircle, 
  Clock, 
  Home, 
  Play, 
  Save, 
  RefreshCw,
  Loader2 
} from "lucide-react";

export function AdminDashboard() {
  const [lastUpdate] = useState(new Date().toLocaleString());
  const { toast } = useToast();
  // Removed pythonOutput state as output will now be directly in the table
  // const [pythonOutput, setPythonOutput] = useState<string | null>(null);

  const { data: peopleStatus, isLoading: isLoadingPeople } = useQuery({
    queryKey: ["/api/admin/people-status"],
  });

  const { data: matchingResults } = useQuery({
    queryKey: ["/api/admin/matching-results"],
  });

  const { data: apartmentsData, isLoading: isLoadingApartments } = useQuery({
    queryKey: ["/api/apartments"],
  });

  const runMatchingMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/run-matching"), // Call the TS matching endpoint
    onSuccess: (response) => {
      const data = response as any;
      // No pythonOutput to set, directly invalidate queries
      toast({
        title: "Matching Completed",
        description: `Matching algorithm ran successfully. Assigned ${data.assignedCount} people.`,
      });
      // Invalidate matching results to show the new data from the TS script's CSV output
      queryClient.invalidateQueries({ queryKey: ["/api/admin/matching-results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/people-status"] }); // People status might change if assigned
    },
    onError: (error) => {
      // setPythonOutput(`Error: ${error.message}`); // No pythonOutput
      toast({
        title: "Error Running Matching",
        description: error.message || "Failed to run matching algorithm",
        variant: "destructive",
      });
    },
  });

  const assignRoomsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/assign-rooms"),
    onSuccess: (response) => {
      const data = response as any;
      toast({
        title: "Rooms Assigned",
        description: `Successfully assigned ${data.assignedCount} people to their rooms`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/people-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/matching-results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/apartments"] }); // Invalidate apartments to get updated tenant counts
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign rooms",
        variant: "destructive",
      });
    },
  });

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/people-status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/matching-results"] });
    queryClient.invalidateQueries({ queryKey: ["/api/apartments"] }); // Refresh apartment data as well
    toast({
      title: "Data Refreshed",
      description: "All data has been refreshed from the server",
    });
  };

  const totalSubmissions = peopleStatus?.length || 0;
  const allowingRoommates = peopleStatus?.filter((p: any) => p.allowRoommates).length || 0;
  const assignedPeople = peopleStatus?.filter((p: any) => p.isAssigned).length || 0;
  
  const totalApartments = apartmentsData?.length || 0;
  const assignedApartmentsCount = apartmentsData?.filter((apt: any) => 
    apt.tenants > 0 && (apt.tenants === apt.numBedrooms || apt.allowRoommates === false)
  ).length || 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-primary text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Shield className="h-6 w-6" />
              <h1 className="text-xl font-semibold">Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-blue-100">
                Last updated: <span className="font-medium">{lastUpdate}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                className="text-primary border-white hover:bg-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-slate-600">Total Submissions</p>
                  <p className="text-2xl font-bold text-slate-900">{totalSubmissions}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-slate-600">Allow Roommates</p>
                  <p className="text-2xl font-bold text-slate-900">{allowingRoommates}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <Clock className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-sm text-slate-600">Already Assigned</p>
                  <p className="text-2xl font-bold text-slate-900">{assignedPeople}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <Home className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm text-slate-600">Assigned Apartments</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {isLoadingApartments ? <Loader2 className="h-6 w-6 animate-spin" /> : `${assignedApartmentsCount}/${totalApartments}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mb-8">
          <Button
            onClick={() => runMatchingMutation.mutate()}
            disabled={runMatchingMutation.isPending}
            size="lg"
            className="bg-primary hover:bg-primary-dark"
          >
            {runMatchingMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run Matching + Bids
              </>
            )}
          </Button>
          
          <Button
            onClick={() => assignRoomsMutation.mutate()}
            disabled={assignRoomsMutation.isPending || !matchingResults?.length}
            variant="outline"
            size="lg"
            className="border-green-600 text-green-600 hover:bg-green-50"
          >
            {assignRoomsMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Assign Rooms
              </>
            )}
          </Button>
        </div>

        {/* Python Script Output - REMOVED */}
        {/* {pythonOutput && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5 text-blue-600" />
                Python Script Output
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-800 text-white p-4 rounded-md text-sm overflow-auto max-h-96">
                {pythonOutput}
              </pre>
            </CardContent>
          </Card>
        )} */}

        {/* People Status Table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              Submitted Preferences
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingPeople ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading people data...</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Roommates</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {peopleStatus?.map((person: any) => (
                    <TableRow key={person.id}>
                      <TableCell className="font-medium">{person.name}</TableCell>
                      <TableCell>
                        <Badge variant={person.allowRoommates ? "default" : "secondary"}>
                          {person.allowRoommates ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={person.isAssigned ? "default" : "outline"}>
                          {person.isAssigned ? "Assigned" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>{person.assignedRoom || "-"}</TableCell>
                      <TableCell>
                        {person.requiredPayment ? `$${person.requiredPayment}` : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Matching Results */}
        {matchingResults && matchingResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Matching Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Apartment</TableHead>
                    <TableHead>Assigned People</TableHead>
                    <TableHead>Individual Payments</TableHead>
                    <TableHead>Total Payment</TableHead>
                    <TableHead>Occupancy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchingResults.map((result: any) => (
                    <TableRow key={result.apartmentId}>
                      <TableCell className="font-medium">{result.apartmentName}</TableCell>
                      <TableCell>
                        {result.assignedPeople.map((person: any) => person.name).join(", ")}
                      </TableCell>
                      <TableCell>
                        {result.assignedPeople.map((person: any) => `$${person.payment.toFixed(2)}`).join(" / ")}
                      </TableCell>
                      <TableCell className="font-medium">${result.totalPayment.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={result.tenants >= result.capacity ? "default" : "outline"}>
                          {result.tenants}/{result.capacity} {result.tenants >= result.capacity ? "Full" : "Available"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
