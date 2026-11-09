
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import AgentFlowDashboard from "@/components/AgentFlowDashboard";

async function AuthenticatedDashboard() {
  await connection();

  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <AgentFlowDashboard
      key={user.id}
      userEmail={user.email ?? ""}
    />
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="p-8">
          Loading AgentFlow...
        </main>
      }
    >
      <AuthenticatedDashboard />
    </Suspense>
  );
}
