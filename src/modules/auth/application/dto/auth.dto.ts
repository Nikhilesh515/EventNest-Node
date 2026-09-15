export interface AuthUserDto {
  id: string;
  email: string;
  displayName: string;
  roleName: string;
  isActive: boolean;
}

export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUserDto;
}
