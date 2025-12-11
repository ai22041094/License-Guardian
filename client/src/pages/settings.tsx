import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Settings,
  Key,
  Copy,
  Check,
  RefreshCw,
  Shield,
  AlertTriangle,
  Info,
} from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

export default function SettingsPage() {
  const { toast } = useToast();
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [secretLength, setSecretLength] = useState(32);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/generate-secret", { length: secretLength });
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedSecret(data.secret);
      toast({
        title: "Secret generated",
        description: "A new signing secret has been generated. Copy it and add it to your environment.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate secret",
      });
    },
  });

  const copyToClipboard = async () => {
    if (!generatedSecret) return;
    try {
      await navigator.clipboard.writeText(generatedSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "Secret copied to clipboard",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy to clipboard",
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage application settings and security configuration
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader className="border-b px-6 py-4">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">License Signing Secret Generator</span>
            </div>
            <CardDescription>
              Generate a cryptographically secure secret for signing license keys
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>How it works</AlertTitle>
              <AlertDescription>
                The LICENSE_SIGNING_SECRET is used to sign and verify license keys using JWT (HS256 algorithm). 
                A strong secret ensures that license keys cannot be forged.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="secret-length">Secret Length (bytes)</Label>
                <div className="flex gap-4 items-center">
                  <Input
                    id="secret-length"
                    type="number"
                    min={16}
                    max={64}
                    value={secretLength}
                    onChange={(e) => setSecretLength(Number(e.target.value))}
                    className="w-32"
                    data-testid="input-secret-length"
                  />
                  <span className="text-sm text-muted-foreground">
                    Recommended: 32 bytes (256 bits)
                  </span>
                </div>
              </div>

              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                data-testid="button-generate-secret"
              >
                {generateMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Generate New Secret
                  </>
                )}
              </Button>
            </div>

            {generatedSecret && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Generated Secret</Label>
                  <div className="relative">
                    <div 
                      className="p-4 bg-muted rounded-md font-mono text-sm break-all pr-20"
                      data-testid="text-generated-secret"
                    >
                      {generatedSecret}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={copyToClipboard}
                      data-testid="button-copy-secret"
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
                  </div>
                </div>

                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Important</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>
                      After copying this secret, you need to add it to your environment variables:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 mt-2">
                      <li>Go to the Secrets tab in your Replit project</li>
                      <li>Find or create <code className="bg-muted px-1 rounded">LICENSE_SIGNING_SECRET</code></li>
                      <li>Paste the generated secret as the value</li>
                      <li>Restart the application for changes to take effect</li>
                    </ol>
                    <p className="mt-2 font-medium">
                      Warning: Changing the secret will invalidate all existing license keys!
                    </p>
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b px-6 py-4">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">Current Configuration</span>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-md">
                <div>
                  <p className="font-medium text-sm">LICENSE_SIGNING_SECRET</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Used for signing license keys
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-sm text-muted-foreground">Configured</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted rounded-md">
                <div>
                  <p className="font-medium text-sm">SESSION_SECRET</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Used for JWT authentication tokens
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-sm text-muted-foreground">Configured</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
