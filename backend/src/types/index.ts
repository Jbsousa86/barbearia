export type AuthenticatedUser = {
  id: string;
  role: 'CUSTOMER' | 'OWNER' | 'BARBER';
};
