import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/sign-out";
import { cn } from "@/lib/utils";

export function SignOutButton({
  variant = "ghost",
  className,
}: {
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
}) {
  return (
    <form action={signOutAction} className="w-full">
      <Button type="submit" variant={variant} className={cn("w-full justify-start", className)}>
        <LogOutIcon />
        Sair
      </Button>
    </form>
  );
}
