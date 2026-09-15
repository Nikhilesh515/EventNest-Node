export interface RefreshTokenProps {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenHash: string | null;
  createdByIp: string | null;
  createdAt: Date;
}

export class RefreshToken {
  readonly id: string;
  readonly tokenHash: string;
  readonly userId: string;
  readonly expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenHash: string | null;
  readonly createdByIp: string | null;
  readonly createdAt: Date;

  private constructor(props: RefreshTokenProps) {
    this.id = props.id;
    this.tokenHash = props.tokenHash;
    this.userId = props.userId;
    this.expiresAt = props.expiresAt;
    this.revokedAt = props.revokedAt;
    this.replacedByTokenHash = props.replacedByTokenHash;
    this.createdByIp = props.createdByIp;
    this.createdAt = props.createdAt;
  }

  static create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    createdByIp?: string,
  ): RefreshToken {
    return new RefreshToken({
      id: crypto.randomUUID(),
      tokenHash,
      userId,
      expiresAt,
      revokedAt: null,
      replacedByTokenHash: null,
      createdByIp: createdByIp ?? null,
      createdAt: new Date(),
    });
  }

  revoke(replacedByHash?: string): void {
    this.revokedAt = new Date();
    this.replacedByTokenHash = replacedByHash ?? null;
  }

  isExpired(now: Date): boolean {
    return now >= this.expiresAt;
  }

  get isRevoked(): boolean {
    return this.revokedAt !== null;
  }
}
