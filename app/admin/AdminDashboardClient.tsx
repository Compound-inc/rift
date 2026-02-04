"use client";

import { useState, useEffect, useCallback, startTransition } from "react";
import {
  listOrganizationsAction,
  setOrganizationPlanAction,
  cancelOrganizationSubscriptionAction,
  type OrganizationRow,
} from "@/actions/admin-organizations";
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
import { Input } from "@/components/ai/ui/input";
import { Loader2, RefreshCw, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";

export default function AdminDashboardClient() {
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationRow | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [enterpriseSeats, setEnterpriseSeats] = useState<number>(1);
  const [isSetPlanDialogOpen, setIsSetPlanDialogOpen] = useState(false);
  const [isSettingPlan, setIsSettingPlan] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelType, setCancelType] = useState<"now" | "end_of_cycle">("now");
  const [cancelStatus, setCancelStatus] = useState<string>("canceled");

  const fetchOrganizations = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listOrganizationsAction();
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setOrganizations(result.data);
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const handleSetPlan = async () => {
    if (!selectedOrg || !selectedPlan) return;

    setIsSettingPlan(true);
    const result = await setOrganizationPlanAction({
      organizationId: selectedOrg._id,
      workos_id: selectedOrg.workos_id,
      plan: selectedPlan as "plus" | "pro" | "enterprise",
      organizationName: selectedOrg.name ?? undefined,
      ...(selectedPlan === "enterprise"
        ? { enterpriseSeats: Math.max(1, enterpriseSeats) }
        : {}),
    });
    setIsSettingPlan(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setError(null);
    toast.success("Plan attached in Autumn; quota will apply on next chat request.");
    setIsSetPlanDialogOpen(false);
    setSelectedOrg(null);
    setSelectedPlan("");
    setEnterpriseSeats(1);
    startTransition(() => {
      void fetchOrganizations();
    });
  };

  const handleCancelSubscription = async () => {
    if (!selectedOrg || !cancelStatus) return;

    setIsCanceling(true);
    const result = await cancelOrganizationSubscriptionAction({
      organizationId: selectedOrg._id,
      workos_id: selectedOrg.workos_id,
      productId: selectedOrg.plan,
      cancelType,
      subscriptionStatus: cancelStatus,
    });
    setIsCanceling(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setIsCancelDialogOpen(false);
    setSelectedOrg(null);
    setCancelType("now");
    setCancelStatus("canceled");
    startTransition(() => {
      void fetchOrganizations();
    });
  };


  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "Not set";
    return new Date(timestamp).toLocaleDateString();
  };

  // Removed badge variants; using plain text instead

  const capitalizeFirstLetter = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const columns: ColumnDef<OrganizationRow>[] = [
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
      accessorKey: "productStatus",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("productStatus") as string;
        return <span className="text-sm">{status ? capitalizeFirstLetter(status) : "None"}</span>;
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const org = row.original;
        const hasActiveSubscription = org.plan && org.productStatus === "active";
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
          setEnterpriseSeats(1);
        }
      }}>
        <DialogContent className="dark:bg-popover-main dark:text-popover-text dark:border-border">
          <DialogHeader>
            <DialogTitle>Set Plan for {selectedOrg?.name}</DialogTitle>
            <DialogDescription>
              Assign a subscription plan to this organization.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger className="dark:bg-popover-secondary/20 dark:text-popover-text dark:border-border/60">
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plus">Plus (1000 standard, 100 premium)</SelectItem>
                <SelectItem value="pro">Pro (2700 standard, 270 premium)</SelectItem>
                <SelectItem value="enterprise">Enterprise (1000 standard, 100 premium, seats)</SelectItem>
              </SelectContent>
            </Select>
            {selectedPlan === "enterprise" && (
              <div>
                <label className="text-sm font-medium">Seats</label>
                <Input
                  type="number"
                  min={1}
                  value={enterpriseSeats}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setEnterpriseSeats(1);
                      return;
                    }
                    const n = parseInt(raw, 10);
                    if (!Number.isNaN(n) && n >= 1) setEnterpriseSeats(n);
                  }}
                  className="mt-1 dark:bg-popover-secondary/20 dark:text-popover-text dark:border-border/60"
                />
              </div>
            )}
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
              Choose how to cancel this organization&apos;s subscription.
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
                  <strong>Note:</strong> The subscription will remain active until the end of the current billing cycle.
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
