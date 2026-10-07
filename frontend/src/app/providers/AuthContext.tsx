import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, Farm, Zone } from '../../types';
import { mockUsers, mockFarms, mockZones } from '../../mocks/mockData';
import { authService, farmService, zoneService, getAccessToken } from '../../services';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  selectedFarmId: string;
  selectedZoneId: string;
  setSelectedFarmId: (id: string) => void;
  setSelectedZoneId: (id: string) => void;
  switchRole: (newRole: UserRole) => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  farms: Farm[];
  zones: Zone[];
}

const roleCredentials: Record<UserRole, { email: string; pass: string }> = {
  PLATFORM_ADMIN: { email: 'admin@smartfarm.demo', pass: 'Demo@12345' },
  PLATFORM_TECHNICIAN: { email: 'technician@smartfarm.demo', pass: 'Demo@12345' },
  FARM_OWNER: { email: 'owner@smartfarm.demo', pass: 'Demo@12345' },
  FARMER: { email: 'farmer@smartfarm.demo', pass: 'Demo@12345' },
};

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
    return mockUsers.find(u => u.role === role) || mockUsers[2];
  });

  const [farms, setFarms] = useState<Farm[]>(mockFarms);
  const [zones, setZones] = useState<Zone[]>(mockZones);
  const [selectedFarmId, setSelectedFarmId] = useState<string>(mockFarms[0]?.farmId || '');
  const [selectedZoneId, setSelectedZoneId] = useState<string>(mockZones[0]?.zoneId || '');

  // Fetch real farms & zones when logged in
  const refreshFarmsAndZones = async () => {
    try {
      const realFarms = await farmService.getFarms();
      if (Array.isArray(realFarms) && realFarms.length > 0) {
        setFarms(realFarms);
        setSelectedFarmId(realFarms[0].farmId);
        const realZones = await zoneService.getZones();
        if (Array.isArray(realZones) && realZones.length > 0) {
          setZones(realZones);
          setSelectedZoneId(realZones[0].zoneId);
        }
      }
    } catch {
      // Keep fallback mocks if offline
    }
  };

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
    await refreshFarmsAndZones();
    return mapped;
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
        await refreshFarmsAndZones();
        return;
      } catch (err) {
        console.warn('Backend login for role failed, fallback to mock:', err);
      }
    }
    const matchedUser = mockUsers.find(u => u.role === newRole) || mockUsers[0];
    setUser(matchedUser);
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        selectedFarmId,
        selectedZoneId,
        setSelectedFarmId,
        setSelectedZoneId,
        switchRole,
        login,
        logout,
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
