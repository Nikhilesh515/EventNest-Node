export interface TagProps {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Tag {
  readonly id: string;
  name: string;
  color: string;
  readonly createdAt: Date;
  updatedAt: Date;

  private constructor(props: TagProps) {
    this.id = props.id;
    this.name = props.name;
    this.color = props.color;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(name: string, color: string): Tag {
    return new Tag({
      id: crypto.randomUUID(),
      name,
      color,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: TagProps): Tag {
    return new Tag(props);
  }

  updateName(name: string): void {
    this.name = name;
    this.updatedAt = new Date();
  }

  updateColor(color: string): void {
    this.color = color;
    this.updatedAt = new Date();
  }
}
