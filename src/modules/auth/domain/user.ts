export interface UserProps {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  roleId: string;
  roleName: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  readonly id: string;
  readonly email: string;
  displayName: string;
  readonly passwordHash: string;
  readonly roleId: string;
  readonly roleName: string | null;
  isActive: boolean;
  readonly createdAt: Date;
  updatedAt: Date;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.displayName = props.displayName;
    this.passwordHash = props.passwordHash;
    this.roleId = props.roleId;
    this.roleName = props.roleName;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(
    email: string,
    displayName: string,
    passwordHash: string,
    roleId: string,
    roleName: string,
  ): User {
    const now = new Date();
    return new User({
      id: crypto.randomUUID(),
      email,
      displayName,
      passwordHash,
      roleId,
      roleName,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  updateProfile(displayName: string): void {
    this.displayName = displayName;
    this.updatedAt = new Date();
  }
}
