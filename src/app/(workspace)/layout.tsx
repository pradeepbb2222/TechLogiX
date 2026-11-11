
import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AgentFlowProvider } from "@/providers/AgentFlowProvider";
import WorkspaceShell from "@/components/WorkspaceShell";

async function AuthenticatedWorkspace({
  children,
}: {
  children: ReactNode;
}) {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/login");

  return (
    <AgentFlowProvider userEmail={user.email ?? ""}>
      <WorkspaceShell>{children}</WorkspaceShell>
    </AgentFlowProvider>
  );
}

export default function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<main className="p-8">Loading CogniCart...</main>}>
      <AuthenticatedWorkspace>{children}</AuthenticatedWorkspace>
    </Suspense>
  );
}
