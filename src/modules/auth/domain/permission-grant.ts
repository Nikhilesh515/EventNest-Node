import type { PermissionName } from '../../../shared/application/permissions.js';

export interface PermissionGrantProps {
  id: string;
  userId: string;
  permissionName: PermissionName;
  isGranted: boolean;
  expiresAt: Date | null;
  createdAt: Date;
}

export class PermissionGrant {
  readonly id: string;
  readonly userId: string;
  readonly permissionName: PermissionName;
  readonly isGranted: boolean;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;

  private constructor(props: PermissionGrantProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.permissionName = props.permissionName;
    this.isGranted = props.isGranted;
    this.expiresAt = props.expiresAt;
    this.createdAt = props.createdAt;
  }

  static create(userId: string, permissionName: PermissionName, expiresAt?: Date): PermissionGrant {
    return new PermissionGrant({
      id: crypto.randomUUID(),
      userId,
      permissionName,
      isGranted: true,
      expiresAt: expiresAt ?? null,
      createdAt: new Date(),
    });
  }

  isExpired(now: Date): boolean {
    return this.expiresAt !== null && now >= this.expiresAt;
  }
}
