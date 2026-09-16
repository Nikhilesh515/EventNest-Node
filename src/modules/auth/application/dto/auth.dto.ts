export interface AuthUserDto {
  id: string;
  email: string;
  displayName: string;
  roleName: string;
  isActive: boolean;
}

export interface AuthResponseDto {
  accessToken: string;
  expiresIn: number;
  user: AuthUserDto;
}

export interface AuthSessionResult {
  body: AuthResponseDto;
  refreshToken: string;
}
