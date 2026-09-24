import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../../types';
import { mockUsers, mockFarms, mockZones } from '../../mocks/mockData';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  selectedFarmId: string;
  selectedZoneId: string;
  setSelectedFarmId: (id: string) => void;
  setSelectedZoneId: (id: string) => void;
  switchRole: (newRole: UserRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole>(() => {
    return (localStorage.getItem('smartfarm_role') as UserRole) || 'FARM_OWNER';
  });

  const [user, setUser] = useState<User | null>(() => {
    return mockUsers.find(u => u.role === role) || mockUsers[2];
  });

  const [selectedFarmId, setSelectedFarmId] = useState<string>(mockFarms[0].farmId);
  const [selectedZoneId, setSelectedZoneId] = useState<string>(mockZones[0].zoneId);

  const switchRole = (newRole: UserRole) => {
    setRole(newRole);
    localStorage.setItem('smartfarm_role', newRole);
    const matchedUser = mockUsers.find(u => u.role === newRole) || mockUsers[0];
    setUser(matchedUser);
  };

  const logout = () => {
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
        logout,
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
