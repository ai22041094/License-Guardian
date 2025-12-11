import { useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AVAILABLE_MODULES } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { ArrowLeft, Key, Plus, AlertCircle, Calendar, User, Layers } from "lucide-react";

const formSchema = z.object({
  tenantId: z.string().min(1, "Tenant ID is required"),
  modules: z.array(z.string()).min(1, "At least one module is required"),
  expiry: z.string().min(1, "Expiry date is required"),
});

type FormValues = z.infer<typeof formSchema>;

const moduleDescriptions: Record<string, string> = {
  CUSTOM_PORTAL: "Branded customer-facing portal",
  ASSET_MANAGEMENT: "IT asset tracking and management",
  SERVICE_DESK: "Helpdesk and ticket management",
  EPM: "Enterprise performance management",
};

export default function NewLicensePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tenantId: "",
      modules: [],
      expiry: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("POST", "/api/licenses", {
        ...data,
        createdBy: user?.username || "admin",
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      toast({
        title: "License created",
        description: "New license has been generated successfully.",
      });
      setLocation(`/licenses/${data.id}`);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create license",
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    createMutation.mutate(data);
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/licenses">
          <Button variant="outline" size="sm" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Create License</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate a new software license for a tenant
          </p>
        </div>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardHeader className="border-b px-6 py-4">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">License Details</span>
            </div>
            <CardDescription>
              Fill in the details below to generate a new signed license key
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="tenantId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Tenant ID
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter unique tenant identifier"
                          data-testid="input-tenant-id"
                        />
                      </FormControl>
                      <FormDescription>
                        Unique identifier for the organization or customer
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expiry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Expiry Date
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="date"
                          min={minDate}
                          data-testid="input-expiry"
                        />
                      </FormControl>
                      <FormDescription>
                        When the license will expire and become invalid
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="modules"
                  render={() => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        Licensed Modules
                      </FormLabel>
                      <FormDescription className="mb-4">
                        Select which modules this license should grant access to
                      </FormDescription>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {AVAILABLE_MODULES.map((module) => (
                          <FormField
                            key={module}
                            control={form.control}
                            name="modules"
                            render={({ field }) => (
                              <FormItem
                                key={module}
                                className="flex items-start space-x-3 space-y-0 p-4 border rounded-md hover-elevate active-elevate-2 cursor-pointer"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(module)}
                                    onCheckedChange={(checked) => {
                                      const newValue = checked
                                        ? [...field.value, module]
                                        : field.value?.filter((v) => v !== module);
                                      field.onChange(newValue);
                                    }}
                                    data-testid={`checkbox-module-${module.toLowerCase()}`}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm font-medium cursor-pointer">
                                    {module.replace("_", " ")}
                                  </FormLabel>
                                  <p className="text-xs text-muted-foreground">
                                    {moduleDescriptions[module]}
                                  </p>
                                </div>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {createMutation.isError && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                      {createMutation.error instanceof Error
                        ? createMutation.error.message
                        : "Failed to create license"}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-4 pt-4">
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-create"
                  >
                    {createMutation.isPending ? (
                      "Creating..."
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Create License
                      </>
                    )}
                  </Button>
                  <Link href="/licenses">
                    <Button variant="outline" type="button" data-testid="button-cancel">
                      Cancel
                    </Button>
                  </Link>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
