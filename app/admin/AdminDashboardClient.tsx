"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ai/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ai/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ai/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ai/ui/card";
import { DataTable } from "@/components/ai/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ai/ui/dropdown-menu";
import { Loader2, RefreshCw, MoreHorizontal } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";

interface Organization {
  _id: string;
  _creationTime: number;
  workos_id: string;
  name: string;
  plan?: "plus" | "pro";
  standardQuotaLimit?: number;
  premiumQuotaLimit?: number;
  billingCycleStart?: number;
  billingCycleEnd?: number;
  subscriptionStatus?: string;
  stripeCustomerId?: string;
  cancelAtPeriodEnd?: boolean;
}

export default function AdminDashboardClient() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [isSetPlanDialogOpen, setIsSetPlanDialogOpen] = useState(false);
  const [isSettingPlan, setIsSettingPlan] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelType, setCancelType] = useState<"now" | "end_of_cycle">("now");
  const [cancelStatus, setCancelStatus] = useState<string>("canceled");

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/admin/organizations");
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch organizations");
      }
      
      const data = await response.json();
      setOrganizations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const handleSetPlan = async () => {
    if (!selectedOrg || !selectedPlan) return;

    try {
      setIsSettingPlan(true);
      const response = await fetch("/api/admin/organizations/set-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationId: selectedOrg._id,
          plan: selectedPlan,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to set plan");
      }

      // Refresh organizations list
      await fetchOrganizations();
      setIsSetPlanDialogOpen(false);
      setSelectedOrg(null);
      setSelectedPlan("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set plan");
    } finally {
      setIsSettingPlan(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!selectedOrg || !cancelStatus) return;

    try {
      setIsCanceling(true);
      const response = await fetch("/api/admin/organizations/cancel-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationId: selectedOrg._id,
          cancelType,
          subscriptionStatus: cancelStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to cancel subscription");
      }

      // Refresh organizations list
      await fetchOrganizations();
      setIsCancelDialogOpen(false);
      setSelectedOrg(null);
      setCancelType("now");
      setCancelStatus("canceled");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel subscription");
    } finally {
      setIsCanceling(false);
    }
  };


  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "Not set";
    return new Date(timestamp).toLocaleDateString();
  };

  // Removed badge variants; using plain text instead

  const capitalizeFirstLetter = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const columns: ColumnDef<Organization>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("name")}</div>
      ),
    },
    {
      accessorKey: "workos_id",
      header: "WorkOS ID",
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground font-mono">
          {row.getValue("workos_id")}
        </div>
      ),
    },
    {
      accessorKey: "plan",
      header: "Plan",
      cell: ({ row }) => {
        const plan = row.getValue("plan") as string;
        return <span className="text-sm">{plan ? capitalizeFirstLetter(plan) : "No Plan"}</span>;
      },
    },
    {
      accessorKey: "standardQuotaLimit",
      header: "Standard",
      cell: ({ row }) => {
        const quota = row.getValue("standardQuotaLimit") as number;
        return (
          <div className="text-sm font-medium">
            {quota || 0}
          </div>
        );
      },
    },
    {
      accessorKey: "premiumQuotaLimit",
      header: "Premium",
      cell: ({ row }) => {
        const quota = row.getValue("premiumQuotaLimit") as number;
        return (
          <div className="text-sm font-medium">
            {quota || 0}
          </div>
        );
      },
    },
    {
      accessorKey: "billingCycleStart",
      header: "Billing Start",
      cell: ({ row }) => {
        const start = row.getValue("billingCycleStart") as number;
        return (
          <div className="text-sm">
            {formatDate(start)}
          </div>
        );
      },
    },
    {
      accessorKey: "billingCycleEnd",
      header: "Billing End",
      cell: ({ row }) => {
        const end = row.getValue("billingCycleEnd") as number;
        return (
          <div className="text-sm">
            {formatDate(end)}
          </div>
        );
      },
    },
    {
      accessorKey: "subscriptionStatus",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("subscriptionStatus") as string;
        return <span className="text-sm">{status ? capitalizeFirstLetter(status) : "None"}</span>;
      },
    },
    {
      accessorKey: "cancelAtPeriodEnd",
      header: "CPE?",
      cell: ({ row }) => {
        const cancelAtPeriodEnd = row.getValue("cancelAtPeriodEnd") as boolean;
        return <span className="text-sm">{cancelAtPeriodEnd ? "Yes" : "No"}</span>;
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const org = row.original;
        const hasActiveSubscription = org.plan && org.subscriptionStatus === "active";
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-popover-secondary/40">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="backdrop-blur-sm bg-popover-main/80 dark:bg-popover-main/80 border-border/60 shadow-lg">
              <DropdownMenuItem
                onClick={() => {
                  setSelectedOrg(org);
                  setSelectedPlan(org.plan || "");
                  setIsSetPlanDialogOpen(true);
                }}
              >
                Set Plan
              </DropdownMenuItem>
              {hasActiveSubscription && (
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedOrg(org);
                    setCancelType("now");
                    setCancelStatus("canceled");
                    setIsCancelDialogOpen(true);
                  }}
                  className="text-destructive focus:text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  Cancel Subscription
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (loading) {
    return (
      <Card className="dark:bg-popover-main dark:text-popover-text dark:border-border/60 backdrop-blur-sm">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading organizations...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="dark:bg-popover-main dark:text-popover-text dark:border-border/60 backdrop-blur-sm">
        <CardContent className="py-8">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={fetchOrganizations} variant="outline" className="dark:border-border/60 dark:text-popover-text">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="dark:bg-popover-secondary dark:border-border/60 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Organizations</CardTitle>
            <Button onClick={fetchOrganizations} variant="outline" size="sm" className="dark:border-border/60 dark:text-popover-text">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={organizations}
            searchKey="name"
            searchPlaceholder="Search organizations..."
            showPagination={true}
            showSearch={true}
          />
        </CardContent>
      </Card>

      {/* Set Plan Dialog */}
      <Dialog open={isSetPlanDialogOpen} onOpenChange={(open) => {
        setIsSetPlanDialogOpen(open);
        if (!open) {
          setSelectedOrg(null);
          setSelectedPlan("");
        }
      }}>
        <DialogContent className="dark:bg-popover-main dark:text-popover-text dark:border-border">
          <DialogHeader>
            <DialogTitle>Set Plan for {selectedOrg?.name}</DialogTitle>
            <DialogDescription>
              Assign a subscription plan to this organization.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger className="dark:bg-popover-secondary/20 dark:text-popover-text dark:border-border/60">
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plus">Plus (1000 standard, 100 premium)</SelectItem>
                <SelectItem value="pro">Pro (1500 standard, 300 premium)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSetPlanDialogOpen(false)}
              className="dark:border-border/60 dark:text-popover-text"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSetPlan}
              disabled={!selectedPlan || isSettingPlan}
            >
              {isSettingPlan && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Set Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Subscription Dialog */}
      <Dialog open={isCancelDialogOpen} onOpenChange={(open) => {
        setIsCancelDialogOpen(open);
        if (!open) {
          setSelectedOrg(null);
          setCancelType("now");
          setCancelStatus("canceled");
        }
      }}>
        <DialogContent className="dark:bg-popover-main dark:text-popover-text dark:border-border">
          <DialogHeader>
            <DialogTitle>Cancel Subscription for {selectedOrg?.name}</DialogTitle>
            <DialogDescription>
              Choose how to cancel this organization's subscription.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium">Cancellation Type</label>
              <Select value={cancelType} onValueChange={(value: "now" | "end_of_cycle") => setCancelType(value)}>
                <SelectTrigger className="mt-1 dark:bg-popover-secondary/20 dark:text-popover-text dark:border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="now">Cancel Now</SelectItem>
                  <SelectItem value="end_of_cycle">Cancel at End of Billing Cycle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Set Status To</label>
              <Select value={cancelStatus} onValueChange={setCancelStatus}>
                <SelectTrigger className="mt-1 dark:bg-popover-secondary/20 dark:text-popover-text dark:border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="incomplete">Incomplete</SelectItem>
                  <SelectItem value="incomplete_expired">Incomplete Expired</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {cancelType === "now" && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">
                  <strong>Warning:</strong> This will immediately cancel the subscription and remove all quotas and billing information.
                </p>
              </div>
            )}
            {cancelType === "end_of_cycle" && (
              <div className="p-3 bg-yellow-50 dark:bg-popover-secondary/20 border border-yellow-200 dark:border-border rounded-md">
                <p className="text-sm text-yellow-800 dark:text-popover-text">
                  <strong>Note:</strong> The subscription will remain active until the end of the current billing cycle ({selectedOrg?.billingCycleEnd ? new Date(selectedOrg.billingCycleEnd).toLocaleDateString() : "Unknown"}).
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCancelDialogOpen(false)}
              className="dark:border-border/60 dark:text-popover-text"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={!cancelStatus || isCanceling}
            >
              {isCanceling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {cancelType === "now" ? "Cancel Now" : "Schedule Cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
