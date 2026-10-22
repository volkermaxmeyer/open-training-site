export class PublishError extends Error {
  readonly slug: string;
  readonly reason: string;
  constructor(slug: string, reason: string) {
    super(`[${slug}] ${reason}`);
    this.name = "PublishError";
    this.slug = slug;
    this.reason = reason;
  }
}
