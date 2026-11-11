
"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

import { useAgentFlow } from "@/hooks/useAgentFlow";

type AgentFlowState = ReturnType<typeof useAgentFlow>;

interface AgentFlowContextValue {
  userEmail: string;
  flow: AgentFlowState;
}

const AgentFlowContext =
  createContext<AgentFlowContextValue | null>(null);

export function AgentFlowProvider({
  children,
  userEmail,
}: {
  children: ReactNode;
  userEmail: string;
}) {
  const flow = useAgentFlow();

  return (
    <AgentFlowContext.Provider value={{ userEmail, flow }}>
      {children}
    </AgentFlowContext.Provider>
  );
}

export function useAgentFlowContext() {
  const context = useContext(AgentFlowContext);

  if (!context) {
    throw new Error(
      "useAgentFlowContext must be used inside AgentFlowProvider"
    );
  }

  return context;
}
