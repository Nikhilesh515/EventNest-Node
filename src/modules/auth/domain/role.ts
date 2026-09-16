export type RoleName = 'User' | 'Organizer' | 'Moderator' | 'Admin' | 'SuperAdmin';

const ROLE_NAME_SET = new Set<string>([
  'User',
  'Organizer',
  'Moderator',
  'Admin',
  'SuperAdmin',
]);

export interface RoleProps {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  sortOrder: number;
  createdAt: Date;
}

export interface RoleRow {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  sort_order: number;
  created_at: Date;
}

export class Role {
  readonly id: string;
  readonly name: string;
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

  get isBuiltin(): boolean {
    return ROLE_NAME_SET.has(this.name);
  }

  static create(name: string, displayName: string, sortOrder: number, description?: string): Role {
    return new Role({
      id: crypto.randomUUID(),
      name,
      displayName,
      description: description ?? null,
      sortOrder,
      createdAt: new Date(),
    });
  }

  static fromRow(row: RoleRow): Role {
    return new Role({
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
    });
  }

  toRow(): RoleRow {
    return {
      id: this.id,
      name: this.name,
      display_name: this.displayName,
      description: this.description,
      sort_order: this.sortOrder,
      created_at: this.createdAt,
    };
  }
}
