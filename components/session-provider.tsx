"use client";

import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import type { APIError } from "better-auth";
import { createContext, type ReactNode, useContext } from "react";
import type { auth } from "@/lib/auth";
import { authClient } from "@/lib/auth-client";

type Session = typeof auth.$Infer.Session;

type SessionContextType = UseQueryResult<Session, Error | APIError>;

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({
	initialSession,
	children,
}: {
	initialSession: Session;
	children: ReactNode;
}) {
	const value = useQuery({
		queryKey: ["auth", "session"],
		queryFn: async () => {
			const result = await authClient.getSession();
			if (!result.data) {
				if (result.error) {
					throw result.error;
				}
				throw new Error("Session not found");
			}
			return result.data;
		},
		initialData: initialSession,
	});

	return (
		<SessionContext.Provider value={value}>{children}</SessionContext.Provider>
	);
}

export function useSession() {
	const context = useContext(SessionContext);
	if (context === undefined) {
		throw new Error("useSession must be used within a SessionProvider");
	}
	return context;
}
