import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/auth/check"],
    retry: false,
  });

  return {
    user: data,
    isLoading,
    isAuthenticated: !!data?.isAdmin,
    isAdmin: data?.isAdmin || false,
  };
}
