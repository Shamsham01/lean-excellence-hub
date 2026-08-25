import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";

export default function NoAccessPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <AuthCard
          title="No organisation access"
          description="Your identity is not currently eligible for an active organisation."
        >
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        </AuthCard>
      </div>
    </div>
  );
}
