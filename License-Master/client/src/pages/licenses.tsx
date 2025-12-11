import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import type { License } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Key, Eye, FileText, AlertCircle } from "lucide-react";

function getStatusVariant(status: string): "default" | "destructive" | "secondary" {
  switch (status) {
    case "ACTIVE":
      return "default";
    case "REVOKED":
      return "destructive";
    case "EXPIRED":
      return "secondary";
    default:
      return "secondary";
  }
}

function StatusBadge({ status }: { status: string }) {
  const variant = getStatusVariant(status);
  const colorClasses = {
    ACTIVE: "bg-green-500/15 text-green-700 dark:bg-green-500/20 dark:text-green-400 border-green-500/20",
    REVOKED: "bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-red-500/20",
    EXPIRED: "bg-muted text-muted-foreground border-muted-foreground/20",
  };

  return (
    <Badge
      variant={variant}
      className={`px-3 py-1 text-xs font-medium ${colorClasses[status as keyof typeof colorClasses] || ""}`}
      data-testid={`badge-status-${status.toLowerCase()}`}
    >
      {status}
    </Badge>
  );
}

function ModuleBadges({ modules }: { modules: string[] }) {
  const moduleColors: Record<string, string> = {
    CUSTOM_PORTAL: "bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
    ASSET_MANAGEMENT: "bg-purple-500/15 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
    SERVICE_DESK: "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
    EPM: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  };

  return (
    <div className="flex flex-wrap gap-1">
      {modules.map((module) => (
        <Badge
          key={module}
          variant="secondary"
          className={`text-xs px-2 py-0.5 font-normal ${moduleColors[module] || ""}`}
        >
          {module.replace("_", " ")}
        </Badge>
      ))}
    </div>
  );
}

function LicenseTableSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center mb-4">
        <FileText className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">No licenses yet</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Get started by creating your first software license for a tenant.
      </p>
      <Link href="/licenses/new">
        <Button data-testid="button-create-first-license">
          <Plus className="w-4 h-4 mr-2" />
          Create License
        </Button>
      </Link>
    </div>
  );
}

export default function LicensesPage() {
  const { data: licenses, isLoading, error } = useQuery<License[]>({
    queryKey: ["/api/licenses"],
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Licenses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your software licenses and track their status
          </p>
        </div>
        <Link href="/licenses/new">
          <Button data-testid="button-create-license">
            <Plus className="w-4 h-4 mr-2" />
            New License
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium">All Licenses</span>
            {licenses && (
              <Badge variant="secondary" className="ml-2">
                {licenses.length}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LicenseTableSkeleton />
          ) : error ? (
            <div className="flex items-center justify-center gap-2 p-8 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <span>Failed to load licenses</span>
            </div>
          ) : !licenses || licenses.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-6">Tenant</TableHead>
                    <TableHead className="px-6">Modules</TableHead>
                    <TableHead className="px-6">Expiry</TableHead>
                    <TableHead className="px-6">Status</TableHead>
                    <TableHead className="px-6">Created</TableHead>
                    <TableHead className="px-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {licenses.map((license) => (
                    <TableRow
                      key={license.id}
                      className="group"
                      data-testid={`row-license-${license.id}`}
                    >
                      <TableCell className="px-6 py-4 font-medium">
                        {license.tenantId}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <ModuleBadges modules={license.modules} />
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                        {format(new Date(license.expiry), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <StatusBadge status={license.status} />
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                        {format(new Date(license.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <Link href={`/licenses/${license.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`button-view-${license.id}`}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
