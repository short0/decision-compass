import { useEffect, useState, createContext, useContext } from "react";
import { api, type User } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isGuest: true,
  refetch: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const isGuest = !user || user.isGuest === true;

  const fetchUser = async () => {
    try {
      const me = await api.auth.me();
      if (me) {
        setUser(me);
      } else {
        const guest = await api.auth.guest();
        setUser(guest);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isGuest, refetch: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}
