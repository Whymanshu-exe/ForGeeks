import { useQuery } from "@tanstack/react-query";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

const apiUrl = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export const authQueryKey = ["auth", "me"] as const;

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch(`${apiUrl}/api/auth/me`, { credentials: "include" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Unable to check your sign-in session.");

  const result: unknown = await response.json();
  if (
    typeof result !== "object"
    || result === null
    || !("user" in result)
    || typeof result.user !== "object"
    || result.user === null
    || !("id" in result.user)
    || !("name" in result.user)
    || !("email" in result.user)
    || typeof result.user.id !== "string"
    || typeof result.user.name !== "string"
    || typeof result.user.email !== "string"
  ) {
    throw new Error("The server returned an invalid sign-in response.");
  }
  return { id: result.user.id, name: result.user.name, email: result.user.email };
}

export async function logout(): Promise<void> {
  const response = await fetch(`${apiUrl}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Unable to sign out. Please try again.");
}

export function useCurrentUser() {
  return useQuery({ queryKey: authQueryKey, queryFn: getCurrentUser });
}
