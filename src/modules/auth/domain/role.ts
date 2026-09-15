export type RoleName = 'User' | 'Organizer' | 'Moderator' | 'Admin' | 'SuperAdmin';

export interface RoleProps {
  id: string;
  name: RoleName;
  displayName: string;
  description: string | null;
  sortOrder: number;
  createdAt: Date;
}

export class Role {
  readonly id: string;
  readonly name: RoleName;
  readonly displayName: string;
  readonly description: string | null;
  readonly sortOrder: number;
  readonly createdAt: Date;

  private constructor(props: RoleProps) {
    this.id = props.id;
    this.name = props.name;
    this.displayName = props.displayName;
    this.description = props.description;
    this.sortOrder = props.sortOrder;
    this.createdAt = props.createdAt;
  }

  static create(name: RoleName, displayName: string, sortOrder: number): Role {
    return new Role({
      id: crypto.randomUUID(),
      name,
      displayName,
      description: null,
      sortOrder,
      createdAt: new Date(),
    });
  }
}
