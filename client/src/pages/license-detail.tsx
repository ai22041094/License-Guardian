import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { format } from "date-fns";
import type { License, LicenseEvent, LicenseActivation } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Key,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  User,
  Calendar,
  Layers,
  Shield,
  History,
  Check,
  RefreshCw,
  CalendarPlus,
  Monitor,
  Globe,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface LicenseDetailResponse {
  license: License;
  events: LicenseEvent[];
  activations: LicenseActivation[];
}

function StatusBadge({ status }: { status: string }) {
  const colorClasses = {
    ACTIVE: "bg-green-500/15 text-green-700 dark:bg-green-500/20 dark:text-green-400 border-green-500/20",
    REVOKED: "bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-red-500/20",
    EXPIRED: "bg-muted text-muted-foreground border-muted-foreground/20",
  };

  return (
    <Badge
      className={`px-3 py-1 text-xs font-medium ${colorClasses[status as keyof typeof colorClasses] || ""}`}
      data-testid={`badge-detail-status-${status.toLowerCase()}`}
    >
      {status}
    </Badge>
  );
}

function ModuleBadge({ module }: { module: string }) {
  const moduleColors: Record<string, string> = {
    CUSTOM_PORTAL: "bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
    ASSET_MANAGEMENT: "bg-purple-500/15 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
    SERVICE_DESK: "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
    EPM: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  };

  return (
    <Badge
      variant="secondary"
      className={`text-sm px-3 py-1 font-normal ${moduleColors[module] || ""}`}
    >
      {module.replace("_", " ")}
    </Badge>
  );
}

function EventIcon({ eventType }: { eventType: string }) {
  switch (eventType) {
    case "CREATED":
      return <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />;
    case "STATUS_CHANGED":
      return <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    case "VALIDATED":
      return <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    default:
      return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
}

function ExtendLicenseDialog({ license, onSuccess }: { license: License; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [newExpiry, setNewExpiry] = useState("");
  const { toast } = useToast();

  const extendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/licenses/${license.id}/extend`, { newExpiry });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses", license.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      toast({
        title: "License extended",
        description: "The license has been extended with a new expiry date and key.",
      });
      setOpen(false);
      setNewExpiry("");
      onSuccess();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to extend license",
      });
    },
  });

  const currentExpiry = new Date(license.expiry);
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full" data-testid="button-extend-license">
          <CalendarPlus className="w-4 h-4 mr-2" />
          Extend License
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Extend License</DialogTitle>
          <DialogDescription>
            Extend the license expiry date. A new license key will be generated.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="p-4 bg-muted rounded-md space-y-2">
            <div className="text-sm text-muted-foreground">Current Expiry Date</div>
            <div className="font-medium">{format(currentExpiry, "MMMM d, yyyy")}</div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-expiry">New Expiry Date</Label>
            <Input
              id="new-expiry"
              type="date"
              value={newExpiry}
              min={minDate.toISOString().split('T')[0]}
              onChange={(e) => setNewExpiry(e.target.value)}
              data-testid="input-new-expiry"
            />
          </div>
          <div className="p-3 bg-amber-500/10 rounded-md text-sm text-amber-700 dark:text-amber-400">
            Note: Extending the license will generate a new license key. The old key will no longer be valid.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => extendMutation.mutate()}
            disabled={!newExpiry || extendMutation.isPending}
            data-testid="button-confirm-extend"
          >
            {extendMutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Extending...
              </>
            ) : (
              "Extend License"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-48" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function LicenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery<LicenseDetailResponse>({
    queryKey: ["/api/licenses", id],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: "ACTIVE" | "REVOKED") => {
      const res = await apiRequest("PATCH", `/api/licenses/${id}/status`, { status: newStatus });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      toast({
        title: "Status updated",
        description: "License status has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update status",
      });
    },
  });

  const copyToClipboard = async () => {
    if (!data?.license.licenseKey) return;
    try {
      await navigator.clipboard.writeText(data.license.licenseKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "License key copied to clipboard",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy to clipboard",
      });
    }
  };

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-lg bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="text-lg font-medium mb-2">License not found</h3>
          <p className="text-sm text-muted-foreground mb-6">
            The license you're looking for doesn't exist or has been deleted.
          </p>
          <Link href="/licenses">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Licenses
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { license, events, activations } = data;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/licenses">
          <Button variant="outline" size="sm" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{license.tenantId}</h1>
          <StatusBadge status={license.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="border-b px-6 py-4">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">License Information</span>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-1">
                  <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Tenant ID
                  </dt>
                  <dd className="text-base" data-testid="text-tenant-id">
                    {license.tenantId}
                  </dd>
                </div>

                <div className="space-y-1">
                  <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Created By
                  </dt>
                  <dd className="text-base" data-testid="text-created-by">
                    {license.createdBy}
                  </dd>
                </div>

                <div className="space-y-1">
                  <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Expiry Date
                  </dt>
                  <dd className="text-base" data-testid="text-expiry">
                    {format(new Date(license.expiry), "MMMM d, yyyy")}
                  </dd>
                </div>

                <div className="space-y-1">
                  <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Created At
                  </dt>
                  <dd className="text-base" data-testid="text-created-at">
                    {format(new Date(license.createdAt), "MMMM d, yyyy 'at' h:mm a")}
                  </dd>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Licensed Modules
                </dt>
                <dd className="flex flex-wrap gap-2" data-testid="text-modules">
                  {license.modules.map((module) => (
                    <ModuleBadge key={module} module={module} />
                  ))}
                </dd>
              </div>

              <Separator />

              <div className="space-y-2">
                <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  License Key
                </dt>
                <dd className="relative">
                  <div className="p-4 bg-muted rounded-md font-mono text-sm break-all" data-testid="text-license-key">
                    {license.licenseKey}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={copyToClipboard}
                    data-testid="button-copy-key"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </dd>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b px-6 py-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Audit History</span>
                <Badge variant="secondary" className="ml-2">
                  {events.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {events.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No events recorded yet
                </div>
              ) : (
                <div className="divide-y">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="p-4 flex items-start gap-4"
                      data-testid={`event-${event.id}`}
                    >
                      <div className="mt-0.5">
                        <EventIcon eventType={event.eventType} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs font-medium">
                            {event.eventType.replace("_", " ")}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            by {event.actor}
                          </span>
                        </div>
                        <p className="text-sm mt-1">{event.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(event.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b px-6 py-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">Machine Activations</span>
                  <Badge variant="secondary" className="ml-2">
                    {activations.length} / {license.maxActivations}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {activations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No machines activated yet
                </div>
              ) : (
                <div className="divide-y">
                  {activations.map((activation) => (
                    <div
                      key={activation.id}
                      className="p-4 flex items-start gap-4"
                      data-testid={`activation-${activation.id}`}
                    >
                      <div className="mt-0.5">
                        <Monitor className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm break-all" data-testid={`text-hardware-id-${activation.id}`}>
                          {activation.hardwareId}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <Globe className="w-3 h-3" />
                          <span>{activation.publicIp || "Unknown IP"}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Activated on {format(new Date(activation.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b px-6 py-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Quick Actions</span>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="p-4 bg-muted rounded-md">
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Current Status
                </div>
                <StatusBadge status={license.status} />
              </div>

              {license.status === "ACTIVE" ? (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => updateStatusMutation.mutate("REVOKED")}
                  disabled={updateStatusMutation.isPending}
                  data-testid="button-revoke"
                >
                  {updateStatusMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 mr-2" />
                      Revoke License
                    </>
                  )}
                </Button>
              ) : license.status === "REVOKED" ? (
                <Button
                  className="w-full"
                  onClick={() => updateStatusMutation.mutate("ACTIVE")}
                  disabled={updateStatusMutation.isPending}
                  data-testid="button-activate"
                >
                  {updateStatusMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Activate License
                    </>
                  )}
                </Button>
              ) : null}

              <ExtendLicenseDialog license={license} onSuccess={() => {}} />

              <Button
                variant="outline"
                className="w-full"
                onClick={copyToClipboard}
                data-testid="button-copy-key-action"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy License Key
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
