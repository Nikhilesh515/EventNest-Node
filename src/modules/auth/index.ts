export { buildAuthModule, type AuthModuleDeps } from './module.js';
export type { AuthResponseDto, AuthUserDto } from './application/dto/auth.dto.js';
export type { UserDto } from './application/dto/user.dto.js';
export type { PermissionDto } from './application/dto/permission.dto.js';
export type { UserLookupPort, UserSummary } from './application/ports/user-lookup.port.js';
export type { PermissionProviderPort } from './application/ports/permission-provider.port.js';
