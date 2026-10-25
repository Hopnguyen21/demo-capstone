import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, Farm, Zone } from '../../types';
import { authService, farmService, fieldService, zoneService, getAccessToken } from '../../services';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  selectedFarmId: string;
  selectedZoneId: string;
  setSelectedFarmId: (id: string) => void;
  setSelectedZoneId: (id: string) => void;
  switchRole: (newRole: UserRole) => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: {
    email: string;
    fullName: string;
    phone?: string;
    password: string;
    role: 'FarmOwner' | 'Farmer';
  }) => Promise<any>;
  logout: () => Promise<void>;
  refreshFarmsAndZones: () => Promise<void>;
  farms: Farm[];
  zones: Zone[];
}

const isDev = Boolean(import.meta.env.DEV);

// Demo credentials are only available in development mode to prevent leaking credentials in production bundles
const roleCredentials: Partial<Record<UserRole, { email: string; pass: string }>> = isDev ? {
  PLATFORM_ADMIN: { email: 'admin@smartfarm.demo', pass: 'Demo@12345' },
  PLATFORM_TECHNICIAN: { email: 'technician@smartfarm.demo', pass: 'Demo@12345' },
  FARM_OWNER: { email: 'owner@smartfarm.demo', pass: 'Demo@12345' },
  FARMER: { email: 'farmer@smartfarm.demo', pass: 'Demo@12345' },
} : {};

function mapBackendUser(bUser: any): User {
  const roleMap: Record<string, UserRole> = {
    'PlatformAdmin': 'PLATFORM_ADMIN',
    'PlatformTechnician': 'PLATFORM_TECHNICIAN',
    'FarmOwner': 'FARM_OWNER',
    'Farmer': 'FARMER',
    'PLATFORM_ADMIN': 'PLATFORM_ADMIN',
    'PLATFORM_TECHNICIAN': 'PLATFORM_TECHNICIAN',
    'FARM_OWNER': 'FARM_OWNER',
    'FARMER': 'FARMER',
  };
  return {
    userId: bUser.userId || '20000000-0000-0000-0000-000000000001',
    tenantId: bUser.tenantId || undefined,
    username: bUser.email?.split('@')[0] || 'user',
    email: bUser.email || '',
    fullName: bUser.fullName || bUser.email || 'SmartFarm User',
    phone: bUser.phoneNumber || bUser.phone,
    role: roleMap[bUser.role] || 'FARM_OWNER',
    status: (bUser.status?.toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE') as any,
    createdAt: bUser.createdAtUtc || new Date().toISOString(),
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole>(() => {
    return (localStorage.getItem('smartfarm_role') as UserRole) || 'FARM_OWNER';
  });

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('smartfarm_user');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return null;
  });

  const [farms, setFarms] = useState<Farm[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [farmZonesRevision, setFarmZonesRevision] = useState(0);

  // Listen for unauthenticated event from API interceptor
  useEffect(() => {
    const handleUnauthenticated = () => {
      setUser(null);
      setFarms([]);
      setZones([]);
      setSelectedFarmId('');
      setSelectedZoneId('');
      localStorage.removeItem('smartfarm_user');
      localStorage.removeItem('smartfarm_role');
    };
    window.addEventListener('sf:unauthenticated', handleUnauthenticated);
    return () => window.removeEventListener('sf:unauthenticated', handleUnauthenticated);
  }, []);

  // Fetch real farms & zones when logged in
  const refreshFarmsAndZones = async () => {
    setFarmZonesRevision(revision => revision + 1);
    setFarms([]);
    setZones([]);
    setSelectedFarmId('');
    setSelectedZoneId('');
    try {
      const realFarms = await farmService.getFarms();
      const farmList = Array.isArray(realFarms) ? realFarms : [];
      setFarms(farmList);
      const farmId = farmList[0]?.farmId || '';
      setSelectedFarmId(farmId);
    } catch {
      setFarms([]);
      setZones([]);
      setSelectedFarmId('');
      setSelectedZoneId('');
    }
  };

  // Keep the selected zone inside the selected farm; AI and dashboard must use the same scope.
  useEffect(() => {
    let active = true;
    setZones([]);
    setSelectedZoneId('');
    if (!selectedFarmId || !getAccessToken()) return () => { active = false; };

    const loadFarmZones = async () => {
      try {
        const fields = await fieldService.getFields(selectedFarmId);
        const zoneGroups = await Promise.all(fields.map((field: any) => zoneService.getZones(field.fieldId)));
        if (!active) return;
        const farmZones = zoneGroups.flat().filter((zone: Zone) => zone.farmId === selectedFarmId);
        setZones(farmZones);
        setSelectedZoneId(farmZones[0]?.zoneId || '');
      } catch {
        if (active) {
          setZones([]);
          setSelectedZoneId('');
        }
      }
    };
    void loadFarmZones();
    return () => { active = false; };
  }, [selectedFarmId, farmZonesRevision]);

  useEffect(() => {
    if (getAccessToken()) {
      refreshFarmsAndZones();
    }
  }, [role]);

  const login = async (email: string, password: string): Promise<User> => {
    const rawUser = await authService.login(email, password);
    const mapped = mapBackendUser(rawUser);
    setUser(mapped);
    setRole(mapped.role);
    localStorage.setItem('smartfarm_role', mapped.role);
    localStorage.setItem('smartfarm_user', JSON.stringify(mapped));
    await refreshFarmsAndZones();
    return mapped;
  };

  const register = async (payload: {
    email: string;
    fullName: string;
    phone?: string;
    password: string;
    role: 'FarmOwner' | 'Farmer';
  }) => {
    return await authService.register(payload);
  };

  const switchRole = async (newRole: UserRole) => {
    setRole(newRole);
    localStorage.setItem('smartfarm_role', newRole);
    const cred = roleCredentials[newRole];
    if (cred) {
      try {
        const rawUser = await authService.login(cred.email, cred.pass);
        const mapped = mapBackendUser(rawUser);
        setUser(mapped);
        localStorage.setItem('smartfarm_user', JSON.stringify(mapped));
        await refreshFarmsAndZones();
        return;
      } catch (err) {
        console.warn('Backend login for role failed:', err);
      }
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore
    }
    setUser(null);
    setFarms([]);
    setZones([]);
    setSelectedFarmId('');
    setSelectedZoneId('');
    localStorage.removeItem('smartfarm_user');
    localStorage.removeItem('smartfarm_role');
  };

  const isAuthenticated = !!user && !!getAccessToken();

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated,
        selectedFarmId,
        selectedZoneId,
        setSelectedFarmId,
        setSelectedZoneId,
        switchRole,
        login,
        register,
        logout,
        refreshFarmsAndZones,
        farms,
        zones,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
